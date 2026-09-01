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
      in memory).
  """

  alias Blunderfest.Corpus.Packed.{Format, Input}

  @occ_record_bytes Format.occ_record_bytes()
  @pos_header_bytes Format.pos_header_bytes()
  @bucket_record_bytes Format.bucket_record_bytes()

  @doc """
  Builds the segment `id` under the packed root `root_dir` (files land in
  `root_dir/id/`) and returns a manifest entry map whose file paths are
  relative to the root. Raises on any validation failure — the segment must
  never publish.
  """
  @spec build!(
          Path.t(),
          String.t(),
          occ_stream :: Enumerable.t(),
          pos_stream :: Enumerable.t(),
          games_count :: non_neg_integer() | nil
        ) :: map()
  def build!(root_dir, id, occurrences, positions, games_count) do
    dir = Path.join(root_dir, id)
    File.mkdir_p!(dir)

    occ = write_occurrences(Path.join(dir, "occ.bin"), occurrences)
    pos = write_positions(dir, positions)

    bucket_count = write_buckets(Path.join(dir, "bucket.bin"), dir, pos.buckets_txt)

    if bucket_count != pos.count do
      raise "packed build validation failed: #{bucket_count} bucket entries for #{pos.count} positions"
    end

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
          pos.count * @pos_header_bytes + pos.strings_bytes
        ),
      bucket:
        file_info!(
          Path.join(id, "bucket.bin"),
          Path.join(dir, "bucket.bin"),
          bucket_count * @bucket_record_bytes
        )
    }

    cleanup([Path.join(dir, "pos-headers.tmp"), Path.join(dir, "pos-strings.tmp")])

    %{
      id: id,
      games: games_count,
      occurrences: occ.count,
      positions: pos.count,
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
  defp write_positions(dir, positions) do
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
          Enum.reduce(chunk, {st, [], [], []}, fn {hash, pawn_hash, first_gid, first_ply,
                                                   key_string},
                                                  {st, hbuf, sbuf, bbuf} ->
            if st.prev != nil and hash < st.prev do
              raise "packed build validation failed: position stream is not sorted by hash"
            end

            len = byte_size(key_string)

            header =
              Format.pos_header(hash, pawn_hash, first_gid, first_ply, st.strings_bytes, len)

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
