defmodule Blunderfest.Corpus.Packed.Format do
  @moduledoc """
  The packed corpus record formats (Spike 08, §3). Fixed-width, big-endian.

  **occ.bin** — one occurrence, sorted by `(hash128, gid, ply)`:

      <<hash::binary-size(16), gid::32, ply::16>>       — 22 bytes

  **pos.bin** — one distinct position key. Two regions: a header region of
  fixed-width sorted-by-hash headers, then a strings region with the canonical
  key strings. Header:

      <<hash::binary-size(16),          # position key hash
        pawn_hash::unsigned-64,         # pawn-skeleton bucket hash
        first_gid::unsigned-32,         # first occurrence gid
        first_ply::unsigned-16,         # first occurrence ply
        string_offset::unsigned-32,     # into the strings region
        string_len::unsigned-16>>       — 36 bytes

  **bucket.bin** — pawn-bucket membership, sorted by `(pawn_hash, pos_hash)`:

      <<pawn_hash::unsigned-64, pos_hash::binary-size(16>>  — 24 bytes

  Key strings are stored exactly once (positions always outnumber
  occurrences) — the occurrence file carries hashes, never strings.
  """

  @occ_record_bytes 22
  @pos_header_bytes 36
  @bucket_record_bytes 24

  def occ_record_bytes, do: @occ_record_bytes
  def pos_header_bytes, do: @pos_header_bytes
  def bucket_record_bytes, do: @bucket_record_bytes

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

  def bucket_record(pawn_hash, pos_hash) when is_integer(pawn_hash) do
    <<pawn_hash::64, pos_hash::binary-size(16)>>
  end

  def decode_bucket(<<pawn_hash::64, pos_hash::binary-size(16)>>) do
    {pawn_hash, pos_hash}
  end
end
