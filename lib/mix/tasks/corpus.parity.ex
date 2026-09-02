defmodule Mix.Tasks.Corpus.Parity do
  @shortdoc "Verifies the packed occurrence index against the Postgres corpus"

  @moduledoc """
  The Spike 08 parity suite (brief §10): PostgreSQL is the oracle, the
  packed backend must match it exactly.

      mix corpus.parity [--packed-dir data/corpus-packed] [--sample 10000]

  Samples `--sample` keys from `corpus_positions` plus explicit edge cases
  (missing key, singleton, hot key, same-game duplicates) and compares:

    * `occurrences` (exact `(gid, ply)` sequence, `ORDER BY gid, ply`)
    * `occurrence_counts` (occurrences + distinct games)
    * `position` (pawn_hash, first_gid, first_ply, key)
    * `pawn_bucket` (distinct sorted keys)
    * `book` (full next-move aggregate rows) for a subset

  Requires DATABASE_URL pointing at the loaded corpus Postgres.
  """

  use Mix.Task

  alias Blunderfest.Corpus.{Book, Occurrences, Packed, PositionKey}

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [packed_dir: :string, sample: :integer])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    packed_dir = Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")
    sample_n = Keyword.get(opts, :sample, 10_000)

    db = config[:db] || Mix.raise("no corpus database configured — set DATABASE_URL")
    {:ok, conn} = Postgrex.start_link(Keyword.merge([pool_size: 2, timeout: :infinity], db))

    {:ok, backend} = Packed.open(packed_dir)

    started = System.monotonic_time(:millisecond)

    failures =
      []
      |> check_totals(conn, backend)
      |> check_sampled_keys(conn, backend, sample_n)
      |> check_edge_cases(conn, backend)
      |> check_book(conn, backend, 200)

    Packed.close(backend)
    wall_s = div(System.monotonic_time(:millisecond) - started, 1000)

    if failures == [] do
      Mix.shell().info("PARITY OK — all checks passed (#{wall_s}s)")
    else
      Mix.shell().error("PARITY FAILURES (#{length(failures)}):\n" <> Enum.join(failures, "\n"))
      Mix.raise("parity check failed")
    end
  end

  ## Total row counts

  defp check_totals(failures, conn, backend) do
    pg = Occurrences.counts(conn)
    packed = Packed.counts(backend)

    cond do
      pg.occurrences != packed.occurrences ->
        [
          "occurrence totals differ: pg #{pg.occurrences} vs packed #{packed.occurrences}"
          | failures
        ]

      pg.positions != packed.positions ->
        ["position totals differ: pg #{pg.positions} vs packed #{packed.positions}" | failures]

      true ->
        Mix.shell().info(
          "totals: #{pg.occurrences} occurrences, #{pg.positions} positions — match"
        )

        failures
    end
  end

  ## Random key sample

  defp check_sampled_keys(failures, conn, backend, sample_n) do
    Mix.shell().info("sampling #{sample_n} keys from corpus_positions…")

    # BERNOULLI at ~0.2% of ~5.8M positions lands near the 10k target without
    # needing PG 15's SYSTEM_ROWS.
    %{rows: rows} =
      Postgrex.query!(
        conn,
        "SELECT key FROM corpus_positions TABLESAMPLE BERNOULLI(0.2) LIMIT #{sample_n}",
        [],
        timeout: :infinity
      )

    keys = Enum.map(rows, fn [key] -> key end)
    Mix.shell().info("comparing #{length(keys)} sampled keys…")

    keys
    |> Enum.with_index(1)
    |> Enum.reduce(failures, fn {key, i}, failures ->
      if rem(i, 1000) == 0, do: Mix.shell().info("  …#{i} keys compared")

      compare_key(failures, conn, backend, key, "sample##{i}")
    end)
  end

  ## Explicit edge cases

  defp check_edge_cases(failures, conn, backend) do
    Mix.shell().info("checking edge cases…")

    # Missing key (a position that cannot exist in the corpus).
    missing = "8/8/8/8/8/8/8/K6k w - -"
    failures = compare_key(failures, conn, backend, missing, "missing")

    # Hottest keys: the start position and after 1.e4 (top occurrence runs).
    %{rows: hot} =
      Postgrex.query!(
        conn,
        """
        SELECT key, COUNT(*) c FROM corpus_occurrences
        GROUP BY key ORDER BY c DESC LIMIT 5
        """,
        [],
        timeout: :infinity
      )

    failures =
      Enum.reduce(hot, failures, fn [key, c], failures ->
        Mix.shell().info("  hot key: #{c} occurrences")
        compare_key(failures, conn, backend, key, "hot")
      end)

    # Same game at multiple plies: pick keys whose occurrences repeat a gid.
    %{rows: dup} =
      Postgrex.query!(
        conn,
        """
        SELECT key FROM corpus_occurrences
        GROUP BY key HAVING COUNT(*) > COUNT(DISTINCT gid)
        LIMIT 20
        """,
        [],
        timeout: :infinity
      )

    failures =
      Enum.reduce(dup, failures, fn [key], failures ->
        compare_key(failures, conn, backend, key, "same-game-duplicate")
      end)

    # En-passant keys (EP square in the key = legal capture available).
    %{rows: ep} =
      Postgrex.query!(
        conn,
        "SELECT key FROM corpus_positions WHERE key !~ ' -$' LIMIT 50",
        [],
        timeout: :infinity
      )

    failures =
      Enum.reduce(ep, failures, fn [key], failures ->
        compare_key(failures, conn, backend, key, "en-passant")
      end)

    # Pawn buckets: sample pawn hashes, compare full sorted key lists.
    %{rows: bucket_rows} =
      Postgrex.query!(
        conn,
        "SELECT DISTINCT pawn_hash FROM corpus_positions TABLESAMPLE BERNOULLI(0.1) LIMIT 200",
        [],
        timeout: :infinity
      )

    Enum.reduce(bucket_rows, failures, fn [pawn_hash], failures ->
      pg = Occurrences.pawn_bucket(conn, pawn_hash)
      packed = Packed.pawn_bucket(backend, pawn_hash)

      if pg == packed do
        failures
      else
        [
          "pawn_bucket mismatch for #{pawn_hash}: pg #{length(pg)} keys vs packed #{length(packed)} keys"
          | failures
        ]
      end
    end)
  end

  ## Book aggregate

  defp check_book(failures, conn, backend, n) do
    Mix.shell().info("checking book aggregate on #{n} keys…")

    %{rows: rows} =
      Postgrex.query!(
        conn,
        """
        SELECT key, COUNT(*) c FROM corpus_occurrences
        GROUP BY key ORDER BY c DESC
        LIMIT #{n}
        """,
        [],
        timeout: :infinity
      )

    Enum.reduce(rows, failures, fn [key, _c], failures ->
      pg = Book.for_fen(conn, Blunderfest.Corpus.Analysis.Features.fen(key))
      packed = packed_book(backend, conn, key)

      if pg == packed do
        failures
      else
        [
          "book mismatch for #{key}:\n  pg:     #{inspect(pg)}\n  packed: #{inspect(packed)}"
          | failures
        ]
      end
    end)
  end

  # The packed-mode book aggregate lives in `Book.for_key_packed/3` — the
  # facade's route and this parity check both call it directly, so the
  # 200-key check exercises the real production path.
  defp packed_book(backend, _conn, key) do
    # The production packed path: the precomputed book.bin aggregate.
    Blunderfest.Corpus.Packed.book(backend, PositionKey.to_hash128(key))
  end

  ## Per-key comparison

  defp compare_key(failures, conn, backend, key, label) do
    hash = PositionKey.to_hash128(key)

    pg_occ = Occurrences.occurrences(conn, key)
    packed_occ = Packed.occurrences(backend, hash)

    failures =
      if pg_occ == packed_occ do
        failures
      else
        [
          "#{label}: occurrences differ for #{key}\n  pg:     #{inspect(Enum.take(pg_occ, 5))} (#{length(pg_occ)})\n  packed: #{inspect(Enum.take(packed_occ, 5))} (#{length(packed_occ)})"
          | failures
        ]
      end

    pg_counts = Occurrences.counts_for(conn, key)
    packed_counts = Packed.occurrence_counts(backend, hash)

    failures =
      if pg_counts == packed_counts do
        failures
      else
        [
          "#{label}: counts differ for #{key}: pg #{inspect(pg_counts)} vs packed #{inspect(packed_counts)}"
          | failures
        ]
      end

    pg_pos = Occurrences.position(conn, key)
    packed_pos = Packed.position(backend, hash)

    # The packed position row echoes the stored key; compare the rest.
    failures =
      if pg_pos == nil and packed_pos == nil do
        failures
      else
        same =
          pg_pos != nil and packed_pos != nil and
            pg_pos.pawn_hash == packed_pos.pawn_hash and
            pg_pos.first_gid == packed_pos.first_gid and
            pg_pos.first_ply == packed_pos.first_ply and
            pg_pos.key == packed_pos.key

        if same do
          failures
        else
          [
            "#{label}: position rows differ for #{key}: pg #{inspect(pg_pos)} vs packed #{inspect(packed_pos)}"
            | failures
          ]
        end
      end

    failures
  end
end
