defmodule Blunderfest.Core.Parsers.FenParserTest do
  use ExUnit.Case

  alias Blunderfest.Core.Parsers.FenParser

  test "Initial position" do
    {:ok, position} = FenParser.parse("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

    assert position.active_color == :white

    assert position.castling_availability == [
             white: :king,
             white: :queen,
             black: :king,
             black: :queen
           ]

    assert position.en_passant == nil
    assert position.halfmove_clock == 0
    assert position.fullmove_number == 1
  end

  test "Invalid pieces" do
    {:error, :invalid_fen} = FenParser.parse("/////// w KQkq - 0 1")
    {:error, :invalid_fen} = FenParser.parse("/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")

    {:error, :invalid_fen} =
      FenParser.parse("rnbqkbnr/pppppppp/7/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
  end

  test "Bish, You Were Here" do
    {:ok, position} = FenParser.parse("5k2/pp4pp/4pp2/1P6/8/P2KP1P1/5P1b/2B5 b - - 0 30")

    assert position.active_color == :black

    assert position.castling_availability == []

    assert position.en_passant == nil
    assert position.halfmove_clock == 0
    assert position.fullmove_number == 30
  end
end
