defmodule Blunderfest.Core.State.Game.Move do
  alias Blunderfest.Core.State.Game.Piece
  alias Blunderfest.Core.State.Game.Square

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:from, Square.t())
    field(:to, Square.t())
    field(:promotion, Piece.t() | nil)
  end
end
