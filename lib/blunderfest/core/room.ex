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

  @spec handle_event(list(String.t()), map(), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(["rooms", "activate_game"], %{"gameCode" => game_code}, _payload, room),
    do: %{room | active_game: game_code}

  def handle_event(["rooms", "increment"], _meta, _payload, room),
    do: %{room | count: room.count + 1}

  def handle_event(["rooms", "incrementByAmount"], _meta, %{"amount" => amount}, room),
    do: %{room | count: room.count + amount}

  def handle_event(["rooms", "decrement"], _meta, _payload, room),
    do: %{room | count: room.count - 1}

  def handle_event(["games", _] = event, %{"gameCode" => game_code} = meta, payload, room) do
    IO.inspect(event)

    update_in(
      room,
      [Access.key!(:games_by_code), Access.key!(game_code)],
      fn room -> Game.handle_event(event, meta, payload, room) end
    )
  end

  def handle_event(event, %{"gameCode" => game_code} = meta, payload, room) do
    Logger.warning("Unknown room event 1 #{event} - #{game_code}")
    IO.inspect(meta)
    IO.inspect(payload)

    room
  end

  def handle_event(event, meta, payload, room) do
    Logger.warning("Unknown room event 2 #{event}")
    IO.inspect(meta)
    IO.inspect(payload)

    room
  end
end
