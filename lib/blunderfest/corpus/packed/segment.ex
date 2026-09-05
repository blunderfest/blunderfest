defmodule Blunderfest.Corpus.Packed.Segment do
  @moduledoc """
  One open packed segment: file descriptors plus the in-memory sparse-anchor
  indexes, serving the three occurrence-query families (ordered occurrence
  runs, position headers, pawn buckets).

  Lookup semantics match the Postgres occurrence layer:

    * `occurrences/1` — `{gid, ply}` tuples, `ORDER BY gid, ply`;
    * `occurrence_counts/1` — `%{occurrences, games}` (games = distinct gids);
    * `position/1` — `%{key, pawn_hash, first_gid, first_ply}` or nil;
    * `pawn_bucket/1` — distinct canonical keys, `ORDER BY key` (lexical).

  Anchors are the keys of every `stride`-th record, packed into a flat binary
  (`n × key_size` bytes) rebuilt at open — the stride is a runtime choice,
  not a format property. Lookup = binary search over anchors → bounded chunk
  pread → linear scan, the algorithm proven in Spike 01's flatfile store
  (hot keys span many chunks, so an exact anchor match walks back to the
  first equal anchor and starts one chunk earlier — the run can begin
  mid-chunk).

  Sort orders: occ.bin by `(hash, gid, ply)` (matching `ORDER BY gid, ply`
  per key); pos.bin headers by `hash` (each key has exactly one header, so
  no walk-back is needed there); bucket.bin by `(pawn_hash, pos_hash)` with
  8-byte anchors on `pawn_hash` alone (big-endian u64 — lexical comparison
  equals integer comparison).

  Anchors are derived data persisted as `<file>.anchors-<stride>` sidecars
  (Spike 09 Phase 1): open loads a valid sidecar in one read and falls back
  to a chunked sequential rebuild (persisting the result), so boots never
  pay the old one-pread-per-anchor walk. `anchors_from` records which path
  the open took.

  pos.bin headers come in two widths (Spike 09 Phase 2): v1's 36-byte
  header and v2's 49-byte header, which additionally carries the pack-time
  run statistics (`occurrence_count`, `game_count`, `occ_run_offset`). The
  segment's `pos_version` comes from the manifest entry; every query family
  above serves both versions identically, and `position_stats/2` +
  `verify_run/2` expose/validate the v2 statistics for the parity and
  validation tasks.

  Phase 3 (this module's bounded-read path): on a v2 segment,
  `occurrences/3` seeks straight to the run via the stored `occ_run_offset`
  and reads only the requested prefix — `min(limit, occurrence_count)`
  records, independent of the run length. v1 segments keep the Phase 0
  behavior (the run is read as a unit, only the prefix decoded);
  `first_occurrence/2` is header-backed on both versions.
  """

  alias Blunderfest.Corpus.Packed.Format

  @occ_record_bytes Format.occ_record_bytes()
  @bucket_record_bytes Format.bucket_record_bytes()
  @book_header_bytes Format.book_header_bytes()

  defstruct [
    :id,
    :occ_path,
    :occ_records,
    :occ_anchors,
    :pos_path,
    :pos_records,
    :pos_anchors,
    :pos_version,
    :pos_header_bytes,
    :bucket_path,
    :bucket_records,
    :bucket_anchors,
    :book_path,
    :book_records,
    :book_anchors,
    :games_count,
    :occurrence_count,
    :position_count,
    :gids,
    :stride,
    :anchors_from
  ]

  @type t :: %__MODULE__{}

  @doc """
  Opens one validated manifest segment entry. The struct holds file *paths*
  plus the in-memory anchor indexes — the raw reads open the file per call
  (pread's owner-only fd constraint rules out sharing across processes).
  """
  @spec open(map(), non_neg_integer()) :: {:ok, t()} | {:error, term()}
  def open(segment_entry, stride) do
    files = segment_entry.files
    pos_records = segment_entry.positions
    pos_version = Map.get(segment_entry, :pos_version, 1)
    pos_header_bytes = Format.pos_header_bytes(pos_version)

    occ_size = File.stat!(files["occ"]).size
    bucket_size = File.stat!(files["bucket"]).size
    pos_size = File.stat!(files["pos"]).size
    book_size = File.stat!(files["book"]).size

    occ_records = div(occ_size, @occ_record_bytes)
    bucket_records = div(bucket_size, @bucket_record_bytes)
    # Book headers are fixed 22B; the manifest carries the count (the blob
    # region is variable, so it can't be derived from the file size).
    book_records = segment_entry.book_records || 0
    book_headers_bytes = book_records * @book_header_bytes

    cond do
      rem(occ_size, @occ_record_bytes) != 0 ->
        {:error, {:invalid_occ_file_size, occ_size}}

      rem(bucket_size, @bucket_record_bytes) != 0 ->
        {:error, {:invalid_bucket_file_size, bucket_size}}

      segment_entry.occurrences != occ_records ->
        {:error, {:occurrence_count_mismatch, segment_entry.occurrences, occ_records}}

      bucket_records != pos_records ->
        {:error, {:bucket_position_count_mismatch, bucket_records, pos_records}}

      pos_size < pos_records * pos_header_bytes ->
        {:error, {:invalid_pos_file_size, pos_size}}

      book_size < book_headers_bytes ->
        {:error, {:invalid_book_file_size, book_size}}

      true ->
        # Anchors load from a persisted sidecar when one exists (one read
        # per file); otherwise they are rebuilt with a chunked sequential
        # scan and persisted for the next open. Lookups still reopen the
        # data file per call.
        {occ_anchors, occ_src} =
          load_anchors(files["occ"], occ_records, @occ_record_bytes, 16, stride)

        {pos_anchors, pos_src} =
          load_anchors(files["pos"], pos_records, pos_header_bytes, 16, stride)

        {bucket_anchors, bucket_src} =
          load_anchors(files["bucket"], bucket_records, @bucket_record_bytes, 8, stride)

        {book_anchors, book_src} =
          load_anchors(files["book"], book_records, @book_header_bytes, 16, stride)

        anchors_from =
          if Enum.all?([occ_src, pos_src, bucket_src, book_src], &(&1 == :sidecar)),
            do: :sidecar,
            else: :rebuilt

        {:ok,
         %__MODULE__{
           id: segment_entry.id,
           occ_path: files["occ"],
           occ_records: occ_records,
           occ_anchors: occ_anchors,
           pos_path: files["pos"],
           pos_records: pos_records,
           pos_anchors: pos_anchors,
           pos_version: pos_version,
           pos_header_bytes: pos_header_bytes,
           bucket_path: files["bucket"],
           bucket_records: bucket_records,
           bucket_anchors: bucket_anchors,
           book_path: files["book"],
           book_records: book_records,
           book_anchors: book_anchors,
           games_count: segment_entry.games,
           occurrence_count: occ_records,
           position_count: pos_records,
           gids: normalize_gids(segment_entry.gids),
           stride: stride,
           anchors_from: anchors_from
         }}
    end
  end

  # The manifest decodes gids with string keys; the builder emits atom
  # keys. Read-time consumers (the bounded merge's gid-range disjointness
  # check) see one shape.
  defp normalize_gids(nil), do: nil
  defp normalize_gids(%{min: _min, max: _max} = gids), do: gids
  defp normalize_gids(%{"min" => min, "max" => max}), do: %{min: min, max: max}

  @doc "No-op: the segment keeps no file descriptors open."
  def close(%__MODULE__{}), do: :ok

  ## Occurrences

  @doc "`ORDER BY gid, ply` occurrence tuples for the hash."
  def occurrences(%__MODULE__{} = seg, hash) do
    seg
    |> run_binary(hash)
    |> decode_occurrences()
  end

  @doc """
  The first `limit` occurrence tuples of the run, in run order.

  On a format-v2 segment this is a true bounded read: the stored
  `occ_run_offset` locates the run and exactly `min(limit,
  occurrence_count)` records are read from occ.bin — the rest of the run's
  bytes are never touched. On a v1 segment (no stored offset) the run is
  still located and read as a unit; only the requested prefix is decoded.
  """
  def occurrences(%__MODULE__{pos_version: 2} = seg, hash, limit)
      when is_integer(limit) and limit >= 0 do
    if limit == 0 do
      []
    else
      case position_stats(seg, hash) do
        {:ok, %{run_offset: offset, occurrences: count}} ->
          read_run_prefix(seg, offset, min(limit, count))

        :none ->
          []
      end
    end
  end

  def occurrences(%__MODULE__{} = seg, hash, limit)
      when is_integer(limit) and limit >= 0 do
    bin = run_binary(seg, hash)
    take = min(byte_size(bin), limit * @occ_record_bytes)
    decode_occurrences(binary_part(bin, 0, take))
  end

  defp read_run_prefix(_seg, _offset, 0), do: []

  defp read_run_prefix(seg, offset, count) do
    {:ok, fd} = open_raw(seg.occ_path)
    result = :file.pread(fd, offset * @occ_record_bytes, count * @occ_record_bytes)
    File.close(fd)

    case result do
      {:ok, bin} when byte_size(bin) == count * @occ_record_bytes ->
        decode_occurrences(bin)

      other ->
        raise "packed bounded occurrence read failed: #{inspect(other)}"
    end
  end

  @doc """
  The segment-local first occurrence of a hash — `{gid, ply}` or nil —
  from the position header's stored first occurrence fields (both header
  versions carry them). One bounded header read (O(log anchors)); occ.bin
  is never opened.
  """
  def first_occurrence(%__MODULE__{} = seg, hash) do
    {:ok, pos_fd} = open_raw(seg.pos_path)

    result =
      case find_pos_header(seg, hash, pos_fd) do
        {:ok, fields} -> {fields.first_gid, fields.first_ply}
        :none -> nil
      end

    File.close(pos_fd)
    result
  end

  @doc """
  `%{occurrences, games}` counts over the run. Gids are ascending within a
  run (sort key `(hash, gid, ply)`), so distinct-gid counting is an
  adjacent comparison — no occurrence list is materialized.
  """
  def occurrence_counts(%__MODULE__{} = seg, hash) do
    seg
    |> run_binary(hash)
    |> count_run(0, nil, 0)
  end

  defp decode_occurrences(bin) do
    for <<_h::binary-size(16), gid::32, ply::16 <- bin>>, do: {gid, ply}
  end

  defp count_run(<<>>, occ, _last_gid, games), do: %{occurrences: occ, games: games}

  defp count_run(<<_h::binary-size(16), gid::32, _ply::16, rest::binary>>, occ, last_gid, games) do
    count_run(rest, occ + 1, gid, if(gid == last_gid, do: games, else: games + 1))
  end

  defp run_binary(%__MODULE__{} = seg, hash) do
    scan_run(
      seg.occ_path,
      seg.occ_records,
      seg.occ_anchors,
      hash,
      seg.stride,
      @occ_record_bytes,
      16
    )
  end

  ## Position

  @doc "The position row for a hash — `%{key, pawn_hash, first_gid, first_ply}` or nil."
  def position(%__MODULE__{} = seg, hash) do
    # Single-key lookups keep per-query-opens semantics.
    {:ok, pos_fd} = open_raw(seg.pos_path)

    result =
      case find_pos_header(seg, hash, pos_fd) do
        {:ok, fields} ->
          key = read_string(seg, pos_fd, fields.string_offset, fields.string_len)

          %{
            key: key,
            pawn_hash: fields.pawn_hash,
            first_gid: fields.first_gid,
            first_ply: fields.first_ply
          }

        :none ->
          nil
      end

    File.close(pos_fd)
    result
  end

  @doc """
  The pack-time run statistics of a format-v2 header —
  `%\{occurrences, games, run_offset, first_gid, first_ply}` — in one
  bounded header read (O(log anchors)), independent of the run length.
  Returns `{:error, :format_v1}` for a v1 segment (no stored stats) and
  `:none` for a key without a header.
  """
  def position_stats(%__MODULE__{pos_version: 1}, _hash), do: {:error, :format_v1}

  def position_stats(%__MODULE__{} = seg, hash) do
    {:ok, pos_fd} = open_raw(seg.pos_path)

    result =
      case find_pos_header(seg, hash, pos_fd) do
        {:ok, fields} ->
          {:ok,
           %{
             occurrences: fields.occurrence_count,
             games: fields.game_count,
             run_offset: fields.occ_run_offset,
             first_gid: fields.first_gid,
             first_ply: fields.first_ply
           }}

        :none ->
          :none
      end

    File.close(pos_fd)
    result
  end

  @doc """
  Internal consistency of the v2 stats against `occ.bin`, for validation
  sampling (build-time, `corpus.validate`, parity): the record at
  `run_offset` is the header's first occurrence, the whole span carries the
  header's hash, its adjacent-gid dedup equals `game_count`, and the records
  just outside the span belong to other keys. O(run) — deliberately never
  called on a hot path. `{:error, :format_v1}` on a v1 segment,
  `{:error, {:no_position_header, hash}}` on a missing key.
  """
  def verify_run(%__MODULE__{pos_version: 1}, _hash), do: {:error, :format_v1}

  def verify_run(%__MODULE__{} = seg, hash) do
    case position_stats(seg, hash) do
      {:ok, stats} -> do_verify_run(seg, hash, stats)
      :none -> {:error, {:no_position_header, hash}}
      {:error, _} = error -> error
    end
  end

  @doc """
  Runs `verify_run/2` on `n` evenly spread position headers (always
  including the first and last) — the sampled v2 validation pass. No-op on
  v1 segments and empty segments.
  """
  def verify_sampled_runs(%__MODULE__{pos_version: 1}, _n), do: :ok
  def verify_sampled_runs(%__MODULE__{pos_records: 0}, _n), do: :ok

  def verify_sampled_runs(%__MODULE__{} = seg, n) when is_integer(n) and n > 0 do
    {:ok, pos_fd} = open_raw(seg.pos_path)

    result =
      seg.pos_records
      |> sample_indices(n)
      |> Enum.reduce_while(:ok, fn idx, :ok ->
        {:ok, header} = :file.pread(pos_fd, idx * seg.pos_header_bytes, seg.pos_header_bytes)
        <<hash::binary-size(16), _::binary>> = header

        case verify_run(seg, hash) do
          :ok -> {:cont, :ok}
          {:error, _} = error -> {:halt, error}
        end
      end)

    File.close(pos_fd)
    result
  end

  defp sample_indices(records, n) do
    step = max(1, div(records - 1, max(n - 1, 1)))

    0..(records - 1)//step
    |> Enum.take(n)
    |> Kernel.++([records - 1])
    |> Enum.uniq()
  end

  defp do_verify_run(seg, hash, %{occurrences: count, run_offset: offset} = stats) do
    cond do
      count == 0 ->
        {:error, {:zero_occurrence_count, hash}}

      offset + count > seg.occ_records ->
        {:error, {:run_out_of_bounds, hash, offset, count}}

      true ->
        {:ok, fd} = open_raw(seg.occ_path)

        result =
          case :file.pread(fd, offset * @occ_record_bytes, count * @occ_record_bytes) do
            {:ok, span} when byte_size(span) == count * @occ_record_bytes ->
              verify_span(fd, seg, hash, stats, span)

            {:ok, short} ->
              {:error, {:short_run_read, hash, byte_size(short)}}

            {:error, reason} ->
              {:error, {:run_read_failed, hash, reason}}
          end

        File.close(fd)
        result
    end
  end

  defp verify_span(fd, seg, hash, stats, span) do
    <<span_hash::binary-size(16), first_gid::32, first_ply::16, _::binary>> = span

    cond do
      span_hash != hash ->
        {:error, {:run_hash_mismatch, hash, stats.run_offset}}

      {first_gid, first_ply} != {stats.first_gid, stats.first_ply} ->
        {:error,
         {:first_occurrence_mismatch, hash, {first_gid, first_ply},
          {stats.first_gid, stats.first_ply}}}

      not all_records_hash?(span, hash) ->
        {:error, {:run_span_hash_mismatch, hash}}

      count_run_gids(span, nil, 0) != stats.games ->
        {:error, {:game_count_mismatch, hash}}

      true ->
        with :ok <- check_boundary(fd, seg, hash, stats.run_offset - 1, :before),
             :ok <- check_boundary(fd, seg, hash, stats.run_offset + stats.occurrences, :after) do
          :ok
        end
    end
  end

  # The record adjacent to the run (just before / just after) must belong to
  # another key — otherwise the stored run span is not the full run.
  defp check_boundary(_fd, _seg, _hash, idx, _side) when idx < 0, do: :ok

  defp check_boundary(fd, seg, hash, idx, side) do
    if idx >= seg.occ_records do
      :ok
    else
      case :file.pread(fd, idx * @occ_record_bytes, 16) do
        {:ok, ^hash} -> {:error, {:run_boundary_mismatch, hash, side, idx}}
        {:ok, _other} -> :ok
        {:error, reason} -> {:error, {:boundary_read_failed, hash, side, reason}}
      end
    end
  end

  defp all_records_hash?(<<>>, _hash), do: true

  defp all_records_hash?(<<hash::binary-size(16), _gid::32, _ply::16, rest::binary>>, hash),
    do: all_records_hash?(rest, hash)

  defp all_records_hash?(<<_other::binary-size(22), _rest::binary>>, _hash), do: false

  defp count_run_gids(<<>>, _last_gid, games), do: games

  defp count_run_gids(<<_h::binary-size(16), gid::32, _ply::16, rest::binary>>, last_gid, games) do
    count_run_gids(rest, gid, if(gid == last_gid, do: games, else: games + 1))
  end

  # Each distinct key has exactly one header, so no hot-key walk-back:
  # binary search the anchors, scan forward, stop at the first key beyond
  # the target (or EOF). The caller provides the opened fd.
  defp find_pos_header(%__MODULE__{} = seg, hash, pos_fd) do
    n = anchor_count(seg.pos_anchors, 16)

    if n == 0 do
      :none
    else
      idx = floor_anchor(seg.pos_anchors, n, 16, hash)
      from = idx * seg.stride
      to = min(from + seg.stride, seg.pos_records)
      hb = seg.pos_header_bytes

      {:ok, chunk} =
        pread_fd(pos_fd, seg.pos_path, from * hb, (to - from) * hb)

      scan_pos_chunk(seg, chunk, to, hash, pos_fd)
    end
  end

  defp scan_pos_chunk(seg, chunk, next_from, hash, pos_fd) do
    hb = seg.pos_header_bytes
    skip = hb - 16

    case chunk do
      <<^hash::binary-size(16), _rest::binary>> ->
        <<record::binary-size(^hb), _::binary>> = chunk
        {:ok, decode_pos_record(seg.pos_version, record)}

      <<key::binary-size(16), _::binary-size(^skip), rest::binary>> when key < hash ->
        scan_pos_chunk(seg, rest, next_from, hash, pos_fd)

      <<key::binary-size(16), _::binary>> when key > hash ->
        :none

      <<>> ->
        # End of the chunk without passing the target: continue forward
        # (only reachable past the last full chunk) until EOF.
        if next_from < seg.pos_records do
          to = min(next_from + seg.stride, seg.pos_records)

          {:ok, more} =
            pread_fd(pos_fd, seg.pos_path, next_from * hb, (to - next_from) * hb)

          scan_pos_chunk(seg, more, to, hash, pos_fd)
        else
          :none
        end
    end
  end

  defp decode_pos_record(1, record) do
    {_hash, pawn_hash, first_gid, first_ply, string_offset, string_len} =
      Format.decode_pos_header(record)

    %{
      pawn_hash: pawn_hash,
      first_gid: first_gid,
      first_ply: first_ply,
      string_offset: string_offset,
      string_len: string_len
    }
  end

  defp decode_pos_record(2, record) do
    {_hash, pawn_hash, occurrence_count, game_count, occ_run_offset, first_gid, first_ply,
     string_offset, string_len} = Format.decode_pos_header_v2(record)

    %{
      pawn_hash: pawn_hash,
      occurrence_count: occurrence_count,
      game_count: game_count,
      occ_run_offset: occ_run_offset,
      first_gid: first_gid,
      first_ply: first_ply,
      string_offset: string_offset,
      string_len: string_len
    }
  end

  ## Pawn bucket

  @doc """
  Distinct canonical keys whose pawn_hash equals `pawn_hash`, sorted
  lexically (the Postgres layer's `ORDER BY key`). Hot buckets carry tens
  of thousands of keys; open `pos.bin` once per query (the per-call-open
  rule still holds — the fd never crosses process boundaries) and thread
  the fd through the header/string reads.
  """
  def pawn_bucket(%__MODULE__{} = seg, pawn_hash) do
    pawn_bucket(seg, pawn_hash, :all)
  end

  @doc """
  Bounded bucket: resolve at most `limit` pos-hashes (in bucket-run order,
  i.e. pos-hash order) before the lexical sort. The full-fetch path
  resolves every member (expensive on a hot broadcast bucket; see the
  Broadcast validation's bucket measurements).
  """
  def pawn_bucket(%__MODULE__{} = seg, pawn_hash, :all) do
    {:ok, pos_fd} = open_raw(seg.pos_path)

    result =
      pawn_hash
      |> bucket_hashes(seg)
      |> Enum.map(fn pos_hash ->
        case find_pos_header(seg, pos_hash, pos_fd) do
          {:ok, fields} -> read_string(seg, pos_fd, fields.string_offset, fields.string_len)
          :none -> nil
        end
      end)

    File.close(pos_fd)

    result
    |> Enum.reject(&is_nil/1)
    |> Enum.sort()
  end

  def pawn_bucket(%__MODULE__{} = seg, pawn_hash, limit) when is_integer(limit) do
    {:ok, pos_fd} = open_raw(seg.pos_path)

    result =
      pawn_hash
      |> bucket_hashes(seg)
      |> Enum.take(limit)
      |> Enum.map(fn pos_hash ->
        case find_pos_header(seg, pos_hash, pos_fd) do
          {:ok, fields} -> read_string(seg, pos_fd, fields.string_offset, fields.string_len)
          :none -> nil
        end
      end)

    File.close(pos_fd)

    result
    |> Enum.reject(&is_nil/1)
    |> Enum.sort()
  end

  defp bucket_hashes(pawn_hash, seg) do
    # Anchors are big-endian u64 binaries; the probe must be the same
    # (lexical comparison of big-endian bytes equals integer comparison).
    probe = <<pawn_hash::64>>

    bin =
      scan_run(
        seg.bucket_path,
        seg.bucket_records,
        seg.bucket_anchors,
        probe,
        seg.stride,
        @bucket_record_bytes,
        8
      )

    for <<^pawn_hash::64, pos_hash::binary-size(16) <- bin>>, do: pos_hash
  end

  ## Book

  @doc """
  The precomputed next-move distribution for a position hash:
  `[%\{move, games, white, draw, black}]` sorted `(games desc, move)`.
  A miss means a terminal position (or an unknown key) — `[]`.
  """
  def book(%__MODULE__{} = seg, hash) do
    n = anchor_count(seg.book_anchors, 16)

    if n == 0 do
      []
    else
      idx = floor_anchor(seg.book_anchors, n, 16, hash)

      # Book headers are unique per key, so no walk-back; scan forward.
      case find_book_header(seg, idx, hash) do
        {:ok, offset, len} ->
          base = seg.book_records * @book_header_bytes

          {:ok, blob} = pread_fd(nil, seg.book_path, base + offset, len)
          Format.decode_book_blob(blob)

        :none ->
          []
      end
    end
  end

  defp find_book_header(seg, idx, hash) do
    from = idx * seg.stride
    to = min(from + seg.stride, seg.book_records)

    {:ok, chunk} =
      pread_fd(nil, seg.book_path, from * @book_header_bytes, (to - from) * @book_header_bytes)

    scan_book_chunk(seg, chunk, to, hash)
  end

  defp scan_book_chunk(seg, chunk, next_from, hash) do
    case chunk do
      <<^hash::binary-size(16), offset::32, len::16, _rest::binary>> ->
        {:ok, offset, len}

      <<key::binary-size(16), _::binary-size(6), rest::binary>> when key < hash ->
        scan_book_chunk(seg, rest, next_from, hash)

      <<key::binary-size(16), _::binary>> when key > hash ->
        :none

      <<>> ->
        if next_from < seg.book_records do
          to = min(next_from + seg.stride, seg.book_records)

          {:ok, more} =
            pread_fd(
              nil,
              seg.book_path,
              next_from * @book_header_bytes,
              (to - next_from) * @book_header_bytes
            )

          scan_book_chunk(seg, more, to, hash)
        else
          :none
        end
    end
  end

  ## Shared sparse-anchor machinery

  # Reads the run of records whose `key_size`-byte key equals `key`,
  # returning the concatenated matching record binaries (empty on a miss).
  # Opens the file once and threads the fd through the chunk scans.
  defp scan_run(path, records, anchors, key, stride, record_bytes, key_size) do
    n = anchor_count(anchors, key_size)

    if n == 0 do
      <<>>
    else
      idx = floor_anchor(anchors, n, key_size, key)

      start_idx =
        if anchor_at(anchors, idx, key_size) == key do
          max(first_equal_anchor(anchors, idx, key_size, key) - 1, 0)
        else
          idx
        end

      from = start_idx * stride
      to = min(from + stride, records)

      {:ok, fd} = open_raw(path)

      result =
        case pread_fd(fd, path, from * record_bytes, (to - from) * record_bytes) do
          {:ok, chunk} ->
            collect_matches(fd, path, records, chunk, to, key, stride, record_bytes, key_size, [])

          _other ->
            <<>>
        end

      File.close(fd)
      result
    end
  end

  defp collect_matches(
         fd,
         path,
         records,
         chunk,
         next_from,
         key,
         stride,
         record_bytes,
         key_size,
         acc
       ) do
    case scan_chunk(chunk, key, record_bytes, key_size, []) do
      {:key_beyond, matches} ->
        concat_matches(acc, matches)

      {:chunk_end, matches} ->
        acc = [matches | acc]

        if next_from < records do
          to = min(next_from + stride, records)

          case pread_fd(fd, path, next_from * record_bytes, (to - next_from) * record_bytes) do
            {:ok, more} when byte_size(more) > 0 ->
              collect_matches(
                fd,
                path,
                records,
                more,
                to,
                key,
                stride,
                record_bytes,
                key_size,
                acc
              )

            _ ->
              concat_matches(acc, <<>>)
          end
        else
          concat_matches(acc, <<>>)
        end
    end
  end

  # Matching chunks are accumulated in file order and concatenated once —
  # per-chunk appends made Spike 01's hot-key lookups take seconds.
  defp concat_matches(acc, last) do
    [last | acc]
    |> Enum.reverse()
    |> IO.iodata_to_binary()
  end

  # Scans one chunk; matching records are collected reversed and flipped
  # once per chunk, preserving file order within and across chunks.
  defp scan_chunk(<<>>, _key, _record_bytes, _key_size, matches),
    do: {:chunk_end, matches_binary(matches)}

  defp scan_chunk(chunk, key, record_bytes, key_size, matches) do
    record_key = binary_part(chunk, 0, key_size)

    cond do
      record_key == key ->
        <<record::binary-size(^record_bytes), rest::binary>> = chunk
        scan_chunk(rest, key, record_bytes, key_size, [record | matches])

      record_key < key ->
        <<_record::binary-size(^record_bytes), rest::binary>> = chunk
        scan_chunk(rest, key, record_bytes, key_size, matches)

      true ->
        {:key_beyond, matches_binary(matches)}
    end
  end

  defp matches_binary(matches), do: matches |> Enum.reverse() |> IO.iodata_to_binary()

  # The string region follows pos_records fixed-width headers; base+offset
  # locates the key exactly. A pread failure must not silently mutate the
  # position's key (management: read-side errors surface as crashes).
  defp read_string(seg, pos_fd, offset, len) do
    base = seg.pos_records * seg.pos_header_bytes

    case pread_fd(pos_fd, seg.pos_path, base + offset, len) do
      {:ok, string} -> string
      other -> raise "packed read_string failed: #{inspect(other)}"
    end
  end

  # Anchor helpers: the anchor binary packs n × key_size bytes; anchor i is
  # the key of record i*stride. `floor_anchor` finds the largest anchor with
  # key <= target (upper-mid binary search; a key smaller than the first
  # anchor lands on 0). `first_equal_anchor` walks back equal keys (the
  # hot-key run may start mid-chunk).
  defp anchor_count(anchors, key_size), do: div(byte_size(anchors), key_size)

  defp anchor_at(anchors, i, key_size), do: binary_part(anchors, i * key_size, key_size)

  defp floor_anchor(anchors, n, key_size, key), do: do_floor(anchors, key_size, key, 0, n - 1)

  defp do_floor(_anchors, _key_size, _key, lo, lo), do: lo

  defp do_floor(anchors, key_size, key, lo, hi) do
    mid = div(lo + hi + 1, 2)

    if anchor_at(anchors, mid, key_size) <= key do
      do_floor(anchors, key_size, key, mid, hi)
    else
      do_floor(anchors, key_size, key, lo, mid - 1)
    end
  end

  defp first_equal_anchor(anchors, idx, key_size, key) do
    if idx > 0 and anchor_at(anchors, idx - 1, key_size) == key do
      first_equal_anchor(anchors, idx - 1, key_size, key)
    else
      idx
    end
  end

  # Anchor lifecycle (Spike 09 Phase 1): anchors are derived data — anchor
  # i is the key of record i*stride, n = ceil(records/stride), packed as
  # n × key_size bytes. They are persisted as `<file>.anchors-<stride>`
  # sidecars next to the segment files; open loads a valid sidecar in one
  # read, and only a missing/invalid sidecar pays a rebuild — a chunked
  # sequential scan (one pread per @anchor_group anchors), not the old
  # one-pread-per-anchor walk (1.21M reads at the broadcast tier, minutes
  # on the prod volume). Rebuilds persist their result for the next open.

  @anchor_group 256

  defp sidecar_path(path, stride), do: "#{path}.anchors-#{stride}"

  defp load_anchors(_path, 0, _record_bytes, _key_size, _stride), do: {<<>>, :sidecar}

  defp load_anchors(path, records, record_bytes, key_size, stride) do
    n = div(records + stride - 1, stride)
    expected = n * key_size
    sidecar = sidecar_path(path, stride)

    case read_sidecar(sidecar, path, n, record_bytes, key_size, stride, expected) do
      {:ok, bin} ->
        {bin, :sidecar}

      :error ->
        bin = build_anchors(path, record_bytes, key_size, stride, n)
        # Best effort: an unwritable sidecar just rebuilds on the next open.
        _ = File.write(sidecar, bin)
        {bin, :rebuilt}
    end
  end

  # A sidecar is trusted when its size matches the expected anchor bytes and
  # its first/last anchors equal the data file's actual anchor-record keys
  # (two spot reads; the data files themselves are checksum-guarded by the
  # manifest).
  defp read_sidecar(sidecar, path, n, record_bytes, key_size, stride, expected) do
    with {:ok, %{size: ^expected}} <- File.stat(sidecar),
         {:ok, bin} <- File.read(sidecar),
         {:ok, fd} <- open_raw(path),
         {:ok, first_key} <- :file.pread(fd, 0, key_size),
         true <- binary_part(bin, 0, key_size) == first_key,
         {:ok, last_key} <- :file.pread(fd, (n - 1) * stride * record_bytes, key_size),
         true <- binary_part(bin, (n - 1) * key_size, key_size) == last_key do
      File.close(fd)
      {:ok, bin}
    else
      _ -> :error
    end
  rescue
    _ -> :error
  end

  # Chunked sequential rebuild: one pread per @anchor_group anchors (a
  # contiguous span of the file), keys sliced out of each window.
  defp build_anchors(path, record_bytes, key_size, stride, n) do
    {:ok, fd} = open_raw(path)
    anchor_stride = stride * record_bytes

    anchors =
      0..(n - 1)//@anchor_group
      |> Enum.map(fn start ->
        count = min(@anchor_group, n - start)
        {:ok, buf} = :file.pread(fd, start * anchor_stride, count * anchor_stride)

        for i <- 0..(count - 1)//1, into: <<>> do
          binary_part(buf, i * anchor_stride, key_size)
        end
      end)

    File.close(fd)
    IO.iodata_to_binary(anchors)
  end

  # Every read uses the caller-threaded fd — either the one opened for a
  # batched bucket query or the per-call one. An fd never crosses process
  # boundaries (pread's owner-only constraint).
  defp pread_fd(fd, path, offset, len) do
    if fd do
      :file.pread(fd, offset, len)
    else
      {:ok, opened} = open_raw(path)
      result = :file.pread(opened, offset, len)
      File.close(opened)
      result
    end
  end

  defp open_raw(path), do: File.open(path, [:raw, :read, :read_ahead])
end
