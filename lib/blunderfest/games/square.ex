defmodule Blunderfest.Games.Square do
  alias Blunderfest.Games.Piece

  use TypedStruct

  @type square_index_range :: 0..63

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :square_index, square_index_range()
    field :piece, Piece.t(), enforce: false
  end
end
