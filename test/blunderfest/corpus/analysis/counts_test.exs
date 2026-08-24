defmodule Blunderfest.Corpus.Analysis.CountsTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.Counts

  test "counts separates occurrences from independent games" do
    assert Counts.counts([]) == %{occurrences: 0, games: 0}
    assert Counts.counts([{1, 10}, {2, 5}]) == %{occurrences: 2, games: 2}
    assert Counts.counts([{1, 10}, {1, 20}, {2, 5}]) == %{occurrences: 3, games: 2}
  end

  test "same_game_only? requires repetition within one game" do
    refute Counts.same_game_only?([])
    refute Counts.same_game_only?([{1, 10}])
    refute Counts.same_game_only?([{1, 10}, {2, 5}])
    assert Counts.same_game_only?([{1, 10}, {1, 20}])
    assert Counts.same_game_only?([{1, 10}, {1, 20}, {1, 30}])
  end

  test "singleton? is the one-game family flag" do
    refute Counts.singleton?(0)
    assert Counts.singleton?(1)
    refute Counts.singleton?(2)
  end
end
