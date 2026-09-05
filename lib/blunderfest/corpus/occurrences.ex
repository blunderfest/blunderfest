defmodule Blunderfest.Corpus.Occurrences do
  @moduledoc """
  The occurrence layer of the `Blunderfest.Corpus` boundary (ADR-0026):
  PostgreSQL-backed, Postgrex directly, no Ecto.

  Holds the derived corpus data the pipeline queries:

      corpus_positions     canonical key → pawn_hash, first occurrence
      corpus_occurrences   canonical key → every (gid, ply) occurrence
      corpus_games         gid → game metadata (12 columns)
      corpus_moves         gid → mainline SAN list

  Everything here is derived from canonical PGNs and is dropped and rebuilt
  by `rebuild/3` from the `Blunderfest.Corpus.Extraction` artifacts
  (`keys-`, `games-`, `moves-N.tsv`) — the PGN → moves → positions → indexes
  invariant. Tables are UNLOGGED (crash recovery is irrelevant for
  rebuildable data).

  Functions take a `conn` (a Postgrex connection or pool, `Postgrex.query!/4`
  accepts both) so the ownership of the pool stays with the facade and tests
  can run against their own database.
  """

  @tables ~w(corpus_positions corpus_occurrences corpus_games corpus_moves)

  @type conn :: pid()

  @doc """
  Drops and rebuilds all corpus tables from the extraction artifacts.
  Idempotent; safe to run any number of times.

  Returns `%{positions: n, occurrences: n, games: n, moves: n}` row counts.
  """
  @spec rebuild(conn(), Path.t(), non_neg_integer()) :: map()
  def rebuild(conn, data_dir, tier) do
    drop_tables(conn)
    create_tables(conn)

    copy_positions(conn, Path.join(data_dir, "keys-#{tier}.tsv"))
    copy_occurrences(conn, Path.join(data_dir, "keys-#{tier}.tsv"))
    copy_games(conn, Path.join(data_dir, "games-#{tier}.tsv"))
    copy_moves(conn, Path.join(data_dir, "moves-#{tier}.tsv"))

    build_indexes(conn)
    analyze(conn)

    counts(conn)
  end

  @doc """
  Loads from *prepared* positions rows — `key \\t pawn_hash \\t gid \\t ply`,
  the pawn-hash transform already applied (see `Mix.Tasks.Corpus.Prepare`).
  This is the production load path: it turns the machine-side work into
  pure COPY, which survives CPU throttling that stalls the hashing stream.
  """
  @spec load_prepared(conn(), Path.t(), Path.t(), Path.t()) :: map()
  def load_prepared(conn, positions_path, games_path, moves_path) do
    drop_tables(conn)
    create_tables(conn)

    copy_positions_prepared(conn, positions_path)
    copy_occurrences(conn, positions_path)
    copy_games(conn, games_path)
    copy_moves(conn, moves_path)

    build_indexes(conn)
    analyze(conn)

    counts(conn)
  end

  @doc "Row counts of the four corpus tables."
  @spec counts(conn()) :: %{
          positions: non_neg_integer(),
          occurrences: non_neg_integer(),
          games: non_neg_integer(),
          moves: non_neg_integer()
        }
  def counts(conn) do
    Map.new(@tables, fn table ->
      %{rows: [[n]]} =
        Postgrex.query!(conn, "SELECT count(*) FROM #{table}", [], timeout: :infinity)

      {table_key(table), n}
    end)
  end

  @doc "Every occurrence of a canonical key as `[{gid, ply}]`, in game/ply order."
  @spec occurrences(conn(), String.t()) :: [{pos_integer(), pos_integer()}]
  def occurrences(conn, key) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT gid, ply FROM corpus_occurrences WHERE key = $1 ORDER BY gid, ply",
        [key],
        timeout: :infinity
      )

    Enum.map(rows, fn [gid, ply] -> {gid, ply} end)
  end

  @doc """
  The first `limit` occurrences of a canonical key in `(gid, ply)` order —
  SQL `LIMIT` keeps a hot key's bounded fetch from scanning the whole run
  into the BEAM (the packed backend's bounded variant decodes the prefix
  the same way).
  """
  @spec occurrences(conn(), String.t(), non_neg_integer()) :: [{pos_integer(), pos_integer()}]
  def occurrences(conn, key, limit) when is_integer(limit) and limit >= 0 do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT gid, ply FROM corpus_occurrences WHERE key = $1 ORDER BY gid, ply LIMIT $2",
        [key, limit],
        timeout: :infinity
      )

    Enum.map(rows, fn [gid, ply] -> {gid, ply} end)
  end

  @doc """
  Total occurrence and independent-game counts for a canonical key, in one
  query (no per-occurrence fetch — the hot-key path stays cheap).
  """
  @spec counts_for(conn(), String.t()) :: %{
          occurrences: non_neg_integer(),
          games: non_neg_integer()
        }
  def counts_for(conn, key) do
    %{rows: [[occ, games]]} =
      Postgrex.query!(
        conn,
        "SELECT COUNT(*), COUNT(DISTINCT gid) FROM corpus_occurrences WHERE key = $1",
        [key],
        timeout: :infinity
      )

    %{occurrences: occ, games: games}
  end

  @doc """
  The first occurrence of a canonical key — `{gid, ply}` or nil — without
  fetching the run: the positions row's `first_gid`/`first_ply` are the
  true minimum `(gid, ply)` by load construction (`DISTINCT ON … ORDER BY
  key, first_gid, first_ply`). Semantics equal
  `occurrences(conn, key) |> List.first()`.
  """
  @spec first_occurrence(conn(), String.t()) :: {pos_integer(), pos_integer()} | nil
  def first_occurrence(conn, key) do
    case position(conn, key) do
      nil -> nil
      %{first_gid: gid, first_ply: ply} -> {gid, ply}
    end
  end

  @doc """
  The position row for a canonical key (`%{pawn_hash, first_gid, first_ply}`)
  or nil when the corpus has never seen the position.
  """
  @spec position(conn(), String.t()) :: map() | nil
  def position(conn, key) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT pawn_hash, first_gid, first_ply FROM corpus_positions WHERE key = $1",
        [key],
        timeout: :infinity
      )

    case rows do
      [[pawn_hash, gid, ply]] ->
        %{key: key, pawn_hash: pawn_hash, first_gid: gid, first_ply: ply}

      [] ->
        nil
    end
  end

  @doc """
  Distinct canonical keys sharing a pawn-skeleton hash (the structural bucket).
  The ORDER BY runs in C collation — the packed backend's binary sort is
  bytewise, and the sorted-contract can't leak libc collation differences
  into candidate-set caps (brief §10).
  """
  @spec pawn_bucket(conn(), non_neg_integer()) :: [String.t()]
  def pawn_bucket(conn, pawn_hash) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT key FROM corpus_positions WHERE pawn_hash = $1 ORDER BY key COLLATE \"C\"",
        [pawn_hash],
        timeout: :infinity
      )

    Enum.map(rows, fn [key] -> key end)
  end

  @doc """
  Bounded bucket fetch: the lexicographically-first `limit` keys (PG's
  `ORDER BY key LIMIT n`). The pipeline caps structural candidates with
  this so a hot bucket never drags the whole key list into the BEAM; the
  packed backend's bounded variant documents its pos-hash-order difference
  explicitly (broadcast validation §17, condition B).
  """
  @spec pawn_bucket(conn(), non_neg_integer(), pos_integer()) :: [String.t()]
  def pawn_bucket(conn, pawn_hash, limit) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT key FROM corpus_positions WHERE pawn_hash = $1 ORDER BY key COLLATE \"C\" LIMIT $2",
        [pawn_hash, limit],
        timeout: :infinity
      )

    Enum.map(rows, fn [key] -> key end)
  end

  @doc "Game metadata for a gid, or nil."
  @spec game(conn(), pos_integer()) :: map() | nil
  def game(conn, gid) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        """
        SELECT white, black, result, date, eco, opening,
               white_elo, black_elo, event, time_control, site
        FROM corpus_games WHERE gid = $1
        """,
        [gid],
        timeout: :infinity
      )

    case rows do
      [[white, black, result, date, eco, opening, welo, belo, event, tc, site]] ->
        %{
          gid: gid,
          white: white,
          black: black,
          result: result,
          date: date,
          eco: eco,
          opening: opening,
          white_elo: welo,
          black_elo: belo,
          event: event,
          time_control: tc,
          site: site
        }

      [] ->
        nil
    end
  end

  @doc "Mainline SAN list of a game (empty when unknown)."
  @spec moves(conn(), pos_integer()) :: [String.t()]
  def moves(conn, gid) do
    %{rows: rows} =
      Postgrex.query!(conn, "SELECT sans FROM corpus_moves WHERE gid = $1", [gid],
        timeout: :infinity
      )

    case rows do
      [[sans]] -> String.split(sans, " ", trim: true)
      [] -> []
    end
  end

  @doc """
  Mainline SAN lists for a batch of gids, one query — `%{gid => sans_list}`.
  The family clustering's per-occurrence continuation fetch stays a single
  round trip (a hot key's bounded occurrence list → one query).
  """
  @spec moves_for(conn(), [pos_integer()]) :: %{pos_integer() => [String.t()]}
  def moves_for(conn, gids) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT gid, sans FROM corpus_moves WHERE gid = ANY($1)",
        [Enum.uniq(gids)],
        timeout: :infinity
      )

    Map.new(rows, fn [gid, sans] -> {gid, String.split(sans, " ", trim: true)} end)
  end

  @doc """
  Game results for a batch of gids, one query — `%{gid => result}`. The
  packed occurrence backend's book aggregation needs results without the
  full metadata rows.
  """
  @spec results_for(conn(), [pos_integer()]) :: %{pos_integer() => String.t()}
  def results_for(conn, gids) do
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT gid, result FROM corpus_games WHERE gid = ANY($1)",
        [Enum.uniq(gids)],
        timeout: :infinity
      )

    Map.new(rows, fn [gid, result] -> {gid, result} end)
  end

  ## Schema

  defp table_key("corpus_positions"), do: :positions
  defp table_key("corpus_occurrences"), do: :occurrences
  defp table_key("corpus_games"), do: :games
  defp table_key("corpus_moves"), do: :moves

  defp drop_tables(conn) do
    for table <- @tables ++ ["corpus_positions_stage"] do
      Postgrex.query!(conn, "DROP TABLE IF EXISTS #{table}", [], timeout: :infinity)
    end
  end

  defp create_tables(conn) do
    statements = [
      """
      CREATE UNLOGGED TABLE corpus_positions (
        key text PRIMARY KEY,
        pawn_hash bigint NOT NULL,
        first_gid integer NOT NULL,
        first_ply smallint NOT NULL
      )
      """,
      """
      CREATE UNLOGGED TABLE corpus_occurrences (
        key text NOT NULL,
        gid integer NOT NULL,
        ply smallint NOT NULL
      )
      """,
      """
      CREATE UNLOGGED TABLE corpus_games (
        gid integer PRIMARY KEY,
        white text NOT NULL,
        black text NOT NULL,
        result text NOT NULL,
        date text NOT NULL,
        eco text NOT NULL,
        opening text NOT NULL,
        white_elo integer,
        black_elo integer,
        event text NOT NULL,
        time_control text NOT NULL,
        site text NOT NULL
      )
      """,
      """
      CREATE UNLOGGED TABLE corpus_moves (
        gid integer PRIMARY KEY,
        sans text NOT NULL
      )
      """
    ]

    Enum.each(statements, &Postgrex.query!(conn, &1, [], timeout: :infinity))
  end

  defp build_indexes(conn) do
    Postgrex.query!(conn, "CREATE INDEX ON corpus_positions (pawn_hash)", [], timeout: :infinity)
    Postgrex.query!(conn, "CREATE INDEX ON corpus_occurrences (key)", [], timeout: :infinity)
  end

  defp analyze(conn) do
    Enum.each(@tables, &Postgrex.query!(conn, "ANALYZE #{&1}", [], timeout: :infinity))
  end

  ## Loading (COPY FROM STDIN, spike 03's proven bulk-load shape)

  defp copy_positions(conn, keys_path) do
    Postgrex.query!(
      conn,
      """
      CREATE UNLOGGED TABLE corpus_positions_stage (
        key text NOT NULL,
        pawn_hash bigint NOT NULL,
        first_gid integer NOT NULL,
        first_ply smallint NOT NULL
      )
      """,
      []
    )

    with_copy(conn, "corpus_positions_stage", fn copy ->
      keys_path
      |> stream_lines()
      |> Stream.map(fn {key, gid, ply} ->
        pawn_hash = key |> pawn_hash() |> Integer.to_string()
        Enum.join([key, pawn_hash, gid, ply], "\t") <> "\n"
      end)
      |> Enum.into(copy)
    end)

    stage_to_positions(conn)
  end

  # Prepared rows already carry the pawn hash (no transform on the
  # loading machine); the columns are laid out like the stage table, so
  # the dedup insert is the same.
  defp copy_positions_prepared(conn, positions_path) do
    Postgrex.query!(
      conn,
      """
      CREATE UNLOGGED TABLE corpus_positions_stage (
        key text NOT NULL,
        pawn_hash bigint NOT NULL,
        first_gid integer NOT NULL,
        first_ply smallint NOT NULL
      )
      """,
      []
    )

    with_copy(conn, "corpus_positions_stage", fn copy ->
      positions_path
      |> File.stream!(:line)
      |> Enum.into(copy)
    end)

    stage_to_positions(conn)
  end

  defp stage_to_positions(conn) do
    # One row per distinct key: the true first occurrence is the minimum
    # (gid, ply). `keys-N.tsv` row order is irrelevant here.
    Postgrex.query!(
      conn,
      """
      INSERT INTO corpus_positions (key, pawn_hash, first_gid, first_ply)
      SELECT DISTINCT ON (key) key, pawn_hash, first_gid, first_ply
      FROM corpus_positions_stage
      ORDER BY key, first_gid, first_ply
      """,
      [],
      timeout: :infinity
    )

    Postgrex.query!(conn, "DROP TABLE corpus_positions_stage", [])
  end

  defp copy_occurrences(conn, source_path) do
    with_copy(conn, "corpus_occurrences", fn copy ->
      source_path
      |> stream_lines()
      |> Stream.map(fn
        {key, gid, ply} -> Enum.join([key, gid, ply], "\t") <> "\n"
        {key, _pawn_hash, gid, ply} -> Enum.join([key, gid, ply], "\t") <> "\n"
      end)
      |> Enum.into(copy)
    end)
  end

  defp copy_games(conn, games_path) do
    with_copy(conn, "corpus_games", fn copy ->
      games_path
      |> File.stream!(:line)
      |> Stream.map(&utf8/1)
      |> Stream.map(&games_row/1)
      |> Enum.into(copy)
    end)
  end

  defp copy_moves(conn, moves_path) do
    with_copy(conn, "corpus_moves", fn copy ->
      moves_path
      |> File.stream!(:line)
      |> Stream.map(&utf8/1)
      |> Enum.into(copy)
    end)
  end

  defp with_copy(conn, table, fun) do
    Postgrex.transaction(
      conn,
      fn tx ->
        copy = Postgrex.stream(tx, "COPY #{table} FROM STDIN", [])
        fun.(copy)
      end,
      timeout: :infinity
    )
  end

  defp stream_lines(path) do
    path
    |> File.stream!(:line)
    |> Stream.map(fn line ->
      case line |> String.trim_trailing("\n") |> String.split("\t") do
        [key, gid, ply] -> {key, gid, ply}
        [key, pawn_hash, gid, ply] -> {key, pawn_hash, gid, ply}
      end
    end)
  end

  # `keys-N.tsv` is in corpus order, so the first row of a key is its first
  # occurrence; the btree on key makes the dedup sort-free.
  defp pawn_hash(key), do: Blunderfest.Corpus.Analysis.Features.pawn_hash(key)

  # "?" means "unknown" in the extraction artifacts; for the integer Elo
  # columns it becomes `\N` (COPY's NULL marker). Other columns keep the "?"
  # marker as text.
  defp games_row(line) do
    case String.split(line, "\t", trim: false) do
      [gid, w, b, r, d, eco, open, welo, belo, ev, tc, site] ->
        Enum.join(
          [gid, w, b, r, d, eco, open, elo(welo), elo(belo), ev, tc, site],
          "\t"
        )

      _ ->
        line
    end
  end

  defp elo("?"), do: "\\N"
  defp elo(v), do: v

  # Some corpus player names carry non-UTF-8 bytes (latin-1); PostgreSQL
  # rejects them for UTF-8 databases. Tolerate at load: fall back to a
  # latin-1 interpretation when a line isn't valid UTF-8.
  defp utf8(s) do
    if String.valid?(s), do: s, else: :unicode.characters_to_binary(s, :latin1, :utf8)
  end
end
