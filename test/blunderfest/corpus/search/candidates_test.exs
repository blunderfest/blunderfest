defmodule Blunderfest.Corpus.Search.CandidatesTest do
  # async: false — the corpus tables are rebuilt from the research fixture.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.Analysis.Features
  alias Blunderfest.Corpus.Search.Candidates
  alias Blunderfest.Corpus.{Extraction, TestFixtures}

  setup_all do
    :ok
  end

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)
    corpus = Path.join(dir, "fixture.pgn")
    File.write!(corpus, TestFixtures.pgn())

    out = Path.join(dir, "extracted")
    %{stats: stats} = Extraction.run(corpus, games: 13, out_dir: out)
    Blunderfest.Corpus.rebuild(out, 13)

    %{stats: stats}
  end

  test "exact candidates are the tabiya occurrences", %{stats: stats} do
    assert stats.games_failed == 0

    result = Candidates.generate(TestFixtures.tabiya_key())

    assert Enum.map(result.exact, &{&1.gid, &1.ply}) ==
             TestFixtures.expected_occurrences()[TestFixtures.tabiya_key()]

    assert Enum.all?(result.exact, &(&1.strategy == :exact))
    assert Enum.all?(result.exact, &(&1.key == TestFixtures.tabiya_key()))
    assert hd(result.exact).why =~ "11 occurrences total"
  end

  test "structural candidates include the B1/B3/B4 tempo and sideline keys" do
    result = Candidates.generate(TestFixtures.tabiya_key(), limit: 100, scan_limit: 200)

    keys = Enum.map(result.structural, & &1.key)

    assert TestFixtures.b1_key() in keys
    assert TestFixtures.b3_key() in keys
    assert TestFixtures.b4_key() in keys
    refute TestFixtures.tabiya_key() in keys

    # All structural candidates share the reference's pawn skeleton.
    ref = result.reference

    assert Enum.all?(result.structural, fn cand ->
             Features.pawn_mismatches(ref, cand.features) == 0
           end)

    # Ranked by piece overlap, desc.
    matches = Enum.map(result.structural, & &1.dims.piece_placement.matches)
    assert matches == Enum.sort(matches, :desc)
  end

  test "the tempo twin retrieves the tabiya structurally" do
    result = Candidates.generate(TestFixtures.b1_key(), limit: 100, scan_limit: 200)

    assert Enum.map(result.exact, &{&1.gid, &1.ply}) == [{5, 17}]
    assert Enum.any?(result.structural, &(&1.key == TestFixtures.tabiya_key()))
  end

  test "same-game repeats stay visible as separate exact candidates" do
    result = Candidates.generate(TestFixtures.tabiya_key())

    gid12 = Enum.filter(result.exact, &(&1.gid == 12))
    assert Enum.map(gid12, & &1.ply) == [16, 20]
  end

  test "defaults cap the candidate lists", %{stats: _stats} do
    result = Candidates.generate(TestFixtures.tabiya_key())

    assert length(result.exact) <= 12
    assert length(result.structural) <= 10
    # The menu/count source stays complete behind the display cap.
    assert length(result.exact_occurrences) == 11
  end

  test "caps apply", %{stats: _stats} do
    result =
      Candidates.generate(TestFixtures.tabiya_key(), exact_limit: 2, limit: 2, bucket_limit: 4)

    assert length(result.exact) == 2
    assert length(result.structural) == 2
  end

  test "the A2 tabiya's structural candidates share its skeleton" do
    result = Candidates.generate(TestFixtures.a2_key())

    assert Enum.map(result.exact, &{&1.gid, &1.ply}) == [{8, 13}, {9, 13}, {10, 13}, {11, 13}]

    ref = result.reference

    assert Enum.all?(result.structural, fn cand ->
             Features.pawn_mismatches(ref, cand.features) == 0
           end)

    # The pre-Re1 position (same skeleton, rook still on f1) is the
    # near-twin of the tabiya — exactly the A2-B4 "unspent tempo" shape.
    assert Enum.any?(
             result.structural,
             &(&1.key == "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQ1RK1 w kq -")
           )
  end
end
