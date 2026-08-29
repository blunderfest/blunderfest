defmodule Blunderfest.Corpus.Analysis.DecisionMenu do
  @moduledoc """
  The next-move distribution of a reference position — the **decision
  menu** as a raw, correct historical fact (product experiment 01).

  This is deliberately *not* the continuation-family clustering of
  `Families`: Spike 07 measured that clustering chain genuinely different
  directions together under the slice-wide settings (A2: 68/71 games in one
  family; Najdorf: 445/477), so families are not yet a reliable overview.
  The next-move distribution has no such failure: it counts what was
  actually played next.

  The count is **independent games**, not occurrences (functional design
  §15.6): a game that reaches the same position twice — and plays the same
  next move both times, or a different move each time — contributes its
  gid once to each distinct first move (a `MapSet` per move). The family
  pipeline cannot produce this: it drops the gid before clustering, so
  members carry occurrence counts only. That is why this module computes
  the distribution from the raw `{gid, ply, sans}` occurrence entries
  before `Families.build` ever sees them.
  """

  @type entry :: {pos_integer(), pos_integer(), [String.t()]}
  @type row :: %{move: String.t(), games: pos_integer()}

  @doc """
  Builds the next-move distribution from `{gid, ply, sans}` occurrence
  entries (the same triples `Families.build/2` consumes). Returns rows
  `%{move, games}` sorted by independent-game count descending, ties broken
  by move name (stable, deterministic — brief §8). Occurrences whose
  continuation is empty (terminal positions) contribute nothing.
  """
  @spec build([entry()]) :: [row()]
  def build(entries) do
    acc = reduce(entries)

    acc
    |> Enum.map(fn {move, gids} -> %{move: move, games: MapSet.size(gids)} end)
    |> Enum.sort_by(fn row -> {-row.games, row.move} end)
  end

  # Reduce entries to `%{move => MapSet(gids)}`. Public so pipeline tests
  # can pin the merge semantics directly (the {gid,ply} dedupe below).
  @doc false
  @spec reduce([entry()]) :: %{String.t() => MapSet.t(pos_integer())}
  def reduce(entries) do
    Enum.reduce(entries, %{}, fn {gid, _ply, sans}, acc ->
      case sans do
        [] -> acc
        [move | _] -> Map.update(acc, move, MapSet.new([gid]), &MapSet.put(&1, gid))
      end
    end)
  end

  @doc """
  Applies this accumulation to a raw occurrence list `[{gid, ply}]` and a
  move-fetching function (e.g. `Corpus.moves/1`). Two guards against
  double-counting weirdness from non-corpus sources:

    * the same `(gid, ply)` pair twice is only counted once;
    * unknown/unfetchable game ids are skipped.
  """
  @spec from_occurrences([{pos_integer(), pos_integer()}], (pos_integer() -> [String.t()])) :: [
          row()
        ]
  def from_occurrences(occurrences, moves_fun) do
    occurrences
    |> Enum.uniq()
    |> Enum.flat_map(fn {gid, ply} ->
      case safe_moves(moves_fun, gid) do
        {:ok, sans} -> [{gid, ply, Enum.drop(sans, ply)}]
        :skip -> []
      end
    end)
    |> build()
  end

  # `Corpus.moves` returns the SAN list, `nil`, or `{:error, :not_configured}`;
  # only a real list continues (unknown gids are skipped silently).
  defp safe_moves(fun, gid) do
    case fun.(gid) do
      sans when is_list(sans) -> {:ok, sans}
      _ -> :skip
    end
  end
end
