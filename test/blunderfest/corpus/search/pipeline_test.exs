defmodule Blunderfest.Corpus.Search.PipelineTest do
  # async: false — the corpus tables are rebuilt from the research fixture.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.Search.Pipeline
  alias Blunderfest.Corpus.{Extraction, TestFixtures}

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)
    corpus = Path.join(dir, "fixture.pgn")
    File.write!(corpus, TestFixtures.pgn())

    out = Path.join(dir, "extracted")
    Extraction.run(corpus, games: 13, out_dir: out)
    Blunderfest.Corpus.rebuild(out, 13)

    %{out: out}
  end

  # Game 1's full mainline: the route to the tabiya plus its continuation.
  defp ref_moves_gid1 do
    ~w(d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Ne8 Nd3 f5 Bd2 Kh8 Rc1 a5)
  end

  # Generous limits: these tests pin case retrieval, not display caps.
  defp run_analyze do
    Pipeline.analyze(TestFixtures.tabiya_key(),
      reference_moves: ref_moves_gid1(),
      ref_ply: 16,
      limit: 100,
      scan_limit: 200,
      exact_limit: 100
    )
  end

  test "the reference block carries counts, the decision menu, and the next-move distribution" do
    result = run_analyze()

    assert result.reference.key == TestFixtures.tabiya_key()
    assert result.reference.historical == %{occurrences: 11, games: 8}
    assert length(result.reference.families) == 4
    assert result.timings.candidates_ms >= 0
    assert result.timings.menu_ms >= 0
    assert result.timings.evidence_ms >= 0
    assert result.timings.total_ms >= 0

    # gid 12 reaches the tabiya at plies 16 ("Ne1") and 20 ("Bd2") — it
    # contributes once to each move. gid 13 reaches it at plies 16/20 ("Rb1")
    # and 24 ("Bd2"), same treatment.
    counts = Map.new(result.reference.next_moves, &{&1.move, &1.games})
    # gids 1, 2, 12
    assert counts["Ne1"] == 3
    # gids 3, 4, 12 (ply 20), 13 (ply 24)
    assert counts["Bd2"] == 4
    # gid 6
    assert counts["Qc2"] == 1
    # gid 7
    assert counts["Nd2"] == 1
    # gid 13 (plies 16/20)
    assert counts["Rb1"] == 1
  end

  test "the sum of next-move games counts each (gid, first-move) pair once" do
    result = run_analyze()
    # gid 12 reach es the tabiya at plies 16 ("Ne1") and 20 ("Bd2") and gid 13
    # reaches it at plies 16/20 ("Rb1") and 24 ("Bd2") — so each gid counts
    # once per distinct first move. 3 ("Ne1": gids 1,2,12) + 4 ("Bd2": gids
    # 3,4,12,13) + 1 ("Qc2": gid 6) + 1 ("Nd2": gid 7) + 1 ("Rb1": gid 13).
    total = Enum.reduce(result.reference.next_moves, 0, &(&1.games + &2))
    assert total == 10
  end

  test "the DTO exposes next_moves on the reference (wire shape)" do
    dto =
      TestFixtures.tabiya_key()
      |> Blunderfest.HistoricalEvidence.analyze(
        route: ref_moves_gid1(),
        ref_ply: 16
      )

    assert {:ok, %{reference: %{next_moves: rows}}} = dto

    first_moves = Enum.map(rows, & &1.move)
    assert "Ne1" in first_moves
    assert "Bd2" in first_moves
  end

  test "A2: the next-move distribution keeps Marshall and Closed separated" do
    result =
      Pipeline.analyze(TestFixtures.a2_key(), limit: 100, scan_limit: 200, exact_limit: 100)

    counts = Map.new(result.reference.next_moves, &{&1.move, &1.games})
    assert counts["O-O"] == 2
    assert counts["d6"] == 2
  end

  test "B1: tempo twin with the route divergence and a black-side family join" do
    result = run_analyze()

    b1 = Enum.find(result.candidates, &(&1.gid == 5))
    assert b1.key == TestFixtures.b1_key()
    assert b1.strategy == :pawn_skeleton
    assert :tempo_twin in b1.flags
    assert hd(b1.position.typed_differences).type == :tempo_twin

    assert b1.route.shared_plies == 6
    assert b1.route.ref_move == "e4"
    assert b1.route.cand_move == "e3"
    assert b1.route.ply_gap == 1

    # The family construction alone does not place it; the skeleton layer
    # joins it on black's side (Spike 06).
    assert b1.families.membership.status == :none
    assert b1.families.skeleton_black.status == :member
    assert b1.families.skeleton_black.family_games >= 2
    assert b1.families.skeleton_white.status == :none
  end

  test "B3: no multi-game family join on either side" do
    result = run_analyze()

    b3 = Enum.find(result.candidates, &(&1.gid == 6 && &1.ply == 17))
    assert b3.key == TestFixtures.b3_key()
    assert :plan_divergence in b3.flags

    for side <- [b3.families.skeleton_white, b3.families.skeleton_black] do
      if side.status == :member, do: assert(side.family_games == 1)
    end
  end

  test "B4: black joins family B exactly, white partially — the hybrid reading" do
    result = run_analyze()

    b4 = Enum.find(result.candidates, &(&1.gid == 7 && &1.ply == 17))
    assert b4.key == TestFixtures.b4_key()

    assert b4.families.skeleton_black.status == :member
    assert b4.families.skeleton_black.sim == 1.0
    assert b4.families.skeleton_white.sim == 0.5
  end

  test "the same-game structural candidate is flagged" do
    result = run_analyze()

    sg = Enum.find(result.candidates, &(&1.key == TestFixtures.same_game_key()))
    assert sg
    assert sg.historical == %{occurrences: 2, games: 1, same_game_only: true}
    assert :same_game_only in sg.flags
    refute :singleton in sg.flags
  end

  test "card stats from the counts path equal the full occurrence list's stats" do
    # Phase 0 (Spike 09 Horizon 1): cards derive occurrences/games/
    # same_game_only from the aggregate, never from a materialized list —
    # the values must be exactly what the full list would produce, for
    # every card (exact cards sharing the reference key included).
    result = run_analyze()

    for cand <- result.candidates do
      list = Blunderfest.Corpus.occurrences(cand.key)
      games = list |> Enum.map(&elem(&1, 0)) |> Enum.uniq() |> length()

      assert cand.historical == %{
               occurrences: length(list),
               games: games,
               same_game_only: length(list) > 1 and games == 1
             }
    end
  end

  test "exact candidates carry game metadata and the reference route comparison" do
    result = run_analyze()

    gid1 = Enum.find(result.candidates, &(&1.gid == 1 && &1.ply == 16))
    assert gid1.strategy == :exact
    assert gid1.game.white == "A"
    assert gid1.game.eco == "E97"
    assert gid1.route.shared_plies == 16
    assert gid1.continuation.window == ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8 Rc1 a5)
  end

  test "A2: Marshall and Closed stay distinct families" do
    result =
      Pipeline.analyze(TestFixtures.a2_key(), limit: 100, scan_limit: 200, exact_limit: 100)

    marshall = Enum.find(result.candidates, &(&1.gid == 10))
    closed = Enum.find(result.candidates, &(&1.gid == 8))

    assert marshall.families.membership.status == :member
    assert closed.families.membership.status == :member
    refute marshall.families.membership.member_of == closed.families.membership.member_of
  end

  test "each key's position stats are fetched once per request (memo)" do
    # The memo's fetcher is Corpus.position_stats/1 — trace the facade
    # process and assert each key is counted exactly once, however many
    # cards share it (the 12 exact cards all carry the reference key).
    corpus = Process.whereis(Blunderfest.Corpus)
    :erlang.trace(corpus, true, [:receive])

    result = run_analyze()

    :erlang.trace(corpus, false, [:receive])

    stats_keys =
      for {:trace, _pid, :receive, {:"$gen_call", _from, {:position_stats, key}}} <-
            drain_trace([]),
          do: key

    assert stats_keys == Enum.uniq(stats_keys)
    assert Enum.count(stats_keys, &(&1 == TestFixtures.tabiya_key())) == 1
    # Every card's key was memoized from a single fetch.
    for cand <- result.candidates do
      assert cand.key in stats_keys
    end
  end

  test "the timings break out the Postgres hydration" do
    result = run_analyze()
    assert is_integer(result.timings.pg_ms)
    assert result.timings.pg_ms >= 0
  end

  defp drain_trace(acc) do
    receive do
      msg -> drain_trace([msg | acc])
    after
      0 -> Enum.reverse(acc)
    end
  end
end
