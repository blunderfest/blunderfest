defmodule Blunderfest.Core.State.Game do
  alias Blunderfest.Core.State.Game.Position
  alias __MODULE__.Square

  require Logger

  use TypedStruct

  @derive Jason.Encoder
  typedstruct do
    field(:game_code, String.t())
    field(:squares, list(Square.t()))
    field(:position, Position.t())
  end

  def new(),
    do: %__MODULE__{
      game_code: Nanoid.generate(),
      squares: 0..63 |> Enum.map(fn square_index -> Square.new(square_index) end),
      position: Position.new()
    }

  def select(game, _square_index), do: game

  def handle_event(["games", "select"], _meta, %{"file" => file, "rank" => rank}, game) do
    IO.puts("SELECT #{file} #{rank}")
    game
  end

  def handle_event(event, %{"game_code" => game_code} = meta, payload, game) do
    Logger.warning("Unknown game event #{event} - #{game_code}")
    IO.inspect(meta)
    IO.inspect(payload)
    game
  end
end
