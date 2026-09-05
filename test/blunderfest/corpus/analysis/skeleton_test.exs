defmodule Blunderfest.Corpus.Analysis.SkeletonTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.{Families, Skeleton}

  describe "action/1" do
    test "piece destinations drop disambiguation and captures" do
      assert Skeleton.action("Ne1") == "N→e1"
      assert Skeleton.action("Ne8") == "N→e8"
      assert Skeleton.action("Nbd7") == "N→d7"
      assert Skeleton.action("Bxe6") == "B→e6"
      assert Skeleton.action("R1e2") == "R→e2"
      assert Skeleton.action("Qc1") == "Q→c1"
      assert Skeleton.action("Kh8") == "K→h8"
    end

    test "pawn moves keep their file: pushes, captures, promotions" do
      assert Skeleton.action("f5") == "Pf→f5"
      assert Skeleton.action("f3") == "Pf→f3"
      assert Skeleton.action("h6") == "Ph→h6"
      assert Skeleton.action("b4") == "Pb→b4"
      assert Skeleton.action("a5") == "Pa→a5"
      assert Skeleton.action("fxe4") == "Pf→e4"
      assert Skeleton.action("dxc6") == "Pd→c6"
      assert Skeleton.action("bxc6") == "Pb→c6"
      assert Skeleton.action("bxa5") == "Pb→a5"
      assert Skeleton.action("e8=Q") == "Pe→e8=Q"
    end

    test "castling is its own action" do
      assert Skeleton.action("O-O") == "O-O"
      assert Skeleton.action("O-O-O") == "O-O-O"
    end
  end

  describe "the KID trio: family-level merge, variation-level identity" do
    @trio [
      ~w(Ne1 Ne8 Be3 f5),
      ~w(Ne1 Ne8 Nd3 f5),
      ~w(Ne1 Ne8 f3 f5)
    ]

    test "support-move variants score 2/3 pairwise — one family at 0.5" do
      for a <- @trio, b <- @trio, a != b do
        sa = Skeleton.represent(a, :skeleton, :w)
        sb = Skeleton.represent(b, :skeleton, :w)

        assert Skeleton.similarity(sa, sb, :skeleton) == 2 / 3
      end
    end

    test "the variants stay distinct action sets (not interchangeable)" do
      keys =
        Enum.map(@trio, fn seq ->
          seq |> Skeleton.represent(:skeleton, :w) |> Skeleton.repr_key(:skeleton)
        end)

      assert Enum.uniq(keys) |> length() == 3
    end
  end

  describe "the tempo flip (F1-B1)" do
    @ref_w6 ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8)
    @b1_w6 ~w(Ne8 Bg5 h6 Be3 f5 Qc1)

    test "per-side scores: black executes the plan, white diverges" do
      ref = Skeleton.represent(@ref_w6, :skeleton, :w)
      b1 = Skeleton.represent(@b1_w6, :skeleton, :b)

      assert b1.b == ["N→e8", "Pf→f5", "Ph→h6"]
      assert ref.b == ["K→h8", "N→e8", "Pf→f5"]

      scores = Skeleton.side_scores(b1, ref, :skeleton)
      assert scores.b == 0.5
      assert scores.w == 0.0
      assert scores.mean == 0.25
    end

    test "skeleton_seq keeps within-side order; black's LCS is 2/3" do
      ref = Skeleton.represent(@ref_w6, :skeleton_seq, :w)
      b1 = Skeleton.represent(@b1_w6, :skeleton_seq, :b)

      assert b1.b == ["N→e8", "Ph→h6", "Pf→f5"]
      assert ref.b == ["N→e8", "Pf→f5", "K→h8"]

      scores = Skeleton.side_scores(b1, ref, :skeleton_seq)
      assert scores.b == 2 / 3
      assert scores.w == 0.0
    end
  end

  describe "negative separation" do
    test "Marshall vs Closed share one of three actions per side" do
      closed = Skeleton.represent(~w(d6 c3 O-O h3), :skeleton, :b)
      marshall = Skeleton.represent(~w(O-O c3 d5 exd5), :skeleton, :b)

      # black {Pd→d6, O-O} vs {O-O, Pd→d5} = 1/3; white {Pc→c3, Ph→h3} vs
      # {Pc→c3, Pe→d5} = 1/3
      assert Skeleton.similarity(closed, marshall, :skeleton) == 1 / 3
    end

    test "KID kingside vs queenside share nothing" do
      kingside = Skeleton.represent(~w(Ne1 Ne8 Be3 f5), :skeleton, :w)
      queenside = Skeleton.represent(~w(b4 a5 bxa5 c5), :skeleton, :w)

      assert Skeleton.similarity(kingside, queenside, :skeleton) == 0.0
    end

    test "B3's queenside exchange shares nothing with the kingside plan" do
      ref = Skeleton.represent(~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8), :skeleton, :w)
      b3 = Skeleton.represent(~w(c5 dxc6 bxc6 b4 Be6 a4), :skeleton, :b)

      scores = Skeleton.side_scores(b3, ref, :skeleton)
      assert scores.b == 0.0
      assert scores.w == 0.0
    end

    test "A2-B4's black side joins the Marshall exactly while white spends the extra tempo" do
      cand = Skeleton.represent(~w(Re1 O-O c3 d5), :skeleton, :w)
      marshall = Skeleton.represent(~w(O-O c3 d5 exd5), :skeleton, :b)

      scores = Skeleton.side_scores(cand, marshall, :skeleton)
      assert scores.b == 1.0
      assert scores.w == 1 / 3
      assert scores.mean == 2 / 3
    end
  end

  describe "ordering sensitivity" do
    test "skeleton_seq: same actions with a within-side swap scores below 1.0" do
      a = Skeleton.represent(~w(Bg5 Ne8 Qc2 h6 Bd3 f5), :skeleton_seq, :w)
      b = Skeleton.represent(~w(Bg5 Ne8 Qc2 f5 Bd3 h6), :skeleton_seq, :w)

      assert a.b == ["N→e8", "Ph→h6", "Pf→f5"]
      assert b.b == ["N→e8", "Pf→f5", "Ph→h6"]

      assert Skeleton.side_scores(a, b, :skeleton_seq).b == 2 / 3
      assert_in_delta Skeleton.similarity(a, b, :skeleton_seq), 5 / 6, 1.0e-9
    end

    test "skeleton (order-free) calls the same two windows identical" do
      a = Skeleton.represent(~w(Bg5 Ne8 Qc2 h6 Bd3 f5), :skeleton, :w)
      b = Skeleton.represent(~w(Bg5 Ne8 Qc2 f5 Bd3 h6), :skeleton, :w)

      assert Skeleton.similarity(a, b, :skeleton) == 1.0
    end

    test "within-color move-order transpositions merge under :skeleton" do
      a = Skeleton.represent(~w(d6 c3 O-O h3), :skeleton, :b)
      b = Skeleton.represent(~w(O-O c3 d6 h3), :skeleton, :b)

      assert Skeleton.repr_key(a, :skeleton) == Skeleton.repr_key(b, :skeleton)

      sa = Skeleton.represent(~w(d6 c3 O-O h3), :skeleton_seq, :b)
      sb = Skeleton.represent(~w(O-O c3 d6 h3), :skeleton_seq, :b)
      assert Skeleton.repr_key(sa, :skeleton_seq) != Skeleton.repr_key(sb, :skeleton_seq)
    end
  end

  describe "membership/5" do
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

    test "B1: black joins family A on its own side, white joins nothing" do
      menu = Families.build(f1_entries(), Families.default())

      m = Skeleton.membership(menu, ~w(Ne8 Bg5 h6 Be3 f5 Qc1), :b, :w, 6)

      assert m.black.status == :member
      assert m.black.sim >= 0.5
      assert m.black.family_games >= 2
      assert m.white.status == :none
    end

    test "B4: black joins family B exactly, white only partially" do
      menu = Families.build(f1_entries(), Families.default())

      m = Skeleton.membership(menu, ~w(a5 a3 Nd7 Rb1 f5 f3), :b, :w, 6)

      assert m.black.status == :member
      assert m.black.sim == 1.0
      assert m.white.sim == 0.5
    end

    test "B3 joins no multi-game family on either side" do
      menu = Families.build(f1_entries(), Families.default())

      m = Skeleton.membership(menu, ~w(c5 dxc6 bxc6 b4 Be6 a4), :b, :w, 6)

      # Spike 06's reading: B3's sides land only on 1-game families (own
      # singletons at threshold) — never on the recurring families.
      for side <- [m.white, m.black] do
        if side.status == :member do
          assert side.family_games == 1
        end
      end
    end
  end

  describe "membership_indexed/5 (HE-CPU parity)" do
    defp f1_menu do
      entries = [
        {1, 16, ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8)},
        {2, 16, ~w(Ne1 Ne8 Nd3 f5 Bd2 g5)},
        {3, 16, ~w(Bd2 a5 a3 Nd7 Rb1 f5)},
        {4, 16, ~w(Bd2 a5 a3 Nd7 Rb1 f5)},
        {6, 16, ~w(Qc2 c5 dxc6 bxc6 b4 Be6)},
        {7, 16, ~w(Nd2 a5 a3 Nd7 Rb1 f5)},
        {12, 16, ~w(Ne1 Ne8 Nf3 Nf6 Bd2 g5)},
        {12, 20, ~w(Bd2 g5 Rc1 Kh8)}
      ]

      Families.build(entries, Families.default())
    end

    test "equals the legacy membership for every window and stm pairing" do
      menu = f1_menu()
      cfg = Families.default()

      windows = [
        ~w(Ne8 Bg5 h6 Be3 f5 Qc1),
        ~w(a5 a3 Nd7 Rb1 f5 f3),
        ~w(c5 dxc6 bxc6 b4 Be6 a4),
        ~w(Ne1 Ne8 Nd3 f5 Bd2 Kh8),
        ~w(Bd2 g5),
        []
      ]

      for ref_stm <- [:w, :b],
          cand_stm <- [:w, :b],
          w <- windows do
        index = Families.member_index(menu, cfg, ref_stm)

        assert Skeleton.membership_indexed(index, w, cand_stm, 6) ==
                 Skeleton.membership(menu, w, cand_stm, ref_stm, 6)
      end
    end

    test "an empty index answers no_menu on both sides" do
      empty = Skeleton.membership_indexed([], ~w(e4 e5), :w, 6)
      assert empty.white.status == :no_menu
      assert empty.black.status == :no_menu
    end
  end
end
