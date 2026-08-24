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

  defp run_analyze do
    Pipeline.analyze(TestFixtures.tabiya_key(), reference_moves: ref_moves_gid1(), ref_ply: 16)
  end

  test "the reference block carries counts and the decision menu" do
    result = run_analyze()

    assert result.reference.key == TestFixtures.tabiya_key()
    assert result.reference.historical == %{occurrences: 11, games: 8}
    assert length(result.reference.families) == 4
    assert result.timings.candidates_ms >= 0
    assert result.timings.menu_ms >= 0
    assert result.timings.evidence_ms >= 0
    assert result.timings.total_ms >= 0
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
    result = Pipeline.analyze(TestFixtures.a2_key())

    marshall = Enum.find(result.candidates, &(&1.gid == 10))
    closed = Enum.find(result.candidates, &(&1.gid == 8))

    assert marshall.families.membership.status == :member
    assert closed.families.membership.status == :member
    refute marshall.families.membership.member_of == closed.families.membership.member_of
  end
end
