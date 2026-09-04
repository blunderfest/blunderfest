defmodule Blunderfest.Corpus.Search.CountMemoTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Search.CountMemo

  # A counting fetcher: every actual lookup sends the test a message, so a
  # memoized repeat must stay silent.
  defp counting_fetcher(test_pid, table) do
    fn key ->
      send(test_pid, {:fetched, key})
      Map.fetch!(table, key)
    end
  end

  test "a shared key is counted once; the memo carries the result" do
    table = %{"ref" => %{occurrences: 11, games: 8}}
    fetcher = counting_fetcher(self(), table)

    {counts1, memo} = CountMemo.fetch(CountMemo.new(), "ref", fetcher)
    assert counts1 == %{occurrences: 11, games: 8}
    assert_received {:fetched, "ref"}

    # Twelve cards sharing the key: no further fetches.
    {counts2, memo} = CountMemo.fetch(memo, "ref", fetcher)
    {counts3, _memo} = CountMemo.fetch(memo, "ref", fetcher)

    assert counts2 == counts1
    assert counts3 == counts1
    refute_received {:fetched, "ref"}
  end

  test "different keys are counted independently" do
    table = %{
      "a" => %{occurrences: 3, games: 3},
      "b" => %{occurrences: 2, games: 1}
    }

    fetcher = counting_fetcher(self(), table)

    {a, memo} = CountMemo.fetch(CountMemo.new(), "a", fetcher)
    {b, memo} = CountMemo.fetch(memo, "b", fetcher)
    {_a2, _memo} = CountMemo.fetch(memo, "a", fetcher)

    assert a == %{occurrences: 3, games: 3}
    assert b == %{occurrences: 2, games: 1}
    assert_received {:fetched, "a"}
    assert_received {:fetched, "b"}
    # Exactly one fetch per distinct key.
    refute_received {:fetched, _}
  end

  test "facade errors pass through and are not memoized" do
    fetcher = fn _key -> {:error, :not_configured} end

    {error, memo} = CountMemo.fetch(CountMemo.new(), "k", fetcher)
    assert error == {:error, :not_configured}
    assert memo == %{}

    {error2, _memo} = CountMemo.fetch(memo, "k", fetcher)
    assert error2 == {:error, :not_configured}
  end

  test "the memo is request-scoped plain data: new/0 is empty, nothing global" do
    assert CountMemo.new() == %{}
  end
end
