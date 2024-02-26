defmodule Blunderfest.Core.Room do
  alias Blunderfest.Core.State.Game

  require Logger

  @type t() :: %__MODULE__{
          room_code: String.t(),
          games: list(String.t()),
          games_by_code: %{String.t() => Game.t()},
          active_game: String.t()
        }

  defstruct [:room_code, :count, :games, :games_by_code, :active_game]

  def new(room_code) do
    game = Game.new()
    other_game = Game.new()

    %__MODULE__{
      room_code: room_code,
      games: [game.game_code, other_game.game_code],
      games_by_code: %{game.game_code => game, other_game.game_code => other_game},
      active_game: game.game_code
    }
  end

  @spec handle_event(list(String.t()), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(["room", "activate_game"], %{"game_code" => game_code}, room),
    do: %{room | active_game: game_code}

  def handle_event(["game", _] = event, %{"game_code" => game_code} = params, room) do
    update_in(
      room,
      [Access.key!(:games_by_code), Access.key!(game_code)],
      &Game.handle_event(event, params, &1)
    )
  end

  def handle_event(event, %{"game_code" => game_code}, room) do
    Logger.warning("Unknown room event #{event} - #{game_code}")
    room
  end
end
