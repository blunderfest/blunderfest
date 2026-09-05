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

  defp build_backend!(
         dir,
         occs,
         poss,
         id \\ "seg-000001",
         stride \\ 1024,
         books \\ [],
         opts \\ []
       ) do
    File.mkdir_p!(dir)
    entry = Builder.build!(dir, id, occs, poss, books, 100, opts)
    Manifest.write!(dir, [entry], entry.pos_version)
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

  test "bounded occurrences return the global prefix without the full run", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    backend = build_backend!(Path.join(dir, "packed"), occs, poss)

    # Prefix of the full run, at every limit.
    full_c = Packed.occurrences(backend, hash(@key_c))

    for limit <- 0..(length(full_c) + 1) do
      assert Packed.occurrences(backend, hash(@key_c), limit) == Enum.take(full_c, limit)
    end

    # A key missing entirely stays empty under a limit.
    assert Packed.occurrences(backend, hash("8/8/8/8/8/8/8/7K w - -"), 5) == []

    Packed.close(backend)
  end

  test "bounded occurrences merge interleaved segments in global order", %{tmp_dir: dir} do
    seg1_dir = Path.join(dir, "packed1")
    seg2_dir = Path.join(dir, "packed2")

    occs1 = [{hash(@key_a), 1, 4}, {hash(@key_a), 5, 2}] |> Enum.sort()
    poss1 = [{hash(@key_a), Features.pawn_hash(@key_a), 1, 4, @key_a}]
    b1 = build_backend!(seg1_dir, occs1, poss1)

    occs2 = [{hash(@key_a), 3, 9}] |> Enum.sort()
    poss2 = []
    b2 = build_backend!(seg2_dir, occs2, poss2)

    merged = %Packed{segments: b1.segments ++ b2.segments, stride: 1024, dir: nil}

    # Global order is [{1,4},{3,9},{5,2}] even though gid 3 lives in the
    # second segment — the bounded merge must not emit the first segment's
    # gid 5 before the second segment's gid 3.
    assert Packed.occurrences(merged, hash(@key_a), 2) == [{1, 4}, {3, 9}]
    assert Packed.occurrences(merged, hash(@key_a), 3) == [{1, 4}, {3, 9}, {5, 2}]

    Packed.close(b1)
    Packed.close(b2)
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
      Builder.build!(dir, "seg-bad", occs, poss, [], 1)
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

  test "the first open persists anchor sidecars; a reopen loads them", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    dir = Path.join(dir, "packed")

    backend = build_backend!(dir, occs, poss)
    [seg] = backend.segments
    assert seg.anchors_from == :rebuilt
    anchors = [seg.occ_anchors, seg.pos_anchors, seg.bucket_anchors, seg.book_anchors]

    # Sidecars land next to the segment files, one per non-empty index
    # (the fixture has no book entries, so book.bin has 0 records and no
    # sidecar).
    sidecars = Path.wildcard(Path.join([dir, "seg-000001", "*.anchors-*"]))
    assert length(sidecars) == 3

    Packed.close(backend)

    {:ok, reopened} = Packed.open(dir, stride: 1024)
    [seg2] = reopened.segments
    assert seg2.anchors_from == :sidecar

    assert [seg2.occ_anchors, seg2.pos_anchors, seg2.bucket_anchors, seg2.book_anchors] ==
             anchors

    # The sidecar-loaded backend answers identically.
    assert Packed.occurrences(reopened, hash(@key_c)) == [{1, 1}, {4, 1}, {4, 2}, {9, 1}]
    Packed.close(reopened)
  end

  test "a corrupt sidecar falls back to a rebuild and still opens correct", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()
    dir = Path.join(dir, "packed")

    backend = build_backend!(dir, occs, poss)
    [seg] = backend.segments
    good = seg.occ_anchors
    Packed.close(backend)

    # Truncate the occ sidecar: size no longer matches, so open must rebuild.
    [occ_sidecar] = Path.wildcard(Path.join([dir, "seg-000001", "occ.bin.anchors-*"]))
    {:ok, bin} = File.read(occ_sidecar)
    File.write!(occ_sidecar, binary_part(bin, 0, div(byte_size(bin), 2)))

    {:ok, reopened} = Packed.open(dir, stride: 1024)
    [seg2] = reopened.segments
    assert seg2.anchors_from == :rebuilt
    assert seg2.occ_anchors == good
    assert Packed.occurrences(reopened, hash(@key_c)) == [{1, 1}, {4, 1}, {4, 2}, {9, 1}]
    Packed.close(reopened)
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

  test "book round-trips per-key next-move distributions", %{tmp_dir: dir} do
    {occs, poss} = fixture_streams()

    books =
      [
        {hash(@key_a), [{"e5", 2, 2, 0, 0}, {"c5", 1, 0, 0, 1}]},
        {hash(@key_c), [{"Nf6", 3, 2, 1, 0}]}
      ]
      |> Enum.sort_by(fn {h, _} -> h end)

    backend = build_backend!(Path.join(dir, "packed"), occs, poss, "seg-000001", 1024, books)

    assert Packed.book(backend, hash(@key_a)) == [
             %{move: "e5", games: 2, white: 2, draw: 0, black: 0},
             %{move: "c5", games: 1, white: 0, draw: 0, black: 1}
           ]

    assert Packed.book(backend, hash(@key_c)) == [
             %{move: "Nf6", games: 3, white: 2, draw: 1, black: 0}
           ]

    assert Packed.book(backend, hash(@key_b)) == []
    assert Packed.book(backend, <<0::128>>) == []

    Packed.close(backend)
  end

  describe "format v2 (Spike 09 Phase 2)" do
    # Derive v2 position rows (with the pack-time run statistics) from an
    # already-sorted occurrence list, exactly the shape corpus.pack's
    # position_stream_v2 emits.
    defp v2_positions(occs, keys) do
      {rows, _offset} =
        occs
        |> Enum.chunk_by(fn {hash, _gid, _ply} -> hash end)
        |> Enum.map_reduce(0, fn run, offset ->
          {hash, first_gid, first_ply} = hd(run)
          key = Map.fetch!(keys, hash)
          games = run |> Enum.map(&elem(&1, 1)) |> Enum.uniq() |> length()

          row =
            {hash, Features.pawn_hash(key), first_gid, first_ply, key, length(run), games, offset}

          {row, offset + length(run)}
        end)

      rows
    end

    defp keys_by_hash(keys), do: Map.new(keys, fn key -> {hash(key), key} end)

    test "v2 build round-trips every query family identically to v1", %{tmp_dir: dir} do
      {occs, poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]
      poss2 = v2_positions(occs, keys_by_hash(keys))

      v1 = build_backend!(Path.join(dir, "v1"), occs, poss)

      v2 =
        build_backend!(Path.join(dir, "v2"), occs, poss2, "seg-000001", 1024, [], pos_version: 2)

      for key <- keys do
        assert Packed.occurrences(v2, hash(key)) == Packed.occurrences(v1, hash(key))
        assert Packed.occurrence_counts(v2, hash(key)) == Packed.occurrence_counts(v1, hash(key))
        assert Packed.position(v2, hash(key)) == Packed.position(v1, hash(key))
      end

      assert Packed.pawn_bucket(v2, Features.pawn_hash(@key_a)) ==
               Packed.pawn_bucket(v1, Features.pawn_hash(@key_a))

      [seg] = v2.segments
      assert seg.pos_version == 2
      assert seg.pos_header_bytes == 49

      Packed.close(v1)
      Packed.close(v2)
    end

    test "v2 position_stats returns the stored counts and run offset", %{tmp_dir: dir} do
      {occs, _poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]
      poss2 = v2_positions(occs, keys_by_hash(keys))

      backend =
        build_backend!(Path.join(dir, "v2"), occs, poss2, "seg-000001", 1024, [], pos_version: 2)

      # key_a: 3 occurrences across gids {1, 2}. Offsets are segment-local
      # — the segment accessor exposes them; the backend sums counts only.
      assert {:ok, %{occurrences: 3, games: 2}} = Packed.position_stats(backend, hash(@key_a))

      [seg] = backend.segments

      # The stored run offset is exactly the first occurrence's record
      # index in the (hash, gid, ply)-sorted run stream.
      for key <- [@key_a, @key_b, @key_c] do
        first = Enum.find_index(occs, fn {h, _gid, _ply} -> h == hash(key) end)
        count = Enum.count(occs, fn {h, _gid, _ply} -> h == hash(key) end)

        games =
          occs
          |> Enum.filter(fn {h, _, _} -> h == hash(key) end)
          |> Enum.map(&elem(&1, 1))
          |> Enum.uniq()
          |> length()

        assert {:ok, %{occurrences: ^count, games: ^games, run_offset: ^first}} =
                 Blunderfest.Corpus.Packed.Segment.position_stats(seg, hash(key))
      end

      # A key with no header sums to zero occurrences/games.
      assert {:ok, %{occurrences: 0, games: 0}} =
               Packed.position_stats(backend, hash("8/8/8/8/8/8/8/7K w - -"))

      # Stats equal the run-walking occurrence_counts for every key.
      for key <- keys do
        {:ok, stats} = Packed.position_stats(backend, hash(key))
        assert stats == Packed.occurrence_counts(backend, hash(key))
      end

      Packed.close(backend)
    end

    test "v2 verify_run passes on a clean build and reads the run back", %{tmp_dir: dir} do
      {occs, _poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]
      poss2 = v2_positions(occs, keys_by_hash(keys))

      backend =
        build_backend!(Path.join(dir, "v2"), occs, poss2, "seg-000001", 2, [], pos_version: 2)

      [seg] = backend.segments

      for key <- keys do
        assert :ok = Blunderfest.Corpus.Packed.Segment.verify_run(seg, hash(key))
      end

      assert {:error, {:no_position_header, _}} =
               Blunderfest.Corpus.Packed.Segment.verify_run(seg, <<0::128>>)

      assert :ok = Blunderfest.Corpus.Packed.Segment.verify_sampled_runs(seg, 8)

      Packed.close(backend)
    end

    test "position_stats reports format_v1 on a v1 segment", %{tmp_dir: dir} do
      {occs, poss} = fixture_streams()
      backend = build_backend!(Path.join(dir, "v1"), occs, poss)

      assert {:error, :format_v1} = Packed.position_stats(backend, hash(@key_a))
      [seg] = backend.segments

      assert {:error, :format_v1} =
               Blunderfest.Corpus.Packed.Segment.position_stats(seg, hash(@key_a))

      Packed.close(backend)
    end

    test "v2 builder validation rejects a corrupt run offset", %{tmp_dir: dir} do
      {occs, _poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]

      # Shift every stored run offset by one — the builder's sampled
      # re-count against occ.bin must refuse to publish.
      poss2 =
        v2_positions(occs, keys_by_hash(keys))
        |> Enum.map(fn {h, ph, g, p, key, occ, games, off} ->
          {h, ph, g, p, key, occ, games, off + 1}
        end)

      dir = Path.join(dir, "v2")
      File.mkdir_p!(dir)

      assert_raise RuntimeError, ~r/validation failed/, fn ->
        Builder.build!(dir, "seg-000001", occs, poss2, [], 100, pos_version: 2)
      end
    end

    test "v2 builder validation rejects a wrong game_count", %{tmp_dir: dir} do
      {occs, _poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]

      poss2 =
        v2_positions(occs, keys_by_hash(keys))
        |> Enum.map(fn {h, ph, g, p, key, occ, games, off} ->
          {h, ph, g, p, key, occ, games + 1, off}
        end)

      dir = Path.join(dir, "v2")
      File.mkdir_p!(dir)

      assert_raise RuntimeError, ~r/validation failed/, fn ->
        Builder.build!(dir, "seg-000001", occs, poss2, [], 100, pos_version: 2)
      end
    end

    test "manifest records version 2 and rejects unknown versions", %{tmp_dir: dir} do
      {occs, _poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]
      poss2 = v2_positions(occs, keys_by_hash(keys))

      dir = Path.join(dir, "v2")
      File.mkdir_p!(dir)
      entry = Builder.build!(dir, "seg-000001", occs, poss2, [], 100, pos_version: 2)
      Manifest.write!(dir, [entry], 2)

      json = dir |> Manifest.path() |> File.read!() |> Jason.decode!()
      assert json["version"] == 2
      assert hd(json["segments"])["pos_version"] == 2

      {:ok, backend} = Packed.open(dir)
      assert backend.segments |> hd() |> Map.fetch!(:pos_version) == 2
      Packed.close(backend)

      # An unknown manifest version must not open.
      bad = Map.put(json, "version", 3)
      File.write!(Manifest.path(dir), Jason.encode!(bad))
      assert {:error, {:unsupported_manifest_version, 3}} = Packed.open(dir)
    end

    test "bounded occurrences equal the full-run prefix on v2", %{tmp_dir: dir} do
      {occs, _poss} = fixture_streams()
      keys = [@key_a, @key_b, @key_c]
      poss2 = v2_positions(occs, keys_by_hash(keys))

      backend =
        build_backend!(Path.join(dir, "v2"), occs, poss2, "seg-000001", 1024, [], pos_version: 2)

      full_c = Packed.occurrences(backend, hash(@key_c))

      for limit <- 0..(length(full_c) + 1) do
        assert Packed.occurrences(backend, hash(@key_c), limit) == Enum.take(full_c, limit)
      end

      Packed.close(backend)
    end
  end
end
