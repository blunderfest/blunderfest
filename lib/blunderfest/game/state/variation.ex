defmodule Blunderfest.Game.State.Variation do
  use TypedStruct

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:move, Move.t(), enforce: true)
    field(:position, Position.t(), enforce: true)
    field(:variations, list(Variation.t()))
  end
end
