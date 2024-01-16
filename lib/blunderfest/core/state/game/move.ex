defmodule Blunderfest.Core.State.Game.Move do
  alias Blunderfest.Core.State.Game.Piece
  alias Blunderfest.Core.State.Game.Square

  defstruct [:from, :to, :promotion]

  @type t() :: %__MODULE__{
          from: Square.t(),
          to: Square.t(),
          promotion: Piece.t() | nil
        }
end
