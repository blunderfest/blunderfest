defmodule Blunderfest.Game.MovesTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Game.Moves

  @start_fen "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  defp move(moves, san), do: Enum.find(moves, &(&1.san == san))

  describe "legal_moves/1" do
    test "returns 20 moves from the start position with derived data" do
      assert {:ok, moves} = Moves.legal_moves(@start_fen)
      assert length(moves) == 20

      e4 = move(moves, "e4")
      assert e4.from == "e2"
      assert e4.to == "e4"
      assert e4.promotion == nil
      assert e4.status == "active"
      assert e4.fen =~ "4P3"
      assert e4.fen =~ " b "
    end

    test "returns castling moves with O-O and O-O-O" do
      fen = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/R3K2R w KQkq - 4 4"
      assert {:ok, moves} = Moves.legal_moves(fen)
      assert move(moves, "O-O").to == "g1"
      assert move(moves, "O-O").from == "e1"
      assert move(moves, "O-O-O").to == "c1"
    end

    test "does not offer castling while in check" do
      fen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3"
      assert {:ok, moves} = Moves.legal_moves(fen)
      refute move(moves, "O-O")
      refute move(moves, "O-O-O")
    end

    test "disambiguates by file when two pieces share a target" do
      fen = "4k3/8/8/8/2N1N3/8/8/4K3 w - - 0 1"
      assert {:ok, moves} = Moves.legal_moves(fen)
      assert move(moves, "Ncd2").from == "c4"
      assert move(moves, "Ned2").from == "e4"
      assert move(moves, "Nc3").from == "e4"
      assert move(moves, "Ncd6+").from == "c4"
      assert move(moves, "Ned6+").from == "e4"
    end

    test "disambiguates by rank when both pieces share the file" do
      fen = "4k3/8/2N5/8/2N5/8/8/4K3 w - - 0 1"
      assert {:ok, moves} = Moves.legal_moves(fen)
      assert move(moves, "N4a5").from == "c4"
      assert move(moves, "N6a5").from == "c6"
      assert move(moves, "N4e5").from == "c4"
      assert move(moves, "N6e5").from == "c6"
    end

    test "captures en passant" do
      fen = "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3"
      assert {:ok, moves} = Moves.legal_moves(fen)
      exf6 = move(moves, "exf6")
      assert exf6.from == "e5"
      assert exf6.to == "f6"
    end

    test "annotates promotions" do
      fen = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"
      assert {:ok, moves} = Moves.legal_moves(fen)
      assert move(moves, "a8=Q+").from == "a7"
      assert move(moves, "a8=N").to == "a8"
    end

    test "annotates check and checkmate suffixes" do
      fen = "4k3/8/8/8/8/8/8/4QK2 w - - 0 1"
      assert {:ok, moves} = Moves.legal_moves(fen)
      assert move(moves, "Qe2+")

      scholar = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"
      assert {:ok, moves} = Moves.legal_moves(scholar)
      mate = move(moves, "Qxf7#")
      assert mate.from == "h5"
      assert mate.status == "checkmate"
    end

    test "rejects an invalid fen" do
      assert Moves.legal_moves("not a fen") == {:error, %{reason: :invalid_fen}}
      assert Moves.legal_moves(nil) == {:error, %{reason: :invalid_fen}}
    end
  end
end
