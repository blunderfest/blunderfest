defmodule Blunderfest.Core.State.Game.Variation do
  alias Blunderfest.Core.State.Game.Position
  alias Blunderfest.Core.State.Game.Move

  @type t() :: %__MODULE__{
          move: Move.t(),
          position: Position.t(),
          variations: list(t())
        }

  defstruct [:move, :position, :variations]
end
