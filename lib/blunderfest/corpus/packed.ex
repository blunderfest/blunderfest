defmodule Blunderfest.Corpus.Packed do
  @moduledoc """
  The packed occurrence backend (Spike 08): immutable sorted segments on
  disk behind a manifest, queried through the same interface the Postgres
  occurrence layer serves.

  Every function takes a list of open `Segment` structs (oldest first) and
  merges results across them:

    * `occurrences` — merged sorted by `(gid, ply)` (Postgres orders
      globally, so a two-segment merge interleaves; matching it is part of
      the parity contract);
    * `occurrence_counts` — summed occurrences, games as distinct gids
      across segments (the run-walking oracle; Phase 3 product paths use
      the header-backed `position_stats/2` instead);
    * `position` — first segment (build order) holding the key;
    * `first_occurrence` — the minimum of the per-segment header first
      occurrences (exact under any interleaving);
    * `pawn_bucket` — union of keys, sorted, deduplicated.

  `open/2` loads a packed data directory: reads the manifest, validates
  segment files (sizes, counts), opens the segments. Corrupt or partial
  builds fail to open rather than serving partial results (§18/§20).
  """

  alias Blunderfest.Corpus.Packed.{Manifest, Segment}

  defstruct [:dir, :segments, :stride]

  @type t :: %__MODULE__{}

  # 256 wins decisively at the broadcast tier (p50 20µs vs 43µs at 1024,
  # anchors ~5.6 MB for 94M records — trivially cheap; measured in the
  # follow-up validation's stride sweep).
  @default_stride 256

  def default_stride, do: @default_stride

  @doc """
  Opens a packed data directory (manifest + segments). Returns
  `{:ok, backend}` or `{:error, reason}`; nothing is served partially.
  """
  @spec open(Path.t(), keyword()) :: {:ok, t()} | {:error, term()}
  def open(dir, opts \\ []) do
    stride = Keyword.get(opts, :stride, @default_stride)

    with {:ok, manifest} <- Manifest.open(dir, opts),
         {:ok, segments} <- open_segments(manifest.segments, stride) do
      {:ok, %__MODULE__{dir: dir, segments: segments, stride: stride}}
    end
  end

  defp open_segments(entries, stride) do
    entries
    |> Enum.reduce_while({:ok, []}, fn entry, {:ok, acc} ->
      case Segment.open(entry, stride) do
        {:ok, segment} -> {:cont, {:ok, [segment | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, segments} -> {:ok, Enum.reverse(segments)}
      error -> error
    end
  end

  @doc "Closes every segment's file descriptors."
  def close(%__MODULE__{} = backend) do
    Enum.each(backend.segments, &Segment.close/1)
    :ok
  end

  @doc "Combined row counts across all segments."
  def counts(%__MODULE__{} = backend) do
    Enum.reduce(backend.segments, %{games: 0, occurrences: 0, positions: 0}, fn seg, acc ->
      %{
        games: acc.games + (seg.games_count || 0),
        occurrences: acc.occurrences + seg.occurrence_count,
        positions: acc.positions + seg.position_count
      }
    end)
  end

  @doc """
  `ORDER BY gid, ply` occurrences of a hash across all segments —
  explicitly unbounded, O(full run): reads and decodes every occurrence.
  Product paths that keep a prefix use `occurrences/3`; count questions use
  `position_stats/2`. This full list remains for callers that genuinely
  need the complete run (validation oracles, the packed-mode book
  recomputation).
  """
  def occurrences(%__MODULE__{} = backend, hash) do
    backend.segments
    |> Enum.flat_map(&Segment.occurrences(&1, hash))
    |> Enum.sort()
  end

  @doc """
  The first `limit` occurrences of a hash in global `(gid, ply)` order —
  exactly `occurrences/2 |> Enum.take(limit)`, with the read bounded.

  Two merge shapes:

    * **Disjoint gid ranges** (the production invariant — `corpus.pack`
      partitions gids into non-overlapping per-segment ranges, so a segment
      earlier in gid order carries only smaller gids): the segments are
      visited in gid order and each supplies at most the *remaining* global
      budget — `min(remaining, its run length)` records. A segment that
      holds 8 of a 12-record prefix costs 8 reads, the next segment at most
      4, and later segments are not read at all. On v2 segments each fetch
      is a run-offset prefix read, so the total occurrence bytes scale with
      `min(limit, result size)`, never the run length.
    * **Overlapping ranges** (test fixtures, defensive): each segment
      contributes its first `limit` tuples and the merge re-sorts globally.
      (The global first `limit` is always contained in the union of the
      per-segment first-`limit` prefixes, whatever the segments' gid
      ranges.) A hot key shared by many callers still never materializes
      its full run.
  """
  def occurrences(%__MODULE__{} = backend, hash, limit)
      when is_integer(limit) and limit >= 0 do
    if disjoint_gid_ranges?(backend.segments) do
      backend.segments
      |> Enum.sort_by(& &1.gids.min)
      |> fill_prefix(hash, limit, [])
    else
      backend.segments
      |> Enum.flat_map(&Segment.occurrences(&1, hash, limit))
      |> Enum.sort()
      |> Enum.take(limit)
    end
  end

  # Sequential prefix fill in gid order: each segment reads at most the
  # remaining global budget; once the budget is spent, later segments are
  # not queried at all (not even their headers).
  defp fill_prefix(_segments, _hash, remaining, acc) when remaining <= 0,
    do: acc |> Enum.reverse() |> Enum.concat()

  defp fill_prefix([], _hash, _remaining, acc), do: acc |> Enum.reverse() |> Enum.concat()

  defp fill_prefix([seg | rest], hash, remaining, acc) do
    occs = Segment.occurrences(seg, hash, remaining)
    fill_prefix(rest, hash, remaining - length(occs), [occs | acc])
  end

  # Segment gid ranges are disjoint when every segment carries a known
  # range and no two ranges overlap. Empty/unknown ranges (nil gids) force
  # the defensive sorted merge.
  defp disjoint_gid_ranges?(segments) do
    ranges = Enum.map(segments, & &1.gids)

    if Enum.any?(ranges, &(&1 == nil or &1.min == nil or &1.max == nil)) do
      false
    else
      ranges
      |> Enum.sort_by(& &1.min)
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.all?(fn [a, b] -> a.max < b.min end)
    end
  end

  @doc """
  The globally first occurrence of a hash — `{gid, ply}` or nil — without
  materializing any occurrence run: the minimum of the per-segment header
  first occurrences (`Segment.first_occurrence/2`, O(log anchors) each).
  Exact under any segment interleaving — a segment's stored first
  occurrence is the minimum within that segment, so the global minimum is
  the minimum of the segment minimums. Equal to
  `occurrences/2 |> List.first()` for every key.
  """
  def first_occurrence(%__MODULE__{} = backend, hash) do
    backend.segments
    |> Enum.reduce(nil, fn seg, acc ->
      case Segment.first_occurrence(seg, hash) do
        nil -> acc
        occ -> if acc == nil or occ < acc, do: occ, else: acc
      end
    end)
  end

  @doc "`%{occurrences, games}` for a hash across all segments."
  def occurrence_counts(%__MODULE__{segments: segments} = backend, hash) do
    counts = Enum.map(segments, &Segment.occurrence_counts(&1, hash))
    occ = Enum.sum(Enum.map(counts, & &1.occurrences))

    non_empty = Enum.count(counts, &(&1.occurrences > 0))

    # Single-segment common case: the segment's adjacent-dedup count is
    # exact. Across segments, distinct-gid counting requires the occurrence
    # tuples (gid namespaces differ per import); hot keys live in the bulk
    # segment, so this stays off the hot path.
    games =
      if non_empty <= 1 do
        Enum.sum(Enum.map(counts, & &1.games))
      else
        backend
        |> occurrences(hash)
        |> Enum.map(&elem(&1, 0))
        |> Enum.uniq()
        |> length()
      end

    %{occurrences: occ, games: games}
  end

  @doc "The position row for a hash — first segment holding it wins."
  def position(%__MODULE__{} = backend, hash) do
    Enum.find_value(backend.segments, &Segment.position(&1, hash))
  end

  @doc """
  The pack-time run statistics of a hash from the format-v2 headers —
  `{:ok, %{occurrences, games}}` summed over the segments holding the key.
  The sum is exact: segment gid ranges are disjoint (Spike 09 §6 — a game is
  packed exactly once), so per-segment occurrence and independent-game
  counts add without double counting. This is the bounded (O(log anchors)
  per segment) replacement for the run-walking `occurrence_counts/2`; it
  reads header fields only, never `occ.bin`.

  `{:error, :format_v1}` when a segment holding the key predates format v2
  (no stored stats); `%{occurrences: 0, games: 0}` for a key with no header
  anywhere. Segment-local run offsets are not summed — use
  `Segment.position_stats/2` per segment when an offset is needed.
  """
  def position_stats(%__MODULE__{segments: segments}, hash) do
    stats = Enum.map(segments, &segment_stats(&1, hash))

    if Enum.any?(stats, &match?({:error, :format_v1}, &1)) do
      {:error, :format_v1}
    else
      sums =
        Enum.reduce(stats, %{occurrences: 0, games: 0}, fn
          {:ok, s}, acc ->
            %{occurrences: acc.occurrences + s.occurrences, games: acc.games + s.games}

          :none, acc ->
            acc
        end)

      {:ok, sums}
    end
  end

  defp segment_stats(%Segment{pos_version: 1} = seg, hash) do
    # A v1 segment carries no stored stats; it only taints the sum when it
    # actually holds the key (the header lookup is the same bounded read).
    if Segment.position(seg, hash) == nil, do: :none, else: {:error, :format_v1}
  end

  defp segment_stats(%Segment{} = seg, hash), do: Segment.position_stats(seg, hash)

  @doc "Distinct canonical keys in a pawn bucket across segments, sorted."
  def pawn_bucket(%__MODULE__{} = backend, pawn_hash) do
    backend.segments
    |> Enum.flat_map(&Segment.pawn_bucket(&1, pawn_hash))
    |> Enum.uniq()
    |> Enum.sort()
  end

  @doc """
  The precomputed next-move distribution for a hash across segments.
  Segments partition gid ranges, so a game lives in exactly one segment and
  per-move counts sum exactly (independent-games semantics preserved).
  """
  def book(%__MODULE__{} = backend, hash) do
    backend.segments
    |> Enum.flat_map(&Segment.book(&1, hash))
    |> Enum.reduce(%{}, fn row, acc ->
      Map.update(acc, row.move, {row.games, row.white, row.draw, row.black}, fn {g, w, d, b} ->
        {g + row.games, w + row.white, d + row.draw, b + row.black}
      end)
    end)
    |> Enum.map(fn {move, {g, w, d, b}} ->
      %{move: move, games: g, white: w, draw: d, black: b}
    end)
    |> Enum.sort_by(fn row -> {-row.games, row.move} end)
  end

  @doc """
  The sum of the precomputed book's per-move game counts for a key. This
  counts **games that played some recorded continuation** — not "number of
  independent games containing this position" (a game that reaches the
  position and stops there, or whose next move is unrecorded, drops out;
  Spike 09 §12.8 measured that divergence at −87,264 for the start
  position). The authoritative independent-game count is the position's
  `game_count` — `position_stats/2`. Phase 3 stops serving this as
  `book_counts`; it stays available where the book-sum concept itself is
  wanted. A key with no book entry sums to 0.
  """
  def book_games_count(%__MODULE__{} = backend, hash) do
    backend
    |> book(hash)
    |> Enum.sum_by(& &1.games)
  end

  @doc """
  Bounded bucket: resolves only the first `limit` pos-hashes in the
  bucket's run order, then returns their keys sorted lexicographically.

  Semantics differ from `pawn_bucket/2` only when the bucket exceeds
  `limit`: PG's `ORDER BY key LIMIT n` picks the lexicographically-first
  keys, while this picks by position-hash order. The pipeline's structural
  cap is a performance knob (re-ranking follows), not a semantic
  contract — documented in the Broadcast validation report (§17
  condition B).
  """
  def pawn_bucket(%__MODULE__{} = backend, pawn_hash, limit) when is_integer(limit) do
    backend.segments
    |> Enum.flat_map(&Segment.pawn_bucket(&1, pawn_hash, limit))
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.take(limit)
  end
end
