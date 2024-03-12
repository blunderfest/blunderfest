defmodule Blunderfest.Core.State.Game.Piece do
  @type color() :: :black | :white
  @type type() :: :pawn | :knight | :bishop | :rook | :queen | :king

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:color, color)
    field(:type, type)
  end

  def new(color, type),
    do: %__MODULE__{
      color: color,
      type: type
    }
end
