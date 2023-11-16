defmodule Blunderfest.Game.State.Arrow do
  use TypedStruct

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:from, Integer.t(), enforce: true)
    field(:to, Integer.t(), enforce: true)
    field(:color, String.t(), enforce: true)
  end
end
