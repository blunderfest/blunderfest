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

  Caps: `:exact_limit` (default 100), `:limit` for structural candidates
  (default 40), `:bucket_limit` for how many distinct bucket keys are
  scanned (default 2000). Exact candidates keep **every** occurrence —
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

    exact =
      ref_key
      |> Blunderfest.Corpus.occurrences()
      |> Enum.take(Keyword.get(opts, :exact_limit, 100))
      |> Enum.map(fn {gid, ply} -> candidate(:exact, ref_key, gid, ply, ref) end)

    %{
      exact: exact,
      structural: structural_candidates(ref, opts),
      reference: ref
    }
  end

  defp structural_candidates(ref, opts) do
    limit = Keyword.get(opts, :limit, 40)
    bucket_limit = Keyword.get(opts, :bucket_limit, 2000)

    ref_key = ref.key

    ref_key
    |> Features.from_key()
    |> Features.pawn_hash()
    |> Blunderfest.Corpus.pawn_bucket()
    |> Enum.reject(&(&1 == ref_key))
    |> Enum.take(bucket_limit)
    |> Enum.flat_map(fn key ->
      feats = Features.from_key(key)

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

  defp candidate(strategy, key, gid, ply, feats) do
    overlap = Features.piece_overlap(feats, feats)

    %{
      id: "#{strategy}-#{gid}-#{ply}",
      strategy: strategy,
      key: key,
      gid: gid,
      ply: ply,
      features: feats,
      dims: Differences.dimensions(feats, feats),
      why: why(strategy, key, overlap)
    }
  end

  defp why(:exact, key, _overlap) do
    n = length(Blunderfest.Corpus.occurrences(key))
    "exact position occurrence (#{n} occurrence#{if n == 1, do: "", else: "s"} total)"
  end

  defp why(:pawn_skeleton, _key, overlap) do
    "same pawn skeleton; #{overlap.matches}/#{overlap.ref_pieces} pieces match"
  end
end
