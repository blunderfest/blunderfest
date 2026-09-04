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
  """

  alias Blunderfest.Corpus.Packed.Format

  @occ_record_bytes Format.occ_record_bytes()
  @pos_header_bytes Format.pos_header_bytes()
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
    :stride
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

      pos_size < pos_records * @pos_header_bytes ->
        {:error, {:invalid_pos_file_size, pos_size}}

      book_size < book_headers_bytes ->
        {:error, {:invalid_book_file_size, book_size}}

      true ->
        # Anchors are rebuilt at open (a per-file strided read), then the
        # descriptors are dropped — lookups reopen the file per call.
        occ_anchors = build_anchors(files["occ"], occ_records, @occ_record_bytes, 16, stride)
        pos_anchors = build_anchors(files["pos"], pos_records, @pos_header_bytes, 16, stride)

        bucket_anchors =
          build_anchors(files["bucket"], bucket_records, @bucket_record_bytes, 8, stride)

        book_anchors =
          build_anchors(files["book"], book_records, @book_header_bytes, 16, stride)

        {:ok,
         %__MODULE__{
           id: segment_entry.id,
           occ_path: files["occ"],
           occ_records: occ_records,
           occ_anchors: occ_anchors,
           pos_path: files["pos"],
           pos_records: pos_records,
           pos_anchors: pos_anchors,
           bucket_path: files["bucket"],
           bucket_records: bucket_records,
           bucket_anchors: bucket_anchors,
           book_path: files["book"],
           book_records: book_records,
           book_anchors: book_anchors,
           games_count: segment_entry.games,
           occurrence_count: occ_records,
           position_count: pos_records,
           gids: segment_entry.gids,
           stride: stride
         }}
    end
  end

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
  The first `limit` occurrence tuples of the run, in run order. The run is
  still located and read as a unit (bounded reads land with format v2), but
  only the requested prefix is decoded — a hot key's caller that keeps a
  bounded list never materializes the full run's tuples.
  """
  def occurrences(%__MODULE__{} = seg, hash, limit)
      when is_integer(limit) and limit >= 0 do
    bin = run_binary(seg, hash)
    take = min(byte_size(bin), limit * @occ_record_bytes)
    decode_occurrences(binary_part(bin, 0, take))
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
        {:ok, pawn_hash, first_gid, first_ply, off, len} ->
          key = read_string(seg, pos_fd, off, len)
          %{key: key, pawn_hash: pawn_hash, first_gid: first_gid, first_ply: first_ply}

        :none ->
          nil
      end

    File.close(pos_fd)
    result
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

      {:ok, chunk} =
        pread_fd(pos_fd, seg.pos_path, from * @pos_header_bytes, (to - from) * @pos_header_bytes)

      scan_pos_chunk(seg, chunk, to, hash, pos_fd)
    end
  end

  defp scan_pos_chunk(seg, chunk, next_from, hash, pos_fd) do
    case chunk do
      <<^hash::binary-size(16), pawn_hash::64, first_gid::32, first_ply::16, off::32, len::16,
        _rest::binary>> ->
        {:ok, pawn_hash, first_gid, first_ply, off, len}

      <<key::binary-size(16), _::binary-size(20), rest::binary>> when key < hash ->
        scan_pos_chunk(seg, rest, next_from, hash, pos_fd)

      <<key::binary-size(16), _::binary>> when key > hash ->
        :none

      <<>> ->
        # End of the chunk without passing the target: continue forward
        # (only reachable past the last full chunk) until EOF.
        if next_from < seg.pos_records do
          to = min(next_from + seg.stride, seg.pos_records)

          {:ok, more} =
            pread_fd(
              pos_fd,
              seg.pos_path,
              next_from * @pos_header_bytes,
              (to - next_from) * @pos_header_bytes
            )

          scan_pos_chunk(seg, more, to, hash, pos_fd)
        else
          :none
        end
    end
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
          {:ok, _pawn_hash, _gid, _ply, off, len} -> read_string(seg, pos_fd, off, len)
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
          {:ok, _pawn_hash, _gid, _ply, off, len} -> read_string(seg, pos_fd, off, len)
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
    base = seg.pos_records * @pos_header_bytes

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

  # Anchor binary: n × key_size bytes; anchor i is the key of record i*stride.
  defp build_anchors(_path, 0, _record_bytes, _key_size, _stride), do: <<>>

  defp build_anchors(path, records, record_bytes, key_size, stride) do
    n = div(records + stride - 1, stride)
    {:ok, fd} = open_raw(path)

    anchors =
      for i <- 0..(n - 1), reduce: <<>> do
        acc ->
          {:ok, chunk} = :file.pread(fd, i * stride * record_bytes, record_bytes)
          <<acc::binary, binary_part(chunk, 0, key_size)::binary>>
      end

    File.close(fd)
    anchors
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
