defmodule Blunderfest.Corpus.Analysis.DifferencesTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Analysis.{Differences, Features}

  # Golden keys taken verbatim from spike artifacts (corpus-derived, never
  # hand-typed) and from the research fixture.
  @f1 "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - -"
  @f1_b1 "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - -"
  @f1_b2 "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP1BBPPP/R2Q1RK1 b - -"
  @f1_b4 "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N5/PP1NBPPP/R1BQ1RK1 b - -"
  @f1_f4 "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N1P/PP2BPP1/R1BQK2R w KQ -"
  @a2 "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq -"
  @a2_b4 "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQ1RK1 w kq -"

  defp types(diffs), do: Enum.map(diffs, & &1.type)

  describe "positional/2" do
    test "identical position including stm has no differences" do
      f = Features.from_key(@f1)
      assert Differences.positional(f, f) == []
    end

    test "F1 vs F1-B1: identical placement, other side to move → tempo twin" do
      diffs = Differences.positional(Features.from_key(@f1), Features.from_key(@f1_b1))

      assert types(diffs) == [:tempo_twin]
      assert hd(diffs).detail =~ "black to move"
    end

    test "F1 vs F1-B2/B4: one relocation + stm flip → near twin with square detail" do
      b2 = Differences.positional(Features.from_key(@f1), Features.from_key(@f1_b2))
      assert types(b2) == [:near_twin]
      assert hd(b2).detail =~ "wB c1→d2"

      b4 = Differences.positional(Features.from_key(@f1), Features.from_key(@f1_b4))
      assert types(b4) == [:near_twin]
      assert hd(b4).detail =~ "wN f3→d2"
    end

    test "A2 vs A2-B4: the unspent Re1 tempo is a near twin (wR e1→f1)" do
      diffs = Differences.positional(Features.from_key(@a2), Features.from_key(@a2_b4))

      assert types(diffs) == [:near_twin]
      assert hd(diffs).detail =~ "wR e1→f1"
      assert hd(diffs).detail =~ "white to move"
    end

    test "F1 vs F1-F4: h3 pawn + uncastled king → structure and king position" do
      diffs = Differences.positional(Features.from_key(@f1), Features.from_key(@f1_f4))

      assert :structure in types(diffs)
      assert :king_position in types(diffs)
      king = Enum.find(diffs, &(&1.type == :king_position))
      assert king.detail =~ "wK g1→e1"
      assert king.detail =~ "castling - vs KQ"
    end
  end

  describe "dimensions/2" do
    test "the F1 tabiya vs its tempo twin" do
      dims = Differences.dimensions(Features.from_key(@f1), Features.from_key(@f1_b1))

      assert dims.pawn_structure == :same
      assert dims.material == :same
      assert dims.piece_placement == %{matches: 14, mismatches: 0, ref_pieces: 14}
      assert dims.king_position == :same
      assert dims.side_to_move == :differs
      assert dims.castling == :same
    end

    test "F1 vs F1-B4: one relocated piece" do
      dims = Differences.dimensions(Features.from_key(@f1), Features.from_key(@f1_b4))

      assert dims.pawn_structure == :same
      assert dims.material == :same
      assert dims.piece_placement == %{matches: 13, mismatches: 2, ref_pieces: 14}
      assert dims.side_to_move == :differs
      assert dims.castling == :same
    end
  end

  describe "continuation/4" do
    test "F1 vs F1-F4 at window 4: same plan, different order (timing shift)" do
      ref = Features.from_key(@f1)
      cand = Features.from_key(@f1_f4)
      ref_w = ["Ne1", "Ne8", "Nd3", "f5"]
      cand_w = ["O-O", "Ne8", "Ne1", "f5"]

      diffs = Differences.continuation(ref, cand, ref_w, cand_w)

      assert :same_plan in types(diffs)
      assert :timing_shift in types(diffs)
      refute :plan_divergence in types(diffs)
    end

    test "F1 vs F1-B3 at window 6: near-identical position, disjoint plans" do
      ref = Features.from_key(@f1)
      cand = Features.from_key("r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PPQ1BPPP/R1B2RK1 b - -")
      ref_w = ["Ne1", "Ne8", "Nd3", "f5", "Bd2", "Kh8"]
      cand_w = ["c5", "dxc6", "bxc6", "b4", "Be6", "a4"]

      diffs = Differences.continuation(ref, cand, ref_w, cand_w)

      assert :plan_divergence in types(diffs)
      refute :same_plan in types(diffs)
    end

    test "identical continuations are same plan without a timing shift" do
      ref = Features.from_key(@f1)
      w = ["Ne1", "Ne8", "Nd3", "f5"]

      diffs = Differences.continuation(ref, ref, w, w)

      assert :same_plan in types(diffs)
      refute :timing_shift in types(diffs)
    end

    test "empty windows flag nothing" do
      ref = Features.from_key(@f1)
      assert Differences.continuation(ref, ref, [], []) == []
    end
  end

  describe "relocations/2" do
    test "reports piece, from and to squares" do
      assert [{"wN", "f3", "d2"}] =
               Differences.relocations(Features.from_key(@f1), Features.from_key(@f1_b4))
    end
  end
end
