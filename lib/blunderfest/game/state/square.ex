defmodule Blunderfest.Game.State.Square do
  use TypedStruct

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:rank, Integer.t(), enforce: true)
    field(:file, String.t(), enforce: true)
  end
end
