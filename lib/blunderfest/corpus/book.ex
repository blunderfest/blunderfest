defmodule Blunderfest.Corpus.Book do
  @moduledoc """
  Per-position opening-book statistics: for the position's canonical key,
  how many independent games continue with each next move, and how those
  games ended (white/draw/black). The corpus-side half of the phase-aware
  book (ADR-0024 as amended; v0's W/D/B rate bars).

  Counts are **independent games**, not occurrences — a game that reaches
  the position twice and plays the same move both times counts once (a
  `MapSet` per move), matching the decision menu's convention.
  """

  alias Blunderfest.Corpus.PositionKey

  @type row :: %{
          move: String.t(),
          games: non_neg_integer(),
          white: non_neg_integer(),
          draw: non_neg_integer(),
          black: non_neg_integer()
        }

  @doc """
  The next-move stats for a FEN. Returns `{:error, :not_configured}`
  without a corpus, and `[]` for a position with no occurrences.
  """
  @spec for_fen(Postgrex.conn(), String.t()) :: [row()] | {:error, :invalid_fen}
  def for_fen(conn, fen) do
    case PositionKey.from_fen(fen) do
      {:error, _} -> {:error, :invalid_fen}
      {:ok, key} -> for_key(conn, key)
    end
  end

  defp for_key(conn, key) do
    # Every occurrence of the position; per game, the move played next and
    # the game's result. Games that reach the position repeatedly collapse
    # to one row per (gid, move) before counting.
    %Postgrex.Result{rows: rows} =
      Postgrex.query!(
        conn,
        """
        SELECT DISTINCT o.gid, o.ply, m.sans, g.result
        FROM corpus_occurrences o
        JOIN corpus_moves m ON m.gid = o.gid
        JOIN corpus_games g ON g.gid = o.gid
        WHERE o.key = $1
        """,
        [key],
        timeout: :infinity
      )

    rows
    |> Enum.flat_map(fn [gid, ply, sans_json, result] ->
      case next_move(sans_json, ply) do
        nil -> []
        move -> [{gid, move, result}]
      end
    end)
    |> Enum.uniq()
    |> Enum.reduce(%{}, fn {gid, move, result}, acc ->
      {w, d, b} = {win_for_white(result), draw(result), win_for_black(result)}

      Map.update(acc, move, %{games: MapSet.new([gid]), w: w, d: d, b: b}, fn e ->
        %{
          e
          | games: MapSet.put(e.games, gid),
            w: e.w + w,
            d: e.d + d,
            b: e.b + b
        }
      end)
    end)
    |> Enum.map(fn {move, e} ->
      games = MapSet.size(e.games)
      %{move: move, games: games, white: e.w, draw: e.d, black: e.b}
    end)
    |> Enum.sort_by(fn row -> {-row.games, row.move} end)
  end

  @doc """
  Independent-game counts for a batch of canonical keys, in one query —
  the transposition candidates' support (`%{key => games}`). Keys with no
  occurrences are absent from the map.
  """
  @spec counts_for_keys(Postgrex.conn(), [String.t()]) :: %{String.t() => non_neg_integer()}
  def counts_for_keys(_conn, []), do: %{}

  def counts_for_keys(conn, keys) do
    %Postgrex.Result{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT key, COUNT(DISTINCT gid) FROM corpus_occurrences WHERE key = ANY($1) GROUP BY key",
        [keys],
        timeout: :infinity
      )

    Map.new(rows, fn [key, count] -> {key, count} end)
  end

  # The move played next: the SAN at index `ply` of the game's mainline
  # (the occurrence's ply is the 0-indexed position, so the next move is
  # `sans[ply]`). Terminal positions (no next move) contribute nothing.
  defp next_move(sans, ply) do
    sans |> String.split(" ", trim: true) |> Enum.at(ply)
  end

  # Result → 1/0/0 tallies per side. "*" and unrecorded results count as
  # draws (neither side won) so the bar still totals 100%.
  defp win_for_white("1-0"), do: 1
  defp win_for_white(_), do: 0
  defp win_for_black("0-1"), do: 1
  defp win_for_black(_), do: 0
  defp draw(result), do: if(result in ["1-0", "0-1"], do: 0, else: 1)
end
