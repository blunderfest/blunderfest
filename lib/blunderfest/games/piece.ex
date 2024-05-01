defmodule Blunderfest.Games.Piece do
  use TypedStruct

  @type color :: :black | :white

  @derive Jason.Encoder
  typedstruct enforce: true do
    field :symbol, :k | :q | :r | :b | :n | :p
    field :color, color()
  end
end
