defmodule Blunderfest.Games.Position do
  alias Blunderfest.Games.Position
  alias Blunderfest.Games.Piece
  alias Blunderfest.Games.Square

  use TypedStruct

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :squares, list(Square.t())
    field :active_color, Piece.color()
    field :castling_availability, list(Piece.t())
    field :en_passant, Square.square_index(), enforce: false
    field :halfmove_clock, pos_integer()
    field :fullmove_number, pos_integer()
  end

  def new() do
    %Position{
      squares: [],
      active_color: :white,
      castling_availability: [],
      en_passant: nil,
      halfmove_clock: 0,
      fullmove_number: 1
    }
  end
end
