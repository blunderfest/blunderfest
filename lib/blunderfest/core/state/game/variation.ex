defmodule Blunderfest.Core.State.Game.Variation do
  alias Blunderfest.Core.State.Game.Position
  alias Blunderfest.Core.State.Game.Move

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:move, Move.t())
    field(:position, Position.t())
    field(:variations, list(__MODULE__.t()))
  end
end
