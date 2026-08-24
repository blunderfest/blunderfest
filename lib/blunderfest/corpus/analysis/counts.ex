defmodule Blunderfest.Corpus.Analysis.Counts do
  @moduledoc """
  Occurrence counts and the evidence flags (design brief §12–13).

  Occurrences and independent games must never be conflated:

      27 occurrences / 19 independent games   — recurring evidence
      27 occurrences / 1 independent game     — a repetition, not evidence

  `same_game_only?/1` identifies candidates that are only repeated
  positions from the same game (a structural search otherwise returns the
  reference game itself a few plies later — superficially excellent,
  historically useless). `singleton?/1` is the family-level companion: a
  one-game continuation must not be presented as an independent historical
  example (the concrete Spike 05 failure).

  Inputs are occurrence lists `[{gid, ply}]` or independent-game counts.
  """

  @doc """
  `%{occurrences: n, games: m}` — the total number of occurrences and the
  number of independent games supporting them.
  """
  @spec counts([{pos_integer(), pos_integer()}]) :: %{
          occurrences: non_neg_integer(),
          games: non_neg_integer()
        }
  def counts(occurrences) do
    %{
      occurrences: length(occurrences),
      games: occurrences |> Enum.map(fn {gid, _ply} -> gid end) |> MapSet.new() |> MapSet.size()
    }
  end

  @doc """
  True when every occurrence comes from a single game — the candidate is
  "the same game a few plies later", not an independent example.
  """
  @spec same_game_only?([{pos_integer(), pos_integer()}]) :: boolean()
  def same_game_only?(occurrences) do
    %{occurrences: n, games: games} = counts(occurrences)
    n > 1 and games == 1
  end

  @doc """
  True for a one-game continuation (family-level): a singleton must not be
  presented as historical evidence of a recurring pattern.
  """
  @spec singleton?(non_neg_integer()) :: boolean()
  def singleton?(games), do: games == 1
end
