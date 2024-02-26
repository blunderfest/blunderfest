defmodule Blunderfest.Core.State.Game do
  alias Blunderfest.Core.State.Game.Position
  alias __MODULE__.Square

  require Logger

  @type t() :: %__MODULE__{
          game_code: String.t(),
          squares: list(Square.t()),
          position: String.t()
        }

  defstruct [:game_code, :squares, :position]

  def new(),
    do: %__MODULE__{
      game_code: Nanoid.generate(),
      squares: 0..63 |> Enum.map(fn square_index -> Square.new(square_index) end),
      position: Position.new()
    }

  def select(game, _square_index), do: game

  def handle_event(event, %{"game_code" => game_code}, game) do
    Logger.warning("Unknown game event #{event} - #{game_code}")
    game
  end
end
