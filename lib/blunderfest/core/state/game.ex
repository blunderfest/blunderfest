defmodule Blunderfest.Core.State.Game do
  alias Blunderfest.Core.State.Game.Position
  alias __MODULE__.Square

  require Logger

  @type t() :: %__MODULE__{
          game_code: String.t(),
          squares: list(Square.t()),
          position: Position.t(),
          count: integer()
        }

  defstruct [:game_code, :squares, :position, :count]

  def new(),
    do: %__MODULE__{
      game_code: Nanoid.generate(),
      squares: 0..63 |> Enum.map(fn square_index -> Square.new(square_index) end),
      position: Position.new(),
      count: 0
    }

  def select(game, _square_index), do: game

  @spec handle_event(list(String.t()), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(["game", "increment"], _params, game), do: update_in(game.count, &(&1 + 1))

  def handle_event(event, %{"game_code" => game_code}, game) do
    Logger.warning("Unknown game event #{event} - #{game_code}")
    game
  end
end
