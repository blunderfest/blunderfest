defmodule Blunderfest.Core.Room do
  alias Blunderfest.Core.State.Game
  require Logger

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:room_code, String.t())
    field(:count, integer())
    field(:games, list(String.t()))
    field(:games_by_code, %{String.t() => Game.t()})
    field(:active_game, String.t())
  end

  def new(room_code) do
    game = Game.new()
    other_game = Game.new()

    %__MODULE__{
      room_code: room_code,
      count: 0,
      games: [game.game_code, other_game.game_code],
      games_by_code: %{game.game_code => game, other_game.game_code => other_game},
      active_game: game.game_code
    }
  end

  @spec handle_event(list(String.t()), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(["room", "activate_game"], %{"game_code" => game_code}, room),
    do: %{room | active_game: game_code}

  def handle_event(["room", "increment"], _params, room),
    do: %{room | count: room.count + 1}

  def handle_event(["room", "incrementByAmount"], %{"amount" => amount}, room),
    do: %{room | count: room.count + amount}

  def handle_event(["room", "decrement"], _params, room),
    do: %{room | count: room.count - 1}

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

  def handle_event(event, _params, room) do
    Logger.warning("Unknown room event #{event}")
    room
  end
end
