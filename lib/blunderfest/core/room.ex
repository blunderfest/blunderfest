defmodule Blunderfest.Core.Room do
  alias Blunderfest.Core.State.Game
  require Logger

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:room_code, String.t())
    field(:games, list(Game.t()))
    field(:current_game, String.t())
  end

  def new(room_code) do
    game = Game.new()
    other_game = Game.new()

    %__MODULE__{
      room_code: room_code,
      games: [game, other_game],
      current_game: game.game_code
    }
  end

  @spec handle_event(list(String.t()), map(), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(["room", "switchGame"], _meta, %{"game_code" => game_code}, room),
    do: %{room | current_game: game_code}

  def handle_event(["game", _] = event, meta, %{"game_code" => game_code} = payload, room) do
    IO.inspect(event)

    games =
      Enum.map(room.games, fn game ->
        if game.game_code == game_code,
          do: Game.handle_event(event, meta, payload, game),
          else: game
      end)

    %{room | games: games}
  end

  @spec handle_event(list(String.t()), map(), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(event, meta, payload, %__MODULE__{room_code: room_code} = room) do
    Logger.warning("Unknown room event #{event} #{meta} #{payload} #{room_code}")
    IO.inspect(meta)
    IO.inspect(payload)

    room
  end
end
