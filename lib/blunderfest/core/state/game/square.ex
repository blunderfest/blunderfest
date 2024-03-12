defmodule Blunderfest.Core.State.Game.Square do
  @type square_index() :: 0..63
  @type color() :: :dark | :light

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:square_index, square_index())
    field(:color, color())
  end

  def new(square_index),
    do: %__MODULE__{
      square_index: square_index,
      color: if(rem(square_index, 2) == 0, do: :dark, else: :light)
    }
end
