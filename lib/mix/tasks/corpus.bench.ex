defmodule Mix.Tasks.Corpus.Bench do
  @shortdoc "Benchmarks the packed occurrence index against the Postgres corpus"

  @moduledoc """
  The Spike 08 measurement harness (brief §§5, 7, 11, 12):

      mix corpus.bench [--packed-dir data/corpus-packed] [--lookups 5000]

  Reports:

    * **storage** — PG relation sizes (table + index) vs packed file sizes;
    * **stride sweep** — sparse-anchor size and lookup latency at strides
      256 / 1024 / 4096 / 16384;
    * **lookup latency** — p50/p95/p99/max for PG vs packed over a mixed
      workload (missing / cold / repeated / hot keys), split into
      key-location-only and full-occurrence-retrieval;
    * **hot-key behavior** — location vs materialization cost for the
      hottest keys in the corpus.

  Requires DATABASE_URL pointing at the loaded corpus Postgres.
  """

  use Mix.Task

  alias Blunderfest.Corpus.{Occurrences, Packed, PositionKey}
  alias Blunderfest.Corpus.Packed.Segment

  @requirements ["app.start"]

  @impl Mix.Task
  def run(args) do
    {opts, _rest} =
      OptionParser.parse!(args, strict: [packed_dir: :string, lookups: :integer])

    config = Application.get_env(:blunderfest, Blunderfest.Corpus, [])
    packed_dir = Keyword.get(opts, :packed_dir, config[:packed_dir] || "data/corpus-packed")
    n_lookups = Keyword.get(opts, :lookups, 5_000)

    db = config[:db] || Mix.raise("no corpus database configured — set DATABASE_URL")
    {:ok, conn} = Postgrex.start_link(Keyword.merge([pool_size: 2, timeout: :infinity], db))

    {:ok, backend} = Packed.open(packed_dir)

    out = []
    out = [storage_report(conn, backend) | out]
    out = [stride_sweep(packed_dir) | out]
    out = [latency_report(conn, backend, n_lookups) | out]
    out = [hot_key_report(conn, backend) | out]

    Packed.close(backend)

    Mix.shell().info(out |> Enum.reverse() |> Enum.join("\n\n"))
  end

  ## §11 Storage

  defp storage_report(conn, backend) do
    sizes =
      Map.new(
        ~w(corpus_positions corpus_occurrences corpus_games corpus_moves),
        fn table ->
          %{rows: [[total]]} =
            Postgrex.query!(conn, "SELECT pg_total_relation_size('#{table}')", [])

          %{rows: [[rel]]} =
            Postgrex.query!(conn, "SELECT pg_relation_size('#{table}')", [])

          {table, %{total: total, table: rel, index: total - rel}}
        end
      )

    packed_counts = Packed.counts(backend)
    pg_counts = Occurrences.counts(conn)

    # File sizes come from the manifest entries — recompute from disk.
    packed_files =
      Path.wildcard(Path.join(backend.dir, "**/*.bin"))
      |> Map.new(fn path -> {path, File.stat!(path).size} end)

    packed_total = packed_files |> Map.values() |> Enum.sum()

    anchor_bytes =
      backend.segments
      |> Enum.flat_map(fn seg -> [seg.occ_anchors, seg.pos_anchors, seg.bucket_anchors] end)
      |> Enum.map(&byte_size/1)
      |> Enum.sum()

    pg_occ_total = sizes["corpus_occurrences"].total
    pg_pos_total = sizes["corpus_positions"].total

    """
    ## Storage (100k games, #{pg_counts.occurrences} occurrences, #{pg_counts.positions} positions)

    PostgreSQL:
      corpus_occurrences: #{mb(sizes["corpus_occurrences"].total)} MB total (#{mb(sizes["corpus_occurrences"].table)} table + #{mb(sizes["corpus_occurrences"].index)} index)
      corpus_positions:   #{mb(sizes["corpus_positions"].total)} MB total (#{mb(sizes["corpus_positions"].table)} table + #{mb(sizes["corpus_positions"].index)} index)
      corpus_games:       #{mb(sizes["corpus_games"].total)} MB
      corpus_moves:       #{mb(sizes["corpus_moves"].total)} MB
      occurrence store subtotal (occurrences + positions): #{mb(pg_occ_total + pg_pos_total)} MB

    Packed:
      files: #{Enum.map_join(packed_files, ", ", fn {p, b} -> "#{Path.basename(Path.dirname(p))}/#{Path.basename(p)}=#{mb(b)}MB" end)}
      occurrence store total (occ + pos + bucket): #{mb(packed_total)} MB
      in-memory anchors (stride #{backend.stride}): #{mb(anchor_bytes)} MB
      per-occurrence bytes (occ file): #{Float.round(occ_file_bytes(packed_files) / max(packed_counts.occurrences, 1), 2)}
    """
  end

  ## §5 Stride sweep

  defp stride_sweep(packed_dir) do
    # Probe keys: 500 sampled headers (hit probes) + 100 synthetic misses.
    hashes = sample_header_hashes(packed_dir, 500)
    missing = for i <- 1..100, do: :crypto.hash(:blake2b, "missing-#{i}") |> binary_part(0, 16)

    results =
      for stride <- [256, 1024, 4096, 16384] do
        {:ok, backend} = Packed.open(packed_dir, stride: stride)
        [seg | _] = backend.segments

        anchor_bytes = byte_size(seg.occ_anchors)

        # Warm the page cache with a pass, then measure full lookups.
        Enum.each(Enum.take(hashes, 50), &Segment.occurrences(seg, &1))

        times =
          for key <- hashes do
            {us, _} = :timer.tc(fn -> Segment.occurrences(seg, key) end)
            us
          end

        miss_times =
          for key <- missing do
            {us, _} = :timer.tc(fn -> Segment.occurrences(seg, key) end)
            us
          end

        Packed.close(backend)

        "  stride #{stride}: anchors #{mb(anchor_bytes)} MB, hit #{stats(times)}, miss #{stats(miss_times)}"
      end

    """
    ## Sparse-index stride sweep (500 hit + 100 miss keys, full retrieval)

    #{Enum.join(results, "\n")}
    """
  end

  # Samples actual position hashes from the packed header region —
  # stop at pos_records × header width and never enter the strings region
  # (the earlier probe skipped sorted-by-hash structure of pos.bin and
  # missed hits). Header width follows the segment's pos_version (36 B v1,
  # 49 B v2).
  defp sample_header_hashes(packed_dir, n) do
    [pos_path | _] = Path.wildcard(Path.join(packed_dir, "*/pos.bin"))
    {:ok, manifest} = Packed.Manifest.open(packed_dir)
    [seg_entry | _] = manifest.segments
    pos_records = seg_entry.positions
    hb = Blunderfest.Corpus.Packed.Format.pos_header_bytes(seg_entry.pos_version)

    {:ok, fd} = File.open(pos_path, [:raw, :read])
    headers_bytes = pos_records * hb

    # Stride within the header region only (multiples of the header width).
    step_headers = max(1, div(pos_records, n))
    step_bytes = step_headers * hb

    keys =
      Stream.unfold(0, fn off ->
        if off + hb <= headers_bytes do
          {:ok, <<hash::binary-size(16), _::binary>>} = :file.pread(fd, off, hb)
          {hash, off + step_bytes}
        else
          nil
        end
      end)
      |> Enum.take(n)

    File.close(fd)
    keys
  end

  ## §12 Lookup latency

  defp latency_report(conn, backend, n_lookups) do
    [seg | _] = backend.segments

    # Probe: sampled *actual* position hashes (mapped to keys on the PG
    # side), so both backends measure hits; the repeat set measures warm
    # query reuse (os/file-cache observed effects — see below).
    hashes = sample_header_hashes(backend.dir, n_lookups)
    repeat_hashes = Enum.take(hashes, 50)

    missing =
      for i <- 1..div(n_lookups, 10),
          do: :crypto.hash(:blake2b, "absent-#{i}") |> binary_part(0, 16)

    %{rows: hot_rows} =
      Postgrex.query!(
        conn,
        "SELECT key FROM corpus_occurrences GROUP BY key ORDER BY COUNT(*) DESC LIMIT 10",
        [],
        timeout: :infinity
      )

    hot = Enum.map(hot_rows, fn [key] -> key end)
    hot_hashes = Enum.map(hot, &PositionKey.to_hash128/1)

    # PG side needs canonical keys — resolve through the packed position
    # store (the probe must hit on both backends; the earlier probe skipped
    # the sorted-by-hash structure of pos.bin and measured misses).
    pg_probe_keys =
      hashes
      |> Enum.map(fn hash ->
        case Packed.position(backend, hash) do
          %{key: key} -> key
          nil -> nil
        end
      end)
      |> Enum.reject(&is_nil/1)

    # Key-location only (count query) vs full retrieval (occurrences).
    pg_count_times =
      for key <- pg_probe_keys, do: timed(fn -> Occurrences.counts_for(conn, key) end)

    pg_full_times =
      for key <- Enum.take(pg_probe_keys, 1000),
          do: timed(fn -> Occurrences.occurrences(conn, key) end)

    packed_count_times =
      for hash <- hashes, do: timed(fn -> Packed.occurrence_counts(backend, hash) end)

    packed_full_times =
      for hash <- Enum.take(hashes, 1000), do: timed(fn -> Segment.occurrences(seg, hash) end)

    pg_miss_times =
      for i <- 1..100, do: timed(fn -> Occurrences.occurrences(conn, "absent #{i}") end)

    packed_miss_times =
      for hash <- Enum.take(missing, 100), do: timed(fn -> Segment.occurrences(seg, hash) end)

    # Repeat probes (warm): the same probe queried twice consecutively;
    # both backends warm up the OS/file-cache on the first pass.
    pg_repeat_keys = Enum.take(pg_probe_keys, 100)

    pg_repeat_times =
      for key <- pg_repeat_keys,
          do: timed(fn -> Occurrences.occurrences(conn, key) end)

    packed_repeat_times =
      for hash <- repeat_hashes,
          do: timed(fn -> Segment.occurrences(seg, hash) end)

    # Hot keys: full retrieval.
    pg_hot = for key <- hot, do: {key, timed(fn -> Occurrences.occurrences(conn, key) end)}

    packed_hot =
      for hash <- hot_hashes, do: {hash, timed(fn -> Segment.occurrences(seg, hash) end)}

    """
    ## Lookup latency (µs)

    key-location (counts):
      PG:     #{stats(pg_count_times)}
      packed: #{stats(packed_count_times)}

    full occurrence retrieval:
      PG:     #{stats(pg_full_times)} (n=1000)
      packed: #{stats(packed_full_times)} (n=1000)

    repeated keys (warm):
      PG:     #{stats(pg_repeat_times)} (n=#{length(pg_repeat_times)})
      packed: #{stats(packed_repeat_times)} (n=#{length(packed_repeat_times)})

    missing keys:
      PG:     #{stats(pg_miss_times)} (n=100)
      packed: #{stats(packed_miss_times)} (n=100)

    hot keys (top-10 by occurrences, full retrieval):
      PG:     #{Enum.map_join(pg_hot, ", ", fn {_k, us} -> "#{us}µs" end)}
      packed: #{Enum.map_join(packed_hot, ", ", fn {_h, us} -> "#{us}µs" end)}
    """
  end

  ## §7 Hot-key behavior: location vs materialization

  defp hot_key_report(conn, backend) do
    [seg | _] = backend.segments

    %{rows: rows} =
      Postgrex.query!(
        conn,
        """
        SELECT key, COUNT(*) c FROM corpus_occurrences
        GROUP BY key ORDER BY c DESC LIMIT 8
        """,
        [],
        timeout: :infinity
      )

    lines =
      for [key, c] <- rows do
        hash = PositionKey.to_hash128(key)

        # Location-only for packed: occurrence_counts never decodes tuples
        # but walks the run binary; measure both halves.
        {loc_us, _} = :timer.tc(fn -> Packed.occurrence_counts(backend, hash) end)
        {mat_us, occs} = :timer.tc(fn -> Segment.occurrences(seg, hash) end)
        {pg_us, pg_occs} = :timer.tc(fn -> Occurrences.occurrences(conn, key) end)

        "  #{c} occurrences: packed location #{loc_us}µs / materialize #{mat_us}µs (#{length(occs)}) · PG full #{pg_us}µs (#{length(pg_occs)})"
      end

    """
    ## Hot-key behavior

    #{Enum.join(lines, "\n")}
    """
  end

  ## Helpers

  defp timed(fun) do
    {us, _} = :timer.tc(fun)
    us
  end

  defp stats(times) do
    sorted = Enum.sort(times)
    n = length(sorted)

    "p50=#{Enum.at(sorted, div(n, 2))}µs p95=#{Enum.at(sorted, div(n * 95, 100))}µs p99=#{Enum.at(sorted, div(n * 99, 100))}µs max=#{List.last(sorted)}µs (n=#{n})"
  end

  defp mb(bytes), do: Float.round(bytes / 1024 / 1024, 1)

  # occ.bin's byte count (the per-occurrence record ratio) — keyed off the
  # filename, not a nondeterministic map position.
  defp occ_file_bytes(packed_files) do
    {path, _size} =
      Enum.find(packed_files, fn {path, _size} -> Path.basename(path) == "occ.bin" end)

    Map.get(packed_files, path, nil) || 0
  end
end
