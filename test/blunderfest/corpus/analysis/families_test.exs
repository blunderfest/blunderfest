defmodule Blunderfest.Corpus.Analysis.FamiliesTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.{Continuation, Families}

  # Continuation windows (window 6) after the fixture's F1 tabiya, one per
  # exact occurrence — mirroring the research fixture's routes.
  defp f1_entries do
    [
      {1, 16, ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8)},
      {2, 16, ~w(Ne1 Ne8 Nd3 f5 Bd2 g5)},
      {3, 16, ~w(Bd2 a5 a3 Nd7 Rb1 f5)},
      {4, 16, ~w(Bd2 a5 a3 Nd7 Rb1 f5)},
      {6, 16, ~w(Qc2 c5 dxc6 bxc6 b4 Be6)},
      {7, 16, ~w(Nd2 a5 a3 Nd7 Rb1 f5)},
      {12, 16, ~w(Ne1 Ne8 Nf3 Nf6 Bd2 g5)},
      {12, 20, ~w(Bd2 g5 Rc1 Kh8)}
    ]
  end

  test "F1 menu: the two continuation families stay separate" do
    menu = Families.build(f1_entries(), Families.default())

    # Family A: gids 1+2 plus the same-game shuffle of gid 12 (joins at
    # exactly 0.5 via single linkage). Family B: gids 3+4 plus B4's tabiya
    # continuation (0.71). Then the B3 and gid-12 ply-20 singletons.
    assert length(menu) == 4

    fam_a =
      Enum.find(menu, fn f -> Enum.any?(f.members, &(&1.seq == ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8))) end)

    fam_b =
      Enum.find(menu, fn f -> Enum.any?(f.members, &(&1.seq == ~w(Bd2 a5 a3 Nd7 Rb1 f5))) end)

    assert fam_a.occurrences == 3
    assert fam_a.games == 3
    assert fam_b.occurrences == 3
    assert fam_b.games == 3

    assert Enum.any?(menu, fn f ->
             f.occurrences == 1 and
               Enum.any?(f.members, &(&1.seq == ~w(Qc2 c5 dxc6 bxc6 b4 Be6)))
           end)

    assert Enum.any?(menu, fn f ->
             f.occurrences == 1 and Enum.any?(f.members, &(&1.seq == ~w(Bd2 g5 Rc1 Kh8)))
           end)
  end

  test "B3's continuation joins only its own singleton family, never A or B" do
    menu = Families.build(f1_entries(), Families.default())

    m = Families.membership(menu, ~w(c5 dxc6 bxc6 b4 Be6 a4), Families.default())

    # Spike 06's "own singleton": the best match is the 1-game family.
    assert m.family_games == 1
    assert m.family_occurrences == 1
  end

  test "a family-A continuation joins family A" do
    menu = Families.build(f1_entries(), Families.default())

    m = Families.membership(menu, ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8), Families.default())

    assert m.status == :member
    assert m.family_occurrences == 3
    assert m.family_games == 3
  end

  test "B1's tempo-twin continuation joins nothing at the multiset level" do
    # Spike 06's finding, encoded as a regression: the family construction
    # alone does not place the tempo twin — the skeleton membership layer
    # does. The menu must not force it into family A.
    menu = Families.build(f1_entries(), Families.default())

    m = Families.membership(menu, ~w(Ne8 Bg5 h6 Be3 f5 Qc1), Families.default())

    assert m.status == :none
  end

  defp a2_entries do
    [
      {8, 13, ~w(d6 c3 O-O d4 Bg4 h3)},
      {9, 13, ~w(d6 c3 O-O d4 Bg4 a4)},
      {10, 13, ~w(O-O c3 d5 exd5 Nxd5 d4)},
      {11, 13, ~w(O-O c3 d5 exd5 Nxd5 d4)}
    ]
  end

  test "A2 menu at LCS 0.6 / window 4 keeps Marshall and Closed distinct" do
    cfg = %{window: 4, metric: :lcs, threshold: 0.6}

    menu = Families.build(a2_entries(), cfg)
    assert length(menu) == 2

    closed = Enum.find(menu, fn f -> Enum.any?(f.members, &(&1.seq == ~w(d6 c3 O-O d4))) end)
    marshall = Enum.find(menu, fn f -> Enum.any?(f.members, &(&1.seq == ~w(O-O c3 d5 exd5))) end)

    assert closed.occurrences == 2
    assert marshall.occurrences == 2

    # The Marshall continuation must not join the Closed family.
    m = Families.membership(menu, ~w(O-O c3 d5 exd5 Nxd5 d4), cfg)
    assert m.status == :member
    assert m.member_of == marshall.id
    refute m.member_of == closed.id

    # ...and a Closed continuation must not join Marshall.
    c = Families.membership(menu, ~w(d6 c3 O-O d4 Bg4 h3), cfg)
    assert c.member_of == closed.id
  end

  test "an empty menu answers no_menu" do
    assert Families.membership([], ~w(e4 e5), Families.default()).status == :no_menu
  end

  # ---------------------------------------------------------------------------
  # HE-CPU spike regressions: the optimized family construction must be
  # exactly the naive reference algorithm (same families, same ids, same
  # ordering), and the indexed membership must be exactly the legacy one.
  # ---------------------------------------------------------------------------

  # The pre-optimization implementation, kept verbatim as the oracle: full
  # O(n²) sweep, per-pair `Enum.frequencies`, naive attach-left union-find.
  defmodule Naive do
    alias Blunderfest.Corpus.Analysis.Continuation

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
  end

  defp random_entries(rng, n) do
    tokens = ~w(e4 e5 d4 d5 Nf3 Nc6 Nf6 Nc3 Bb5 Bc4 O-O a6 c5 c4 Be7 d6)

    Enum.map_reduce(1..n, rng, fn gid, r ->
      {len, r} = :rand.uniform_s(6, r)

      {sans, r} =
        Enum.map_reduce(1..len, r, fn _, r2 ->
          {i, r3} = :rand.uniform_s(length(tokens), r2)
          {Enum.at(tokens, i - 1), r3}
        end)

      {{gid, 10, sans}, r}
    end)
    |> elem(0)
  end

  test "optimized build exactly equals the naive reference (multiset + lcs)" do
    rng = :rand.seed_s(:exsss, {7, 8, 9})
    entries = random_entries(rng, 140)

    for cfg <- [
          Families.default(),
          %{window: 4, metric: :lcs, threshold: 0.6},
          %{window: 5, metric: :piece_dest, threshold: 0.5}
        ] do
      assert Families.build(entries, cfg) == Naive.build(entries, cfg)
    end
  end

  test "indexed family membership equals the legacy membership" do
    menu = Families.build(f1_entries(), Families.default())
    cfg = Families.default()
    index = Families.member_index(menu, cfg, :w)

    windows = [
      ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8),
      ~w(c5 dxc6 bxc6 b4 Be6 a4),
      ~w(Ne8 Bg5 h6 Be3 f5 Qc1),
      ~w(Bd2 a5 a3),
      ~w(Qc2 c5 dxc6 bxc6 b4 Be6),
      []
    ]

    for w <- windows do
      assert Families.membership_indexed(index, w, cfg) == Families.membership(menu, w, cfg)
    end

    assert Families.membership_indexed([], ~w(e4), cfg) ==
             Families.membership([], ~w(e4), cfg)
  end

  test "indexed family membership equals legacy under the lcs metric" do
    cfg = %{window: 4, metric: :lcs, threshold: 0.6}
    menu = Families.build(a2_entries(), cfg)
    index = Families.member_index(menu, cfg, :b)

    for w <- [~w(O-O c3 d5 exd5 Nxd5 d4), ~w(d6 c3 O-O d4 Bg4 h3), ~w(e4 e5)] do
      assert Families.membership_indexed(index, w, cfg) == Families.membership(menu, w, cfg)
    end
  end
end
