defmodule Blunderfest.Corpus.Search.CountMemo do
  @moduledoc """
  Request-scoped memoization of occurrence counts (Spike 09, Horizon 1).

  One Historical Evidence request asks the same count question several
  times: the reference key (candidate totals + reference stats) and every
  exact card sharing it, plus each structural card's key. The memo is a
  plain map threaded explicitly through the pipeline — canonical key →
  `%{occurrences, games}` — so each distinct key is counted once per
  request. It is created in `Pipeline.analyze/2`, dies with the request,
  and is never shared: no ETS, no application state, no TTL.

  Facade errors (`{:error, :not_configured}`) are passed through without
  being memoized, so callers keep their existing fallback behavior.
  """

  alias Blunderfest.Corpus

  @type counts :: %{occurrences: non_neg_integer(), games: non_neg_integer()}
  @type t :: %{optional(String.t()) => counts()}

  @doc "A fresh, empty memo for one pipeline request."
  @spec new() :: t()
  def new, do: %{}

  @doc """
  The counts for `key`, memoized. Returns `{counts_or_error, memo}` — the
  memo carries any newly stored result, so thread the returned map. The
  `fetcher` default is the corpus facade; tests inject a counting stub.
  """
  @spec fetch(t(), String.t(), (String.t() -> counts() | {:error, term()})) ::
          {counts() | {:error, term()}, t()}
  def fetch(memo, key, fetcher \\ &Corpus.occurrence_counts/1) do
    case Map.fetch(memo, key) do
      {:ok, counts} ->
        {counts, memo}

      :error ->
        case fetcher.(key) do
          %{} = counts -> {counts, Map.put(memo, key, counts)}
          {:error, _} = error -> {error, memo}
        end
    end
  end
end
