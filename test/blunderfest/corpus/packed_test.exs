defmodule Blunderfest.Corpus.PackedTest do
  @moduledoc """
  Unit tests for the packed occurrence backend: build → manifest → open →
  query roundtrip, including the hot-key walk-back, missing keys, and the
  build-time sortedness validation.
  """

  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.Features
  alias Blunderfest.Corpus.Packed
  alias Blunderfest.Corpus.Packed.{Builder, Manifest}
  alias Blunderfest.Corpus.PositionKey

  @moduletag :tmp_dir

  @key_a "8/8/8/8/8/8/8/K6k w - -"
  @key_b "8/8/8/8/8/8/8/K6k b - -"
  @key_c "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"

  defp hash(key), do: PositionKey.to_hash128(key)

  defp build_backend!(dir, occs, poss, id \\ "seg-000001", stride \\ 1024) do
    File.mkdir_p!(dir)
    entry = Builder.build!(dir, id, occs, poss, 100)
    Manifest.write!(dir, [entry])
    {:ok, backend} = Packed.open(dir, stride: stride)
    backend
  end

  # The default fixture: key_a twice in one game, hot key_c, key_b singleton.
  defp fixture_streams do
    occs =
      [
        {hash(@key_a), 1, 4},
        {hash(@key_a), 2, 4},
        {hash(@key_a), 2, 10},
        {hash(@key_b), 3, 7},
        {hash(@key_c), 1, 1},
        {hash(@key_c), 4, 1},
        {hash(@key_c), 4, 2},
        {hash(@key_c), 9, 1}
      ]
      |> Enum.sort()

    poss =
      [
        {hash(@key_a), Features.pawn_hash(@key_a), 1, 4, @key_a},
        {hash(@key_b), Features.pawn_hash(@key_b), 3, 7, @key_b},
        {hash(@key_c), Features.pawn_hash(@key_c), 1, 1, @key_c}
      ]
      |> Enum.sort_by(fn {h, _, _, _, _} -> h end)

    {occs, poss}
  end

  test "occurrences round-trip in gid/ply order", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    assert Packed.occurrences(backend, hash(@key_a)) == [{1, 4}, {2, 4}, {2, 10}]
    assert Packed.occurrences(backend, hash(@key_c)) == [{1, 1}, {4, 1}, {4, 2}, {9, 1}]
    assert Packed.occurrences(backend, hash(@key_b)) == [{3, 7}]

    Packed.close(backend)
  end

  test "missing key returns empty occurrences and zero counts", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    assert Packed.occurrences(backend, <<0::128>>) == []
    assert Packed.occurrence_counts(backend, <<0::128>>) == %{occurrences: 0, games: 0}
    assert Packed.position(backend, <<0::128>>) == nil

    Packed.close(backend)
  end

  test "occurrence_counts counts distinct games", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    assert Packed.occurrence_counts(backend, hash(@key_c)) == %{occurrences: 4, games: 3}
    assert Packed.occurrence_counts(backend, hash(@key_a)) == %{occurrences: 3, games: 2}
    assert Packed.occurrence_counts(backend, hash(@key_b)) == %{occurrences: 1, games: 1}

    Packed.close(backend)
  end

  test "position round-trips the header and the key string", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    pos = Packed.position(backend, hash(@key_b))

    assert pos.key == @key_b
    assert pos.pawn_hash == Features.pawn_hash(@key_b)
    assert pos.first_gid == 3
    assert pos.first_ply == 7

    Packed.close(backend)
  end

  test "pawn_bucket returns distinct sorted keys sharing the skeleton", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    # Both bare-king keys share one skeleton.
    assert Packed.pawn_bucket(backend, Features.pawn_hash(@key_a)) == [@key_b, @key_a]
    assert Packed.pawn_bucket(backend, Features.pawn_hash(@key_c)) == [@key_c]
    assert Packed.pawn_bucket(backend, 123_456) == []

    Packed.close(backend)
  end

  test "build rejects an unsorted occurrence stream", %{tmp_dir: dir} do
    dir = Path.join(dir, "packed")
    File.mkdir_p!(dir)

    occs = [{hash(@key_c), 1, 1}, {hash(@key_a), 1, 4}] |> Enum.sort() |> Enum.reverse()
    poss = [{hash(@key_a), Features.pawn_hash(@key_a), 1, 4, @key_a}]

    assert_raise RuntimeError, ~r/not sorted/, fn ->
      Builder.build!(dir, "seg-bad", occs, poss, 1)
    end
  end

  test "open rejects a tampered file (size mismatch)", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    dir = Path.join(dir, "packed")
    backend = build_backend!(dir, occs, poss)
    Packed.close(backend)

    # Corrupt occ.bin: truncate a byte.
    occ_path = Path.join([dir, "seg-000001", "occ.bin"])
    {:ok, bin} = File.read(occ_path)
    File.write!(occ_path, binary_part(bin, 0, byte_size(bin) - 1))

    assert {:error, _reason} = Packed.open(dir)
  end

  test "two segments merge occurrence results in gid/ply order", %{tmp_dir: dir} do
    # Segment 1: old gids; segment 2: newer gids.
    seg1_dir = Path.join(dir, "packed1")
    seg2_dir = Path.join(dir, "packed2")

    occs1 = [{hash(@key_a), 1, 4}, {hash(@key_a), 5, 2}] |> Enum.sort()
    poss1 = [{hash(@key_a), Features.pawn_hash(@key_a), 1, 4, @key_a}]
    b1 = build_backend!(seg1_dir, occs1, poss1)

    occs2 = [{hash(@key_a), 3, 9}] |> Enum.sort()
    poss2 = []
    b2 = build_backend!(seg2_dir, occs2, poss2)

    merged = %Packed{segments: b1.segments ++ b2.segments, stride: 1024, dir: nil}

    assert Packed.occurrences(merged, hash(@key_a)) == [{1, 4}, {3, 9}, {5, 2}]
    assert Packed.occurrence_counts(merged, hash(@key_a)) == %{occurrences: 3, games: 3}

    Packed.close(b1)
    Packed.close(b2)
  end

  test "walk-back across chunk boundaries with a tiny stride", %{tmp_dir: dir} do
    # A hot key spans many chunks when stride is small: the scan must walk
    # back across anchors and stitch the full run correctly.
    occs =
      for(gid <- 1..20, ply <- 1..2, do: {hash(@key_a), gid, ply})
      |> Enum.sort()

    poss = [{hash(@key_a), Features.pawn_hash(@key_a), 1, 1, @key_a}]

    backend = build_backend!(Path.join(dir, "packed"), occs, poss, "seg-000001", 2)

    expected = for gid <- 1..20, ply <- 1..2, do: {gid, ply}
    assert Packed.occurrences(backend, hash(@key_a)) == expected
    assert Packed.occurrence_counts(backend, hash(@key_a)) == %{occurrences: 40, games: 20}

    Packed.close(backend)
  end

  test "run divided across a chunk boundary (keys before and after the run)", %{tmp_dir: dir} do
    # Two neighboring keys share a chunk; each must return only its own run.
    occs =
      ([{hash(@key_b), 1, 1}, {hash(@key_b), 1, 2}, {hash(@key_c), 2, 1}] ++
         [{hash(@key_a), 3, 1}, {hash(@key_a), 3, 2}])
      |> Enum.sort()

    poss =
      [
        {hash(@key_a), Features.pawn_hash(@key_a), 3, 1, @key_a},
        {hash(@key_b), Features.pawn_hash(@key_b), 1, 1, @key_b},
        {hash(@key_c), Features.pawn_hash(@key_c), 2, 1, @key_c}
      ]
      |> Enum.sort_by(fn {h, _, _, _, _} -> h end)

    backend = build_backend!(Path.join(dir, "packed"), occs, poss, "seg-000001", 2)

    assert Packed.occurrences(backend, hash(@key_b)) == [{1, 1}, {1, 2}]
    assert Packed.occurrences(backend, hash(@key_a)) == [{3, 1}, {3, 2}]
    assert Packed.occurrences(backend, hash(@key_c)) == [{2, 1}]

    Packed.close(backend)
  end

  test "read_string raises instead of returning corrupt strings", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    # Truncate pos.bin to break the strings-region read.
    seg = hd(backend.segments)
    pos_file = Path.join([dir, "packed", "seg-000001", "pos.bin"])
    {:ok, bin} = File.read(pos_file)
    File.write!(pos_file, binary_part(bin, 0, seg.position_count * 36 + 2))

    assert_raise RuntimeError, fn ->
      Packed.position(backend, hash(@key_b))
    end

    Packed.close(backend)
  end
end
