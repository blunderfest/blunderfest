defmodule Blunderfest.Core.State.Game.LocalState do
  alias Blunderfest.Core.State.Game

  @type t() :: %__MODULE__{
          name: String.t(),
          game_state: Game.t()
        }
  defstruct [:name, :game_state]

  def new(),
    do: %__MODULE__{
      name: "Name of the game",
      game_state: Game.new()
    }

  @spec handle_event([String.t()], any(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(event, params, struct) do
    case event do
      ["key_up"] -> struct |> Game.select(params)
      ["game", "select_square"] -> struct |> Game.select(params)
    end
  end
end
