defmodule Blunderfest.Core.State.Game.Piece do
  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:symbol, :k | :K | :q | :Q | :r | :R | :b | :B | :n | :N | :p | :P)
  end

  def new(symbol),
    do: %__MODULE__{
      symbol: symbol
    }
end
