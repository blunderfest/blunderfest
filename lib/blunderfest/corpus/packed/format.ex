defmodule Blunderfest.Corpus.Packed.Format do
  @moduledoc """
  The packed corpus record formats (Spike 08, §3). Fixed-width, big-endian.

  **occ.bin** — one occurrence, sorted by `(hash128, gid, ply)`:

      <<hash::binary-size(16), gid::32, ply::16>>       — 22 bytes

  **pos.bin** — one distinct position key. Two regions: a header region of
  fixed-width sorted-by-hash headers, then a strings region with the canonical
  key strings. Header v1:

      <<hash::binary-size(16),          # position key hash
        pawn_hash::unsigned-64,         # pawn-skeleton bucket hash
        first_gid::unsigned-32,         # first occurrence gid
        first_ply::unsigned-16,         # first occurrence ply
        string_offset::unsigned-32,     # into the strings region
        string_len::unsigned-16>>       — 36 bytes

  Header v2 (Spike 09 §6 — the format-v2 repack): the three derived
  per-position statistics computed at pack time, so count/stat questions and
  bounded occurrence reads never walk the run:

      <<hash::binary-size(16),          # position key hash
        pawn_hash::unsigned-64,         # pawn-skeleton bucket hash
        occurrence_count::unsigned-32,  # run length in occ.bin
        game_count::unsigned-32,        # distinct gids in the run
        occ_run_offset::unsigned-40,    # first record index of the run
        first_gid::unsigned-32,         # first occurrence gid
        first_ply::unsigned-16,         # first occurrence ply
        string_offset::unsigned-32,     # into the strings region
        string_len::unsigned-16>>       — 49 bytes

  `occ_run_offset` is segment-local (each segment's `occ.bin` is its own
  address space) and addresses 1.1 T occurrences; the run length is
  `occurrence_count`, so the run is the exact span
  `occ.bin[occ_run_offset, occurrence_count)`.

  **bucket.bin** — pawn-bucket membership, sorted by `(pawn_hash, pos_hash)`:

      <<pawn_hash::unsigned-64, pos_hash::binary-size(16>>  — 24 bytes

  **book.bin** — the precomputed next-move distribution per key. Headers
  sorted by hash, then a blob region of per-key move entries (like
  `pos.bin`'s strings region):

      header:  <<hash::binary-size(16), offset::32, len::16>>   — 22 bytes
      entry:   <<move_len::8, move::binary,                     — variable
                 games::32, white::32, draw::32, black::32>>

  Only keys with at least one next move get a header; a lookup miss means
  a terminal position (empty book). Entries are stored sorted by
  `(games desc, move)` so readers need no re-sort.

  Key strings are stored exactly once (positions always outnumber
  occurrences) — the occurrence file carries hashes, never strings.
  """

  @occ_record_bytes 22
  @pos_header_bytes 36
  @pos_header_v2_bytes 49
  @bucket_record_bytes 24
  @book_header_bytes 22

  def occ_record_bytes, do: @occ_record_bytes
  def pos_header_bytes, do: @pos_header_bytes
  def bucket_record_bytes, do: @bucket_record_bytes
  def book_header_bytes, do: @book_header_bytes

  @doc "The pos.bin header width of a format version (1 → 36 B, 2 → 49 B)."
  def pos_header_bytes(1), do: @pos_header_bytes
  def pos_header_bytes(2), do: @pos_header_v2_bytes

  def occ_record(hash, gid, ply) when byte_size(hash) == 16 do
    <<hash::binary-size(16), gid::32, ply::16>>
  end

  def decode_occ(<<hash::binary-size(16), gid::32, ply::16>>) do
    {hash, gid, ply}
  end

  def pos_header(hash, pawn_hash, first_gid, first_ply, string_offset, string_len)
      when byte_size(hash) == 16 do
    <<hash::binary-size(16), pawn_hash::64, first_gid::32, first_ply::16, string_offset::32,
      string_len::16>>
  end

  def decode_pos_header(
        <<hash::binary-size(16), pawn_hash::64, first_gid::32, first_ply::16, string_offset::32,
          string_len::16>>
      ) do
    {hash, pawn_hash, first_gid, first_ply, string_offset, string_len}
  end

  @doc """
  One v2 pos header (49 bytes): the v1 fields plus the pack-time statistics
  `occurrence_count`, `game_count` and the segment-local `occ_run_offset`.
  """
  def pos_header_v2(
        hash,
        pawn_hash,
        occurrence_count,
        game_count,
        occ_run_offset,
        first_gid,
        first_ply,
        string_offset,
        string_len
      )
      when byte_size(hash) == 16 do
    <<hash::binary-size(16), pawn_hash::64, occurrence_count::32, game_count::32,
      occ_run_offset::40, first_gid::32, first_ply::16, string_offset::32, string_len::16>>
  end

  def decode_pos_header_v2(
        <<hash::binary-size(16), pawn_hash::64, occurrence_count::32, game_count::32,
          occ_run_offset::40, first_gid::32, first_ply::16, string_offset::32, string_len::16>>
      ) do
    {hash, pawn_hash, occurrence_count, game_count, occ_run_offset, first_gid, first_ply,
     string_offset, string_len}
  end

  def bucket_record(pawn_hash, pos_hash) when is_integer(pawn_hash) do
    <<pawn_hash::64, pos_hash::binary-size(16)>>
  end

  def decode_bucket(<<pawn_hash::64, pos_hash::binary-size(16)>>) do
    {pawn_hash, pos_hash}
  end

  ## Book records

  @doc "One book header: `<<hash16, offset32, len16>>` (22 bytes)."
  def book_header(hash, offset, len) when byte_size(hash) == 16 do
    <<hash::binary-size(16), offset::32, len::16>>
  end

  def decode_book_header(<<hash::binary-size(16), offset::32, len::16>>) do
    {hash, offset, len}
  end

  @doc """
  One book entry: `<<move_len8, move bytes, games32, white32, draw32, black32>>`.
  Entries for a key are stored sorted by `(games desc, move)`.
  """
  def book_entry(move, games, white, draw, black) do
    len = byte_size(move)

    if len > 255 do
      raise "book move token too long: #{move}"
    end

    <<len::8, move::binary-size(len), games::32, white::32, draw::32, black::32>>
  end

  @doc "Parses one key's blob into `%{move, games, white, draw, black}` rows."
  def decode_book_blob(blob) do
    decode_book_blob(blob, [])
  end

  defp decode_book_blob(<<>>, acc), do: Enum.reverse(acc)

  defp decode_book_blob(
         <<move_len::8, rest::binary>>,
         acc
       ) do
    <<move::binary-size(^move_len), games::32, white::32, draw::32, black::32, more::binary>> =
      rest

    decode_book_blob(more, [
      %{move: move, games: games, white: white, draw: draw, black: black} | acc
    ])
  end
end
