defmodule Blunderfest.Games.Variation do
  alias __MODULE__
  alias Blunderfest.Games.Position
  alias Blunderfest.Games.Move

  use TypedStruct

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :move, Move.t(), enforce: false
    field :position, Position.t()
    field :variations, list(Variation.t())
  end
end
