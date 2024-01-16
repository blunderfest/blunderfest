defmodule Blunderfest.Core.Room do
  alias Blunderfest.Core.State.Game

  @type t() :: %__MODULE__{
          room_code: String.t(),
          games: list(Game.t())
        }

  defstruct [:room_code, :games]

  def new(room_code),
    do: %__MODULE__{
      room_code: room_code,
      games: [Game.new()]
    }
end
