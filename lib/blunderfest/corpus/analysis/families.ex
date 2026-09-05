defmodule Blunderfest.Corpus.Analysis.Families do
  @moduledoc """
  Continuation families (design brief §10, port of Spike 04's family
  construction).

  A reference position has a **decision menu**: the distinct continuations
  actually played after it, taken from the position's exact occurrences.
  `build/2` clusters those continuations by single-linkage union-find at a
  representation metric and threshold; `membership/3` then answers whether
  a candidate continuation joins a family (similarity ≥ threshold to at
  least one member — the single-linkage rule).

  Validated settings (Spike 04, report §2.2): F1 separates its two plans at
  multiset@0.5, window 4; A2 separates Marshall from Closed at LCS@0.6,
  window 4. The app default is window 6, `:multiset`, 0.5 — the slice ships
  one general setting; per-reference tuning is deliberately out of scope.

  Important (Spike 06): this clustering is **not** to be replaced by
  skeleton clustering — skeleton-based clustering chains unrelated families
  together. The plan skeleton is a *membership/annotation* layer on top of
  these families, handled separately.
  """

  alias Blunderfest.Corpus.Analysis.{Continuation, Skeleton}

  @type metric :: :lcs | :multiset | :piece_dest | :piece
  @type cfg :: %{window: pos_integer(), metric: metric(), threshold: float()}
  @type menu :: [map()]

  @default %{window: 6, metric: :multiset, threshold: 0.5}

  @doc "The slice-wide family settings."
  @spec default() :: cfg()
  def default, do: @default

  @doc """
  Builds the decision menu from the exact occurrences' continuations.
  `entries` are `{gid, ply, sans}` triples (full candidate windows — they
  are truncated to `cfg.window` here). Returns families sorted by
  occurrence count, each with `:id`, `:occurrences`, `:games`,
  `:contains_reference?` and `:members` (`%{seq, count}`).
  """
  @spec build([{pos_integer(), pos_integer(), [String.t()]}], cfg()) :: menu()
  def build(entries, cfg) do
    window = cfg.window

    seqs =
      entries
      |> Enum.map(fn {gid, ply, sans} -> {gid, ply, Enum.take(sans, window)} end)
      |> Enum.reject(fn {_gid, _ply, w} -> w == [] end)
      |> Enum.reduce(%{}, fn {gid, _ply, w}, acc ->
        Map.update(acc, w, %{count: 1, games: MapSet.new([gid])}, fn s ->
          %{s | count: s.count + 1, games: MapSet.put(s.games, gid)}
        end)
      end)
      |> Enum.map(fn {seq, s} -> %{seq: seq, count: s.count, games: s.games} end)

    seqs
    |> clusters(cfg.metric, cfg.threshold)
    |> Enum.with_index(1)
    |> Enum.map(fn {c, i} ->
      %{
        id: i,
        occurrences: c.occurrences,
        games: MapSet.size(c.games),
        members:
          c.members
          |> Enum.sort_by(fn m -> {-m.count, Enum.join(m.seq, " ")} end)
          |> Enum.map(fn m -> %{seq: m.seq, count: m.count} end)
      }
    end)
  end

  @doc """
  Single-linkage clusters over distinct continuation sequences at the given
  metric and threshold. Returns clusters sorted by occurrence count.
  """
  @spec clusters([map()], metric(), float()) :: [map()]
  def clusters(seqs, metric, threshold) do
    reps = seqs |> Enum.map(&represent(&1.seq, metric)) |> List.to_tuple()
    n = tuple_size(reps)

    parent = Map.new(0..max(n - 1, 0)//1, &{&1, &1})

    {parent, _rank} = pair_unions(reps, n, sim_repr(metric), threshold, {parent, %{}})

    seqs
    |> Enum.with_index()
    |> Enum.group_by(fn {_s, i} -> find(parent, i) end)
    |> Enum.map(fn {_root, members} ->
      %{
        occurrences: members |> Enum.map(fn {s, _i} -> s.count end) |> Enum.sum(),
        games:
          Enum.reduce(members, MapSet.new(), fn {s, _i}, acc -> MapSet.union(acc, s.games) end),
        members: Enum.map(members, fn {s, _i} -> s end)
      }
    end)
    |> Enum.sort_by(fn c -> {-c.occurrences, inspect(hd(c.members).seq)} end)
  end

  # The O(n²) single-linkage pair sweep, one union per pair reaching the
  # threshold. The jaccard metrics compare via per-sequence frequency maps
  # computed once up front — `jaccard_freq` is exactly `jaccard/2` with the
  # per-pair `Enum.frequencies` pair removed — and the representation kind
  # is resolved once, outside the loop. The pair set, order and predicate
  # are identical either way, so the linkage (and therefore the families)
  # is bit-for-bit the same clustering.
  #
  # The union-find threads a `{parent, rank}` state and unions by rank, so
  # `find` depth stays O(log n) instead of degenerating to an O(n) chain
  # (7.9M `find` steps on the start position before). Rank changes only
  # which root is the parent, never which sequences are connected, so the
  # partition is unchanged.
  defp pair_unions(reps, n, :seq, threshold, uf) do
    for i <- 0..max(n - 2, -1)//1,
        j <- (i + 1)..(n - 1)//1,
        Continuation.lcs_similarity(elem(reps, i), elem(reps, j)) >= threshold,
        reduce: uf do
      uf -> union(uf, i, j)
    end
  end

  defp pair_unions(reps, n, repr, threshold, uf) when repr in [:multiset, :piece_dest, :piece] do
    freqs =
      reps
      |> Tuple.to_list()
      |> Enum.map(&Enum.frequencies/1)
      |> List.to_tuple()

    sweep_rows(freqs, n, 0, threshold, uf)
  end

  defp pair_unions(reps, n, repr, threshold, uf) do
    for i <- 0..max(n - 2, -1)//1,
        j <- (i + 1)..(n - 1)//1,
        Continuation.similarity(elem(reps, i), elem(reps, j), repr) >= threshold,
        reduce: uf do
      uf -> union(uf, i, j)
    end
  end

  # Row-by-row pair sweep with an exact single-linkage shortcut: a pair
  # whose endpoints are already connected cannot change the partition (its
  # union would be a no-op), so its similarity is never evaluated. The
  # threshold-reaching pairs between distinct components are still unioned
  # in the same order, so the connected components — the families — are
  # exactly the same as the full sweep. Pays one cheap find pair per
  # evaluated pair; a win wherever one big chained family forms early (the
  # hot opening positions), neutral elsewhere.
  defp sweep_rows(_freqs, n, i, _threshold, uf) when i >= n - 1, do: uf

  defp sweep_rows(freqs, n, i, threshold, uf) do
    uf = sweep_row(elem(freqs, i), freqs, n, i, i + 1, threshold, uf)
    sweep_rows(freqs, n, i + 1, threshold, uf)
  end

  defp sweep_row(_fi, _freqs, n, _i, j, _threshold, uf) when j >= n, do: uf

  defp sweep_row(fi, freqs, n, i, j, threshold, {parent, _rank} = uf) do
    uf =
      if find(parent, i) == find(parent, j) do
        uf
      else
        if Continuation.jaccard_freq(fi, elem(freqs, j)) >= threshold do
          union(uf, i, j)
        else
          uf
        end
      end

    sweep_row(fi, freqs, n, i, j + 1, threshold, uf)
  end

  @doc """
  Matches a candidate continuation against a decision menu. A candidate
  **joins** a family when its similarity to at least one member reaches the
  threshold (the single-linkage rule); otherwise the nearest family is
  reported with its similarity, so "no family" stays visible instead of
  being forced.

  Returns `%{status, member_of, family_id, sim, family_occurrences,
  family_games, next}` — `next` is the runner-up family.
  """
  @spec membership(menu(), [String.t()], cfg()) :: map()
  def membership(menu, cand_window, cfg) do
    window = cfg.window
    metric = cfg.metric
    threshold = cfg.threshold

    cand_repr = cand_window |> Enum.take(window) |> represent(metric)

    scored =
      menu
      |> Enum.map(fn family ->
        best =
          family.members
          |> Enum.map(fn m ->
            Continuation.similarity(cand_repr, represent(m.seq, metric), sim_repr(metric))
          end)
          |> Enum.max(fn -> 0.0 end)

        %{
          family_id: family.id,
          occurrences: family.occurrences,
          games: family.games,
          sim: round3(best)
        }
      end)
      |> Enum.sort_by(fn s -> {-s.sim, -s.occurrences, s.family_id} end)

    membership_result(scored, threshold)
  end

  @doc """
  Request-local precomputation for the per-card membership scoring
  (`membership_indexed/3` and `Skeleton.membership_indexed/5`). One HE
  request scores the same menu against every card, and both membership
  layers re-represented every member on every card (22× — plus a second
  22× on the skeleton's two sides). The index computes each member's
  family-metric representation and skeleton tokenization **once**, as plain
  data explicitly threaded through the pipeline — created per request,
  never stored. `ref_stm` is the menu position's side to move (the skeleton
  attribution anchor).
  """
  @spec member_index(menu(), cfg(), :w | :b) :: [map()]
  def member_index(menu, cfg, ref_stm) do
    metric = cfg.metric
    seq_kind? = sim_repr(metric) == :seq

    Enum.map(menu, fn family ->
      members =
        Enum.map(family.members, fn m ->
          fam_repr = represent(m.seq, metric)
          skel = Skeleton.represent(m.seq, :skeleton, ref_stm)

          %{
            fam_repr: fam_repr,
            fam_freq: if(seq_kind?, do: nil, else: Enum.frequencies(fam_repr)),
            skel_w: Map.get(skel, :w, []),
            skel_b: Map.get(skel, :b, []),
            skel_freq_w: skel |> Map.get(:w, []) |> Enum.frequencies(),
            skel_freq_b: skel |> Map.get(:b, []) |> Enum.frequencies()
          }
        end)

      %{id: family.id, occurrences: family.occurrences, games: family.games, members: members}
    end)
  end

  @doc """
  `membership/3` over a `member_index/3` — exactly the same scores and
  result shape (proven by test), with the per-member representation and
  frequency work hoisted out of the per-card loop.
  """
  @spec membership_indexed([map()], [String.t()], cfg()) :: map()
  def membership_indexed(index, cand_window, cfg) do
    window = cfg.window
    metric = cfg.metric
    threshold = cfg.threshold

    cand_repr = cand_window |> Enum.take(window) |> represent(metric)

    scored =
      case sim_repr(metric) do
        :seq ->
          index
          |> Enum.map(fn family ->
            best =
              family.members
              |> Enum.map(fn m -> Continuation.lcs_similarity(cand_repr, m.fam_repr) end)
              |> Enum.max(fn -> 0.0 end)

            %{
              family_id: family.id,
              occurrences: family.occurrences,
              games: family.games,
              sim: round3(best)
            }
          end)
          |> Enum.sort_by(fn s -> {-s.sim, -s.occurrences, s.family_id} end)

        _repr ->
          cand_freq = Enum.frequencies(cand_repr)

          index
          |> Enum.map(fn family ->
            best =
              family.members
              |> Enum.map(fn m -> Continuation.jaccard_freq(cand_freq, m.fam_freq) end)
              |> Enum.max(fn -> 0.0 end)

            %{
              family_id: family.id,
              occurrences: family.occurrences,
              games: family.games,
              sim: round3(best)
            }
          end)
          |> Enum.sort_by(fn s -> {-s.sim, -s.occurrences, s.family_id} end)
      end

    membership_result(scored, threshold)
  end

  defp membership_result(scored, threshold) do
    case scored do
      [] ->
        %{status: :no_menu, member_of: nil, sim: nil, next: nil}

      [best | rest] ->
        %{
          status: if(best.sim >= threshold, do: :member, else: :none),
          member_of: if(best.sim >= threshold, do: best.family_id),
          family_id: best.family_id,
          sim: best.sim,
          family_occurrences: best.occurrences,
          family_games: best.games,
          next:
            case rest do
              [] -> nil
              [second | _] -> %{family_id: second.family_id, sim: second.sim}
            end
        }
    end
  end

  # The `:lcs` metric reads the raw sequence; everything else is its own
  # representation. (The per-color side view is the skeleton layer's job —
  # Spike 06 — not the family construction's.)
  defp represent(seq, :lcs), do: seq
  defp represent(seq, metric), do: Continuation.represent(seq, metric, :w)

  defp sim_repr(:lcs), do: :seq
  defp sim_repr(m), do: m

  defp find(parent, i) do
    case Map.fetch!(parent, i) do
      ^i -> i
      p -> find(parent, p)
    end
  end

  # Union by rank: attach the shallower tree under the deeper one (ties go
  # left, `ri`, and bump its rank). Only the parent-pointer structure
  # changes — connectivity, hence the clustering partition, is identical to
  # the naive always-attach-left union.
  defp union({parent, rank}, i, j) do
    ri = find(parent, i)
    rj = find(parent, j)

    if ri == rj do
      {parent, rank}
    else
      ri_rank = Map.get(rank, ri, 0)
      rj_rank = Map.get(rank, rj, 0)

      if ri_rank >= rj_rank do
        parent = Map.put(parent, rj, ri)
        rank = if ri_rank == rj_rank, do: Map.put(rank, ri, ri_rank + 1), else: rank
        {parent, rank}
      else
        {Map.put(parent, ri, rj), rank}
      end
    end
  end

  defp round3(x), do: Float.round(x, 3)
end
