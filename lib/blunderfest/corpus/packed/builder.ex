defmodule Blunderfest.Corpus.Packed.Builder do
  @moduledoc """
  Builds one packed segment (occ.bin, pos.bin, bucket.bin) from *sorted*
  enumerable streams, with build-time validation (Spike 08, §§3, 18, 20):

    * sortedness is asserted on every record (a disorder raises);
    * file sizes must match `count × record_size` exactly;
    * per-file SHA-256 checksums are computed for the manifest.

  The builder writes into a directory provided by the caller; publication
  into the corpus data directory happens by renaming the directory once
  the manifest entry exists (atomic publication, §18).

  Input streams:

    * occurrences: `{hash16, gid, ply}` sorted by `(hash, gid, ply)`
    * positions: `{hash16, pawn_hash, first_gid, first_ply, key_string}`
      sorted by `hash` (bucket entries are re-sorted by `(pawn_hash, hash)`
      in memory). With `pos_version: 2` (Spike 09 Phase 2) each row
      additionally carries the pack-time run statistics —
      `{hash16, pawn_hash, first_gid, first_ply, key_string,
      occurrence_count, game_count, occ_run_offset}` — which are written
      into the 49-byte v2 headers and re-verified against occ.bin on a
      sampled pass before the segment may publish.
    * book rows: `{hash16, move, games, white, draw, black}` sorted by
      `hash` — each key's entries pre-sorted by `(games desc, move)`.
  """

  alias Blunderfest.Corpus.Packed.{Format, Input}

  @occ_record_bytes Format.occ_record_bytes()
  @pos_header_v2_bytes Format.pos_header_bytes(2)
  @bucket_record_bytes Format.bucket_record_bytes()
  @book_header_bytes Format.book_header_bytes()

  # Sampled v2-stats verification: evenly spread headers (always including
  # the first and last) whose stored statistics are recomputed from occ.bin.
  @default_stats_sample 128

  @doc """
  Builds the segment `id` under the packed root `root_dir` (files land in
  `root_dir/id/`) and returns a manifest entry map whose file paths are
  relative to the root. Raises on any validation failure — the segment must
  never publish.

  Options:

    * `:pos_version` — 1 (default, 36-byte headers) or 2 (49-byte headers
      with the pack-time run statistics; the position stream must carry
      them);
    * `:stats_sample` — how many v2 headers to re-verify against occ.bin
      (default #{@default_stats_sample}; ignored for v1).
  """
  @spec build!(
          Path.t(),
          String.t(),
          occ_stream :: Enumerable.t(),
          pos_stream :: Enumerable.t(),
          book_stream :: Enumerable.t(),
          games_count :: non_neg_integer() | nil,
          keyword()
        ) :: map()
  def build!(root_dir, id, occurrences, positions, books, games_count, opts \\ []) do
    pos_version = Keyword.get(opts, :pos_version, 1)

    unless pos_version in [1, 2],
      do: raise("packed build: unsupported pos_version #{pos_version}")

    dir = Path.join(root_dir, id)
    File.mkdir_p!(dir)

    occ = write_occurrences(Path.join(dir, "occ.bin"), occurrences)
    pos = write_positions(dir, positions, pos_version)

    bucket_count = write_buckets(Path.join(dir, "bucket.bin"), dir, pos.buckets_txt)

    if bucket_count != pos.count do
      raise "packed build validation failed: #{bucket_count} bucket entries for #{pos.count} positions"
    end

    # Format v2: the stored per-position statistics must reproduce from
    # occ.bin before the segment may publish (sampled re-count pass).
    if pos_version == 2 do
      sample = Keyword.get(opts, :stats_sample, @default_stats_sample)
      validate_v2_stats!(dir, pos.count, occ.count, sample)
    end

    book_count = write_book(Path.join(dir, "book.bin"), dir, books)

    files = %{
      occ:
        file_info!(
          Path.join(id, "occ.bin"),
          Path.join(dir, "occ.bin"),
          occ.count * @occ_record_bytes
        ),
      pos:
        file_info!(
          Path.join(id, "pos.bin"),
          Path.join(dir, "pos.bin"),
          pos.count * Format.pos_header_bytes(pos_version) + pos.strings_bytes
        ),
      bucket:
        file_info!(
          Path.join(id, "bucket.bin"),
          Path.join(dir, "bucket.bin"),
          bucket_count * @bucket_record_bytes
        ),
      book:
        file_info!(
          Path.join(id, "book.bin"),
          Path.join(dir, "book.bin"),
          book_count.bytes
        )
    }

    cleanup([Path.join(dir, "pos-headers.tmp"), Path.join(dir, "pos-strings.tmp")])

    %{
      id: id,
      games: games_count,
      occurrences: occ.count,
      positions: pos.count,
      book_records: book_count.count,
      pos_version: pos_version,
      gids: occ.gids,
      files: files
    }
  end

  ## Occurrence pass

  # Writes are batched into ~8MB binaries — a per-record IO.binwrite pays a
  # port round trip each call and dominated the first build (1.5k rows/s).
  @write_chunk_records 400_000
  @pos_write_chunk_records 100_000

  defp write_occurrences(path, occurrences) do
    {:ok, fd} = File.open(path, [:raw, :write, delayed_write()])

    state =
      occurrences
      |> Stream.chunk_every(@write_chunk_records)
      |> Enum.reduce(%{count: 0, min_gid: nil, max_gid: nil, prev: nil}, fn chunk, st ->
        st =
          Enum.reduce(chunk, st, fn {hash, gid, ply}, st ->
            if st.prev != nil and {hash, gid, ply} < st.prev do
              raise "packed build validation failed: occurrence stream is not sorted"
            end

            %{
              count: st.count + 1,
              min_gid: if(st.min_gid == nil or gid < st.min_gid, do: gid, else: st.min_gid),
              max_gid: if(st.max_gid == nil or gid > st.max_gid, do: gid, else: st.max_gid),
              prev: {hash, gid, ply}
            }
          end)

        IO.binwrite(
          fd,
          Enum.map(chunk, fn {hash, gid, ply} -> Format.occ_record(hash, gid, ply) end)
        )

        st
      end)

    File.close(fd)

    %{count: state.count, gids: %{min: state.min_gid, max: state.max_gid}}
  end

  ## Position pass (headers + strings + text bucket side stream)

  # Bucket entries stream to disk as text (`pawn_hash \t hash_hex`), then
  # get externally sorted — at the broadcast tier (72.4M distinct
  # positions) an in-memory Erlang list would cost ~4 GB.
  defp write_positions(dir, positions, pos_version) do
    headers_path = Path.join(dir, "pos-headers.tmp")
    strings_path = Path.join(dir, "pos-strings.tmp")
    buckets_txt_path = Path.join(dir, "bucket-unsorted.tsv")

    {:ok, headers} = File.open(headers_path, [:raw, :write, delayed_write()])
    {:ok, strings} = File.open(strings_path, [:raw, :write, delayed_write()])
    {:ok, buckets_txt} = File.open(buckets_txt_path, [:raw, :write, delayed_write()])

    state =
      positions
      |> Stream.chunk_every(@pos_write_chunk_records)
      |> Enum.reduce(%{count: 0, strings_bytes: 0, prev: nil}, fn chunk, st ->
        {st, header_buf, string_buf, bucket_buf} =
          Enum.reduce(chunk, {st, [], [], []}, fn row, {st, hbuf, sbuf, bbuf} ->
            {hash, pawn_hash, first_gid, first_ply, key_string, stats} = position_row(row)

            if st.prev != nil and hash < st.prev do
              raise "packed build validation failed: position stream is not sorted by hash"
            end

            len = byte_size(key_string)

            header =
              pos_header(
                pos_version,
                hash,
                pawn_hash,
                first_gid,
                first_ply,
                stats,
                st.strings_bytes,
                len
              )

            st = %{count: st.count + 1, strings_bytes: st.strings_bytes + len, prev: hash}

            bucket_line = [
              Integer.to_string(pawn_hash),
              ?\t,
              Base.encode16(hash, case: :lower),
              ?\n
            ]

            {st, [header | hbuf], [key_string | sbuf], [bucket_line | bbuf]}
          end)

        IO.binwrite(headers, Enum.reverse(header_buf))
        IO.binwrite(strings, Enum.reverse(string_buf))
        IO.binwrite(buckets_txt, Enum.reverse(bucket_buf))

        st
      end)

    File.close(headers)
    File.close(strings)
    File.close(buckets_txt)

    # Concatenate headers + strings into the final pos.bin.
    concat(headers_path, strings_path, Path.join(dir, "pos.bin"))

    %{count: state.count, strings_bytes: state.strings_bytes, buckets_txt: buckets_txt_path}
  end

  # v1 rows carry no run statistics; v2 rows carry all three.
  defp position_row({hash, pawn_hash, first_gid, first_ply, key_string}),
    do: {hash, pawn_hash, first_gid, first_ply, key_string, nil}

  defp position_row(
         {hash, pawn_hash, first_gid, first_ply, key_string, occurrence_count, game_count,
          occ_run_offset}
       ),
       do:
         {hash, pawn_hash, first_gid, first_ply, key_string,
          %{
            occurrence_count: occurrence_count,
            game_count: game_count,
            occ_run_offset: occ_run_offset
          }}

  defp pos_header(1, hash, pawn_hash, first_gid, first_ply, nil, string_offset, string_len) do
    Format.pos_header(hash, pawn_hash, first_gid, first_ply, string_offset, string_len)
  end

  defp pos_header(2, hash, pawn_hash, first_gid, first_ply, stats, string_offset, string_len) do
    if stats == nil or stats.occurrence_count == 0 do
      raise "packed build validation failed: position #{Base.encode16(hash, case: :lower)} has no occurrence-run statistics"
    end

    Format.pos_header_v2(
      hash,
      pawn_hash,
      stats.occurrence_count,
      stats.game_count,
      stats.occ_run_offset,
      first_gid,
      first_ply,
      string_offset,
      string_len
    )
  end

  ## Bucket pass (external sort of the text side stream, then binary map)

  # Sort order: pawn_hash numeric ascending, then hash byte-ascending.
  # That matches the packed bucket semantics' walk-back comparator
  # (big-endian u64 pawn_hash, then 16-byte hash, both unsigned).
  defp write_buckets(path, dir, buckets_txt) do
    sorted = buckets_txt <> ".sorted"

    {out, status} =
      System.cmd(
        "sort",
        [
          "-t",
          "\t",
          "-k1,1n",
          "-k2,2",
          "-S",
          "2G",
          "-T",
          dir,
          "--parallel=8",
          buckets_txt,
          "-o",
          sorted
        ],
        stderr_to_stdout: true,
        env: [{"LC_ALL", "C"}]
      )

    if status != 0, do: raise("bucket sort failed: #{out}")

    {:ok, out_fd} = File.open(path, [:raw, :write, delayed_write()])

    count =
      sorted
      |> Input.lines()
      |> Stream.chunk_every(@write_chunk_records)
      |> Enum.reduce(0, fn chunk, count ->
        IO.binwrite(
          out_fd,
          Enum.map(chunk, fn line ->
            [pawn_hash, hash_hex] = String.split(line, "\t")

            Format.bucket_record(
              String.to_integer(pawn_hash),
              Base.decode16!(hash_hex, case: :lower)
            )
          end)
        )

        count + length(chunk)
      end)

    File.close(out_fd)
    File.rm!(buckets_txt)
    File.rm!(sorted)

    count
  end

  ## Book pass (headers + blob region, sorted by hash)

  # The book stream is already grouped per key: `{hash, [{move, games,
  # white, draw, black}, …]}` with keys sorted ascending. Each entry is
  # written into the blob region; the header region records the offset.
  defp write_book(path, dir, books) do
    headers_path = Path.join(dir, "book-headers.tmp")
    blobs_path = Path.join(dir, "book-blobs.tmp")

    {:ok, headers} = File.open(headers_path, [:raw, :write, delayed_write()])
    {:ok, blobs} = File.open(blobs_path, [:raw, :write, delayed_write()])

    state =
      books
      |> Stream.chunk_every(@write_chunk_records)
      |> Enum.reduce(%{count: 0, bytes: 0, prev: nil}, fn chunk, st ->
        {st, header_buf, blob_buf} =
          Enum.reduce(chunk, {st, [], []}, fn {hash, entries}, {st, hbuf, bbuf} ->
            if st.prev != nil and hash < st.prev do
              raise "packed build validation failed: book stream is not sorted by hash"
            end

            blob =
              Enum.map(entries, fn {move, games, white, draw, black} ->
                Format.book_entry(move, games, white, draw, black)
              end)

            blob_bin = IO.iodata_to_binary(blob)
            len = byte_size(blob_bin)

            header = Format.book_header(hash, st.bytes, len)

            st = %{count: st.count + 1, bytes: st.bytes + len, prev: hash}

            {st, [header | hbuf], [blob_bin | bbuf]}
          end)

        IO.binwrite(headers, Enum.reverse(header_buf))
        IO.binwrite(blobs, Enum.reverse(blob_buf))

        st
      end)

    File.close(headers)
    File.close(blobs)

    concat(headers_path, blobs_path, path)
    cleanup([headers_path, blobs_path])

    %{count: state.count, bytes: state.count * @book_header_bytes + state.bytes}
  end

  ## Format-v2 statistics validation (Spike 09 Phase 2)

  # Recomputes the stored per-position statistics from occ.bin on a sampled
  # pass (evenly spread headers, always including the first and last) and
  # raises on any mismatch — a v2 segment must never publish with stats that
  # do not reproduce exactly. Each sampled header's run is verified the same
  # way `Segment.verify_run/2` does at read time: the run's first record is
  # the header's first occurrence, every record in the span carries the
  # header's hash, the adjacent-gid dedup equals the stored game count, and
  # the records just outside the span belong to other keys.
  defp validate_v2_stats!(dir, pos_count, occ_records, sample_n) when pos_count > 0 do
    pos_path = Path.join(dir, "pos.bin")
    occ_path = Path.join(dir, "occ.bin")
    {:ok, pos_fd} = File.open(pos_path, [:raw, :read])
    {:ok, occ_fd} = File.open(occ_path, [:raw, :read])

    indices = sample_indices(pos_count, sample_n)

    try do
      Enum.each(indices, fn idx ->
        {:ok, header} = :file.pread(pos_fd, idx * @pos_header_v2_bytes, @pos_header_v2_bytes)
        verify_v2_header!(occ_fd, occ_records, idx, header)
      end)
    after
      File.close(pos_fd)
      File.close(occ_fd)
    end

    :ok
  end

  defp validate_v2_stats!(_dir, 0, _occ_records, _sample_n), do: :ok

  defp verify_v2_header!(occ_fd, occ_records, idx, header) do
    {hash, _pawn_hash, occurrence_count, game_count, occ_run_offset, first_gid, first_ply,
     _string_offset, _string_len} = Format.decode_pos_header_v2(header)

    label = "pos record #{idx} (#{Base.encode16(hash, case: :lower)})"

    cond do
      occurrence_count == 0 ->
        raise "packed build validation failed: #{label} stores a zero occurrence count"

      occ_run_offset + occurrence_count > occ_records ->
        raise "packed build validation failed: #{label} run #{occ_run_offset}+#{occurrence_count} exceeds occ.bin (#{occ_records} records)"

      true ->
        {:ok, span} =
          :file.pread(
            occ_fd,
            occ_run_offset * @occ_record_bytes,
            occurrence_count * @occ_record_bytes
          )

        if byte_size(span) != occurrence_count * @occ_record_bytes do
          raise "packed build validation failed: #{label} short run read (#{byte_size(span)} bytes)"
        end

        <<span_hash::binary-size(16), span_gid::32, span_ply::16, _::binary>> = span

        if span_hash != hash or span_gid != first_gid or span_ply != first_ply do
          raise "packed build validation failed: #{label} run start is #{Base.encode16(span_hash, case: :lower)}/#{span_gid}/#{span_ply}, expected #{first_gid}/#{first_ply}"
        end

        unless all_records_hash?(span, hash) do
          raise "packed build validation failed: #{label} run span contains foreign hashes"
        end

        unless count_run_gids(span, nil, 0) == game_count do
          raise "packed build validation failed: #{label} stores game_count #{game_count}, the run recounts differently"
        end

        verify_boundary!(occ_fd, occ_records, hash, occ_run_offset - 1, label)
        verify_boundary!(occ_fd, occ_records, hash, occ_run_offset + occurrence_count, label)
    end
  end

  defp verify_boundary!(_occ_fd, _occ_records, _hash, idx, _label) when idx < 0, do: :ok

  defp verify_boundary!(occ_fd, occ_records, hash, idx, label) do
    if idx < occ_records do
      case :file.pread(occ_fd, idx * @occ_record_bytes, 16) do
        {:ok, ^hash} ->
          raise "packed build validation failed: #{label} run continues at record #{idx}"

        {:ok, _other} ->
          :ok

        {:error, reason} ->
          raise "packed build validation failed: #{label} boundary read failed: #{inspect(reason)}"
      end
    else
      :ok
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

  defp sample_indices(records, n) do
    step = max(1, div(records - 1, max(n - 1, 1)))

    0..(records - 1)//step
    |> Enum.take(n)
    |> Kernel.++([records - 1])
    |> Enum.uniq()
  end

  ## Helpers

  defp delayed_write, do: {:delayed_write, 32 * 1024 * 1024, 30_000}

  defp concat(from_a, from_b, to) do
    {:ok, out} = File.open(to, [:raw, :write, delayed_write()])

    Enum.each([from_a, from_b], fn path ->
      path
      |> File.stream!(4 * 1024 * 1024, [])
      |> Enum.each(&IO.binwrite(out, &1))
    end)

    File.close(out)
  end

  defp cleanup(paths) do
    Enum.each(paths, &File.rm/1)
  end

  defp file_info!(basename, full_path, expected_bytes) do
    bytes = File.stat!(full_path).size

    if bytes != expected_bytes do
      raise "packed build validation failed: #{basename} is #{bytes} bytes, expected #{expected_bytes}"
    end

    %{path: basename, bytes: bytes, sha256: sha256(full_path)}
  end

  defp sha256(path) do
    digest = :crypto.hash_init(:sha256)

    digest =
      path
      |> File.stream!(4 * 1024 * 1024, [])
      |> Enum.reduce(digest, fn chunk, acc -> :crypto.hash_update(acc, chunk) end)

    :crypto.hash_final(digest) |> Base.encode16(case: :lower)
  end
end
