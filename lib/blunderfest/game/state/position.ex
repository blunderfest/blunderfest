defmodule Blunderfest.Game.State.Position do
  use TypedStruct

  @type position_id :: String.t()

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:position_id, position_id(), enforce: true)
    field(:fen, String.t(), enforce: true)
    field(:ply, Integer.t(), enforce: true)
    field(:arrows, list(Arrow.t()), enforce: true)
    field(:marks, list(String.t()), enforce: true)
    field(:selected_square_index, Integer.t())
  end
end
