defmodule Blunderfest.Corpus.Analysis.RouteTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.Route

  # The B1 tempo-twin pair from the research fixture: the reference reaches
  # the F1 tabiya via 4.e4 at ply 16; the B1 game plays 4.e3 … 9.e4 and
  # reaches the same placement (black to move) at ply 17.
  @ref_moves ~w(d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7)
  @b1_moves ~w(d4 Nf6 c4 g6 Nc3 Bg7 e3 O-O Nf3 d6 Be2 Nc6 O-O e5 d5 Ne7 e4)

  test "B1: shared 6 plies, divergence at ply 7 (e4 vs e3), candidate one ply later" do
    route = Route.compare(@ref_moves, 16, @b1_moves, 17)

    assert route.shared_plies == 6
    assert route.diverged_ply == 7
    assert route.ref_move == "e4"
    assert route.cand_move == "e3"
    assert route.ply_gap == 1
    assert route.ref_ply == 16
    assert route.cand_ply == 17

    # The white tempo reading: the candidate spent an extra e3, while e4
    # exists in both segments (played one ply later) — so it cancels out.
    assert route.extra.white == ["e3"]
    assert route.missing.white == []
  end

  test "identical routes share everything and diverge nowhere within the plies" do
    moves = ~w(e4 e5 Nf3 Nc6 Bb5 a6)
    route = Route.compare(moves, 6, moves, 6)

    assert route.shared_plies == 6
    assert route.ref_move == nil
    assert route.cand_move == nil
    assert route.ply_gap == 0
    assert route.extra == %{white: [], black: []}
  end

  test "per-side segments and multiset diffs" do
    # Same opening, then reference takes a black tempo elsewhere.
    ref = ~w(d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7)
    cand = ~w(d4 d5 c4 e6 Nf3 Nf6 Bg5 Be7)

    route = Route.compare(ref, 8, cand, 8)

    assert route.shared_plies == 4
    assert route.diverged_ply == 5
    assert route.ref_move == "Nc3"
    assert route.cand_move == "Nf3"
    assert route.extra.white == ["Nf3"]
    assert route.missing.white == ["Nc3"]
    assert route.extra.black == []
  end

  test "a bare-FEN analysis fills only the candidate side" do
    route = Route.compare(nil, nil, @b1_moves, 17)

    assert route.shared_plies == 0
    assert route.diverged_ply == nil
    assert route.ref_move == nil
    assert route.ref_ply == nil
    assert route.cand_segment.white != []
    assert route.cand_segment.black != []
    assert route.cand_move == "e4"
  end
end
