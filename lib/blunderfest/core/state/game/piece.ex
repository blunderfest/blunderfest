defmodule Blunderfest.Core.State.Game.Piece do
  @type color() :: :black | :white
  @type type() :: :pawn | :knight | :bishop | :rook | :queen | :king

  @type t() :: %__MODULE__{
          color: color(),
          type: type()
        }

  defstruct [:color, :type]

  def new(color, type),
    do: %__MODULE__{
      color: color,
      type: type
    }
end
