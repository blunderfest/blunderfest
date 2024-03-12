defmodule Blunderfest.Core.State.Game.Position do
  alias Blunderfest.Core.State.Game.Square
  alias Blunderfest.Core.State.Game.Piece
  alias Blunderfest.Core.Parsers.FenParser

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:pieces, list(Piece.t() | nil))
    field(:active_color, Piece.color())
    field(:castling_availability, list({Piece.color(), :king | :queen}))
    field(:en_passant, Square.square_index() | nil)
    field(:halfmove_clock, integer())
    field(:fullmove_number, integer())
  end

  @starting_position "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  def new(), do: parse(@starting_position)

  def parse(fen), do: FenParser.parse(fen)
end
