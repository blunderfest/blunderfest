defmodule Blunderfest.Game.State.Room do
  use TypedStruct

  alias Blunderfest.Game.State.Game
  alias Blunderfest.Game.IdGenerator

  @type room_code :: String.t()

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:room_code, room_code(), enforce: true)
    field(:game_codes, list(Game.game_code()), enforce: true)
  end

  @spec new(room_code()) :: __MODULE__.t()
  def new(room_code),
    do: %__MODULE__{
      room_code: room_code,
      game_codes: [IdGenerator.generate()]
    }
end
