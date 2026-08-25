defmodule Blunderfest.HistoricalEvidenceTest do
  # async: false — the corpus tables are rebuilt from the research fixture.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.{Extraction, TestFixtures}
  alias Blunderfest.HistoricalEvidence

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)
    corpus = Path.join(dir, "fixture.pgn")
    File.write!(corpus, TestFixtures.pgn())

    out = Path.join(dir, "extracted")
    Extraction.run(corpus, games: 13, out_dir: out)
    Blunderfest.Corpus.rebuild(out, 13)

    :ok
  end

  test "rejects an invalid FEN" do
    assert {:error, {:invalid_fen, _}} = HistoricalEvidence.analyze("not a fen")
  end

  test "accepts a full FEN and returns a serializable result" do
    fen = TestFixtures.tabiya_key() <> " 0 1"
    assert {:ok, result} = HistoricalEvidence.analyze(fen)

    assert Jason.encode!(result)

    assert result.reference.fen == fen
    assert result.reference.occurrences == 11
    assert result.reference.games == 8
    assert length(result.reference.families) == 4
    assert length(result.candidates) > 0
  end

  test "B1 through the service: tempo twin, route divergence, black-side join" do
    ref =
      ~w(d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Ne8 Nd3 f5 Bd2 Kh8 Rc1 a5)

    assert {:ok, result} =
             HistoricalEvidence.analyze(
               TestFixtures.tabiya_key() <> " 0 1",
               reference_moves: ref,
               ref_ply: 16,
               limit: 100,
               scan_limit: 200,
               exact_limit: 100
             )

    b1 = Enum.find(result.candidates, &(&1.gid == 5))

    assert :tempo_twin in b1.flags
    assert b1.route.shared_plies == 6
    assert b1.route.ref_move == "e4"
    assert b1.route.cand_move == "e3"
    assert b1.route.ply_gap == 1

    assert b1.families.membership.status == :none
    assert b1.families.skeleton.black.status == :member
    assert b1.families.skeleton.black.family_games >= 2
    assert b1.families.skeleton.white.status == :none

    # The API exposes facts, not interpretations (brief §17).
    assert is_list(b1.route.extra_white)
    assert is_map(b1.position.dims)
    refute Map.has_key?(b1, :relevance)
  end

  test "the same-game structural candidate is exposed with counts and flags" do
    assert {:ok, result} =
             HistoricalEvidence.analyze(TestFixtures.tabiya_key() <> " 0 1",
               limit: 100,
               scan_limit: 200
             )

    sg = Enum.find(result.candidates, &(&1.fen == TestFixtures.same_game_key() <> " 0 1"))

    assert sg.historical == %{occurrences: 2, games: 1, same_game_only: true}
    assert :same_game_only in sg.flags
  end

  test "singleton families are marked in the menu" do
    assert {:ok, result} = HistoricalEvidence.analyze(TestFixtures.tabiya_key() <> " 0 1")

    assert Enum.count(result.reference.families, & &1.singleton) == 1
  end

  test "a bare canonical key works too" do
    assert {:ok, _result} = HistoricalEvidence.analyze(TestFixtures.a2_key())
  end

  test "tuple-valued dimension facts serialize as lists" do
    # The fixture's gid-1 structural candidate (Ne1 sideline, black to
    # move) has differing castling rights vs the tabiya.
    {:ok, result} =
      HistoricalEvidence.analyze(TestFixtures.tabiya_key() <> " 0 1")

    assert Jason.encode!(result)

    cand = Enum.find(result.candidates, &(&1.gid == 5))
    assert cand.position.dims.side_to_move == :differs

    # Force a castling-differs shape through the encoder: analyze a
    # castling-variant of the A2 tabiya (castling q). The real tabiya
    # (castling kq) is its structural twin — same skeleton, differing
    # rights.
    {:ok, a2} =
      HistoricalEvidence.analyze("r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b q -")

    twin = Enum.find(a2.candidates, &(&1.fen == TestFixtures.a2_key() <> " 0 1"))

    # JSON encodes atoms as strings, so the wire form is
    # ["differs", "q", "kq"] — the internal list keeps the atom.
    assert twin.position.dims.castling == [:differs, "q", "kq"]
    assert Jason.encode!(twin) =~ "[\"differs\",\"q\",\"kq\"]"
  end
end
