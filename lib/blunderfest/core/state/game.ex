defmodule Blunderfest.Core.State.Game do
  alias Blunderfest.Core.State.Game.Position
  alias __MODULE__.Square

  @type t() :: %__MODULE__{
          game_code: String.t(),
          squares: list(Square.t()),
          position: String.t(),
          count: integer()
        }

  defstruct [:game_code, :squares, :position, :count]

  def new(),
    do: %__MODULE__{
      game_code: Nanoid.generate(),
      # 0..63 |> Enum.map(fn square_index -> Square.new(square_index) end),
      squares: [],
      # Position.new(),
      position: "x",
      count: 0
    }

  def select(game, _square_index), do: game

  @spec handle_event(list(String.t()), map(), __MODULE__.t()) :: __MODULE__.t()
  def handle_event(event, _params, game) do
    case event do
      ["game", "increment"] ->
        update_in(game.count, &(&1 + 1))

      _ ->
        IO.inspect("Unknown game event #{event}")
    end
  end
end
