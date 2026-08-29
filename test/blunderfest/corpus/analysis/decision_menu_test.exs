defmodule Blunderfest.Corpus.Analysis.DecisionMenuTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.DecisionMenu

  # Continuation entries mirror the fixture's A2 tabiya (gids 8–11): two
  # Closed (…d6), two Marshall (…O-O). Family clustering chains these two
  # branches together under the slice-wide settings (Spike 07) — the
  # decision-menu distribution must keep them separate regardless.
  defp a2_entries do
    [
      {8, 13, ~w(d6 c3 O-O d4 Bg4)},
      {9, 13, ~w(d6 c3 O-O d4 Bg4)},
      {10, 13, ~w(O-O c3 d5 exd5)},
      {11, 13, ~w(O-O c3 d5 exd5)}
    ]
  end

  test "next-move distribution: independent-game counts per first move" do
    rows = DecisionMenu.build(a2_entries())

    # Ordered by count desc, tie broken by move name: O-O 2, d6 2.
    assert [%{move: "O-O", games: 2}, %{move: "d6", games: 2}] = rows
  end

  test "a repeated occurrence within one game does not double-count" do
    entries = [
      # gid 12 reaches the position at plies 16 and 20, playing "Ne1" then.
      {12, 16 + 2, ~w(Bd2 g5)},
      {1, 16, ~w(Ne1 Ne8)},
      {12, 16, ~w(Ne1 Ne8)},
      {2, 16, ~w(b4 a5)},
      {12, 20, ~w(Bd2 g5)}
    ]

    rows = DecisionMenu.build(entries)
    counts = Map.new(rows, &{&1.move, &1.games})

    # gid 12 contributes to "Ne1" (ply-16 hit) and "Bd2" (ply-20 hit) once
    # each; gids 1, 2 hit once. The (gid,ply) duplicates never multiply.
    assert counts["Ne1"] == 2
    assert counts["Bd2"] == 1
    assert counts["b4"] == 1
  end

  test "ordering: games desc, ties by move name (deterministic)" do
    rows =
      DecisionMenu.build([
        {1, 0, ~w(c4)},
        {2, 0, ~w(Ne1)},
        {3, 0, ~w(b4)},
        {4, 0, ~w(c4)}
      ])

    assert [%{move: "c4", games: 2}, %{move: "Ne1", games: 1}, %{move: "b4", games: 1}] = rows
    # the tie between Ne1/b4/c4 resolves by name, so the order is stable.
    assert [%{move: "c4", games: 2}, %{move: "Ne1", games: 1}, %{move: "b4", games: 1}] =
             DecisionMenu.build([
               {4, 0, ~w(c4)},
               {3, 0, ~w(b4)},
               {2, 0, ~w(Ne1)},
               {1, 0, ~w(c4)}
             ])
  end

  test "empty continuations contribute nothing (terminal positions)" do
    assert DecisionMenu.build([{1, 3, []}, {2, 4, []}]) == []
    assert DecisionMenu.from_occurrences([{1, 3}, {2, 4}], fn _gid -> [] end) == []
  end

  test "from_occurrences dedupes identical (gid, ply) pairs and skips unknown gids" do
    moves_fun = fn
      1 -> ~w(d4 Nf6 Ne1 Ne8)
      2 -> ~w(d4 Nf6 b4 a5)
      _ -> []
    end

    rows =
      DecisionMenu.from_occurrences(
        [{1, 2}, {2, 2}, {1, 2}, {2, 2}, {99, 2}, {1, 2}],
        moves_fun
      )

    counts = Map.new(rows, &{&1.move, &1.games})
    # gid 1 (Ne1), gid 2 (b4): each once, gid 99 (no moves) skipped.
    assert counts["Ne1"] == 1
    assert counts["b4"] == 1
    assert length(rows) == 2
  end
end
