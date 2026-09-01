defmodule Blunderfest.Corpus.Search.Candidates do
  @moduledoc """
  Candidate generation (design brief §7): exact-position occurrences plus
  the pawn-skeleton bucket, both capped.

  The two retrieval strategies stay independently observable — candidates
  carry their `:strategy`, their computed `:dims` (brief §8) and a `:why`
  line, never a merged score:

    * `:exact` — every occurrence of the reference key.
    * `:pawn_skeleton` — positions sharing the reference's pawn skeleton
      (the Spike 01/02 structural bucket), ranked by piece-overlap matches
      (Spike 02's strategy B). Uncontrolled relaxed retrieval is
      deliberately not implemented: it produced ~1M candidates for a
      typical position in the research phase.

  Caps: `:exact_limit` (default 12), `:limit` for structural candidates
  (default 10), `:bucket_limit` for how many distinct bucket keys are read
  (default 2000) and `:scan_limit` for how many of those keys get their
  occurrences fetched (default 30) — bucket keys are ranked by piece
  overlap *before* any occurrence query, so the expensive lookups run for
  the top-ranked keys only. Exact candidates keep **every** occurrence —
  repeated positions inside one game are exposed by the evidence layer as a
  same-game flag, not silently dropped. Structural candidates are
  deduplicated by `{key, gid}` (first occurrence wins), since their purpose
  is distinct *positions*, not occurrence counts.

  Reads go through the `Blunderfest.Corpus` facade, keeping the retrieval
  internals behind the boundary.
  """

  alias Blunderfest.Corpus.Analysis.{Differences, Features}

  @type candidate :: %{
          id: String.t(),
          strategy: :exact | :pawn_skeleton,
          key: String.t(),
          gid: pos_integer(),
          ply: pos_integer(),
          features: Features.t(),
          dims: map(),
          why: String.t()
        }

  @doc """
  Generates the capped candidate lists for a reference key. Returns
  `%{exact: [candidate], structural: [candidate], reference: Features.t()}`.
  """
  @spec generate(String.t(), keyword()) :: %{
          exact: [candidate],
          structural: [candidate],
          reference: Features.t()
        }
  def generate(ref_key, opts \\ []) do
    ref = Features.from_key(ref_key)

    # The occurrence list feeds the family clustering and used to drive the
    # counts/next-moves. It is bounded (families are heuristic; the exact
    # counts and next-move distribution come from SQL in the pipeline), so a
    # hot key like the start position never materializes a million rows.
    occurrence_limit = Keyword.get(opts, :occurrence_limit, 2000)

    exact_occurrences =
      ref_key
      |> Blunderfest.Corpus.occurrences()
      |> Enum.take(occurrence_limit)

    exact_total =
      case Blunderfest.Corpus.occurrence_counts(ref_key) do
        {:error, _} -> length(exact_occurrences)
        %{occurrences: n} -> n
      end

    exact =
      exact_occurrences
      |> Enum.take(Keyword.get(opts, :exact_limit, 12))
      |> Enum.map(fn {gid, ply} ->
        candidate(:exact, ref_key, gid, ply, ref, exact_total)
      end)

    %{
      exact: exact,
      exact_occurrences: exact_occurrences,
      structural: structural_candidates(ref, opts),
      reference: ref
    }
  end

  defp structural_candidates(ref, opts) do
    limit = Keyword.get(opts, :limit, 10)
    bucket_limit = Keyword.get(opts, :bucket_limit, 2000)
    # The keys whose occurrences are actually fetched: ranking by piece
    # overlap is pure local computation (features only), so the expensive
    # occurrence queries run for the top-ranked keys alone — the bucket
    # scan goes from N queries per key to a handful. (Measured: the KID
    # tabiya's 365-key bucket dropped from ~2.2s to ~0.3s.)
    scan_limit = Keyword.get(opts, :scan_limit, 30)

    ref_key = ref.key

    # The bucket fetch is bounded at the store layer: hot broadcast buckets
    # (~370k keys) would otherwise resolve every key before the cap applies
    # (measured ~26 s on the packed backend at 1.17M). The two backends
    # pick different first-N subsets on oversized buckets — documented in
    # the Broadcast validation report.
    ref_key
    |> Features.from_key()
    |> Features.pawn_hash()
    |> Blunderfest.Corpus.pawn_bucket(bucket_limit)
    |> Enum.reject(&(&1 == ref_key))
    |> Enum.map(fn key -> {key, Features.from_key(key)} end)
    |> Enum.sort_by(fn {key, feats} ->
      {-Features.piece_overlap(ref, feats).matches, key}
    end)
    |> Enum.take(scan_limit)
    |> Enum.flat_map(fn {key, feats} ->
      key
      |> Blunderfest.Corpus.occurrences()
      |> Enum.take(8)
      |> Enum.map(fn {gid, ply} ->
        {candidate(:pawn_skeleton, key, gid, ply, feats), feats}
      end)
    end)
    |> Enum.uniq_by(fn {cand, _feats} -> {cand.key, cand.gid} end)
    |> Enum.map(fn {cand, feats} ->
      %{cand | dims: Differences.dimensions(ref, feats)}
    end)
    |> Enum.sort_by(fn cand ->
      {-cand.dims.piece_placement.matches, cand.gid, cand.ply}
    end)
    |> Enum.take(limit)
  end

  defp candidate(strategy, key, gid, ply, feats, exact_total \\ nil) do
    overlap = Features.piece_overlap(feats, feats)

    %{
      id: "#{strategy}-#{gid}-#{ply}",
      strategy: strategy,
      key: key,
      gid: gid,
      ply: ply,
      features: feats,
      dims: Differences.dimensions(feats, feats),
      why: why(strategy, key, overlap, exact_total)
    }
  end

  # The exact total rides in from the one occurrence fetch; the structural
  # why needs no extra query (the evidence stage fetches counts anyway).
  defp why(:exact, _key, _overlap, n) do
    "exact position occurrence (#{n} occurrence#{if n == 1, do: "", else: "s"} total)"
  end

  defp why(:pawn_skeleton, _key, overlap, _exact_total) do
    "same pawn skeleton; #{overlap.matches}/#{overlap.ref_pieces} pieces match"
  end
end
