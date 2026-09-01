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

  alias Blunderfest.Corpus.{Occurrences, PositionKey}
  alias Blunderfest.Corpus.Packed

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
    # Aggregate in SQL rather than pulling every occurrence row into the
    # BEAM: one row per (move, result) comes back, so a hot position costs
    # a handful of rows instead of thousands. The two-stage DISTINCT keeps
    # the independent-games convention — a game that reaches the position
    # repeatedly (or plays the same move twice) counts once.
    %Postgrex.Result{rows: rows} =
      Postgrex.query!(
        conn,
        """
        WITH per_game AS (
         SELECT DISTINCT o.gid, o.ply, m.sans, g.result
         FROM corpus_occurrences o
         JOIN corpus_moves m ON m.gid = o.gid
         JOIN corpus_games g ON g.gid = o.gid
         WHERE o.key = $1
        ), dedup AS (
         SELECT DISTINCT gid, split_part(sans, ' ', ply + 1) AS move, result
         FROM per_game
         WHERE split_part(sans, ' ', ply + 1) <> ''
        )
        SELECT move,
               count(*) AS games,
               count(*) FILTER (WHERE result = '1-0') AS white,
               count(*) FILTER (WHERE result <> '1-0' AND result <> '0-1') AS draw,
               count(*) FILTER (WHERE result = '0-1') AS black
        FROM dedup
        GROUP BY move
        ORDER BY games DESC, move COLLATE "C"
        """,
        [key],
        timeout: :infinity
      )

    # "*" and unrecorded results count as draws (the draw FILTER above) so
    # the bar still totals 100%.
    Enum.map(rows, fn [move, games, white, draw, black] ->
      %{move: move, games: games, white: white, draw: draw, black: black}
    end)
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

  @doc """
  The packed-mode book aggregate (currently unused by the facade in the
  PG-coexistence window — `for_fen/2` chooses the SQL aggregate when the
  occurrence tables exist). The facade's `:packed` occurrence backend
  becomes truthful when the tables drop: one packed occurrence scan plus
  batched Postgres `moves_for`/`results_for` queries, keyed by canonical
  key. The parity check runs the exact same implementation as the facade
  route.
  """
  @spec for_key_packed(Packed.t(), Postgrex.conn(), String.t()) :: [row()]
  def for_key_packed(backend, conn, key) do
    occurrences = Packed.occurrences(backend, PositionKey.to_hash128(key))
    gids = occurrences |> Enum.map(&elem(&1, 0)) |> Enum.uniq()
    moves_map = Occurrences.moves_for(conn, gids)
    results = Occurrences.results_for(conn, gids)

    occurrences
    |> Enum.flat_map(fn {gid, ply} ->
      case moves_map |> Map.get(gid, []) |> Enum.at(ply) do
        nil -> []
        move -> [{gid, move}]
      end
    end)
    |> Enum.uniq()
    |> Enum.group_by(&elem(&1, 1))
    |> Enum.map(fn {move, pairs} ->
      {white, draw, black} =
        Enum.reduce(pairs, {0, 0, 0}, fn {gid, _move}, {w, d, b} ->
          case Map.get(results, gid) do
            "1-0" -> {w + 1, d, b}
            "0-1" -> {w, d, b + 1}
            _ -> {w, d + 1, b}
          end
        end)

      %{move: move, games: length(pairs), white: white, draw: draw, black: black}
    end)
    |> Enum.sort_by(fn row -> {-row.games, row.move} end)
  end
end
