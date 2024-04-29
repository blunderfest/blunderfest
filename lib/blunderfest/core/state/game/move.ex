defmodule Blunderfest.Core.State.Game.Move do
  alias Blunderfest.Core.State.Game.Piece
  alias Blunderfest.Core.State.Game.Square

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:from, Square.square_index())
    field(:to, Square.square_index())
    field(:promotion, Piece.t() | nil)
    field(:variation_path, list(integer()))
  end
end
