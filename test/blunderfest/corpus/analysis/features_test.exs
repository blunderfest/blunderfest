defmodule Blunderfest.Corpus.Analysis.FeaturesTest do
  use ExUnit.Case, async: true

  import Bitwise, only: [&&&: 2, <<<: 2]

  alias Blunderfest.Corpus.Analysis.Features
  alias Blunderfest.Corpus.PositionKey

  @start "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
  @after_e4 "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"

  defp key(fen), do: PositionKey.from_fen(fen) |> elem(1)

  describe "from_key/1" do
    test "initial position: full material, 32 pieces" do
      f = Features.from_key(@start)

      assert f.material == {8, 2, 2, 2, 1, 8, 2, 2, 2, 1}
      assert Features.piece_count(f) == 32
      assert f.stm == :w
      assert f.castling == "KQkq"
      assert f.ep == "-"
    end

    test "pawn moves update the right bitboard" do
      f = Features.from_key(@after_e4)

      # e2 is square 52, e4 is square 36 (a8=0 convention)
      assert Features.popcount(elem(f.boards, 0)) == 8
      assert (elem(f.boards, 0) &&& 1 <<< 36) != 0
      assert (elem(f.boards, 0) &&& 1 <<< 52) == 0
      assert f.stm == :b
    end

    test "square mapping matches echecs' own bitboards across varied positions" do
      fens = [
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
        "8/2p5/3k4/1P6/8/4K3/8/8 w - - 0 1",
        "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
        "4k3/1P6/8/8/8/8/6p1/4K3 w - - 0 1"
      ]

      for fen <- fens do
        game = Echecs.new_game(fen)
        {:ok, k} = PositionKey.from_fen(fen)
        f = Features.from_key(k)

        boards = Tuple.to_list(f.boards)

        expected = [
          Echecs.Board.wp(game.board),
          Echecs.Board.wn(game.board),
          Echecs.Board.wb(game.board),
          Echecs.Board.wr(game.board),
          Echecs.Board.wq(game.board),
          Echecs.Board.wk(game.board),
          Echecs.Board.bp(game.board),
          Echecs.Board.bn(game.board),
          Echecs.Board.bb(game.board),
          Echecs.Board.br(game.board),
          Echecs.Board.bq(game.board),
          Echecs.Board.bk(game.board)
        ]

        assert boards == expected, "bitboard mismatch for #{fen}"
      end
    end
  end

  describe "popcount/1" do
    test "matches a naive reference implementation" do
      reference = fn x -> x |> Integer.digits(2) |> Enum.sum() end

      for x <- [0, 1, 2, 3, 255, 256, 0xFFFFFFFFFFFFFFFF, 0x0123456789ABCDEF, 1 <<< 63] do
        assert Features.popcount(x) == reference.(x)
      end
    end
  end

  describe "pawn dimensions" do
    test "pawn_mismatches is 0 for same skeleton even with different pieces" do
      a = Features.from_key(key("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1"))
      b = Features.from_key(key("r1b1k1nr/pppppppp/8/8/4P3/8/PPPP1PPP/RN1QK2R w KQkq - 0 1"))

      assert Features.pawn_mismatches(a, b) == 0
      assert Features.pawn_hash(a) == Features.pawn_hash(b)
    end

    test "pawn_mismatches counts both sides' displaced pawns" do
      a = Features.from_key(@start)
      # white e-pawn on e4, black d-pawn gone from d7 to d5
      b = Features.from_key(key("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1"))

      assert Features.pawn_mismatches(a, b) == 4
    end
  end

  describe "material dimensions" do
    test "material_distance is the L1 distance" do
      a = Features.from_key(@start)
      # black missing the b8 knight
      b = Features.from_key(key("r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"))
      # white down the a1 rook, black down four pawns
      c = Features.from_key(key("rnbqkbnr/pp4pp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1"))

      assert Features.material_distance(a, a) == 0
      assert Features.material_distance(a, b) == 1
      assert Features.material_distance(a, c) == 5
    end

    test "material_diff_description" do
      a = Features.from_key(@start)
      b = Features.from_key(key("r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"))

      assert Features.material_diff_description(a, a) == "="
      assert Features.material_diff_description(a, b) == "bN-1"
      assert Features.material_diff_description(b, a) == "bN+1"
    end
  end

  describe "piece placement dimensions" do
    test "identical positions overlap fully" do
      a = Features.from_key(@start)
      o = Features.piece_overlap(a, a)

      # 7 non-pawn, non-king pieces per side
      assert o == %{matches: 14, mismatches: 0, ref_pieces: 14}
    end

    test "one moved knight shows as two mismatches and one fewer match" do
      a = Features.from_key(@start)
      b = Features.from_key(key("rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1"))

      o = Features.piece_overlap(a, b)
      assert o.matches == 13
      assert o.mismatches == 2
      assert o.ref_pieces == 14
    end
  end

  describe "king distance" do
    test "same squares is 0" do
      a = Features.from_key(@start)
      assert Features.king_distance(a, a) == 0
    end

    test "Chebyshev distance is summed over both kings" do
      a = Features.from_key(key("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))
      # white king one step away (e2), black king two files away (c8)
      b = Features.from_key(key("2k5/8/8/8/8/8/4K3/8 w - - 0 1"))

      assert Features.king_distance(a, b) == 1 + 2
    end
  end

  describe "developed/1" do
    test "initial position has nothing developed" do
      assert Features.developed(Features.from_key(@start)) == %{w: 0, b: 0}
    end

    test "knight and bishop out count" do
      f = Features.from_key(key("r1bqkbnr/pppppppp/2n5/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 1"))
      assert Features.developed(f) == %{w: 1, b: 1}
    end
  end

  describe "fen/1" do
    test "appends zero counters" do
      assert Features.fen(@start) == @start <> " 0 1"
      assert Features.fen(Features.from_key(@start)) == @start <> " 0 1"
    end
  end
end
