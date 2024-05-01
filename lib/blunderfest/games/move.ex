defmodule Blunderfest.Games.Move do
  alias Blunderfest.Games.Piece
  alias Blunderfest.Games.Square

  use TypedStruct

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :from, Square.square_index_range()
    field :to, Square.square_index_range()
    field :promotion, Piece.t(), enforce: false
    field :variation_path, list(integer())
  end
end
