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

  alias Blunderfest.Corpus.Analysis.Continuation

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

    parent =
      for i <- 0..max(n - 2, -1)//1,
          j <- (i + 1)..(n - 1)//1,
          Continuation.similarity(elem(reps, i), elem(reps, j), sim_repr(metric)) >= threshold,
          reduce: parent do
        parent -> union(parent, i, j)
      end

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

  defp union(parent, i, j) do
    ri = find(parent, i)
    rj = find(parent, j)
    if ri == rj, do: parent, else: Map.put(parent, ri, rj)
  end

  defp round3(x), do: Float.round(x, 3)
end
