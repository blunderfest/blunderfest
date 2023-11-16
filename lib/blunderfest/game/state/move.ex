defmodule Blunderfest.Game.State.Move do
  use TypedStruct

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:from, Integer.t(), enforce: true)
    field(:to, Integer.t(), enforce: true)
    field(:promotion, String.t())
  end
end
