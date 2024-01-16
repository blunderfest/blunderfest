defmodule Blunderfest.Core.State.Game do
  alias Blunderfest.Core.State.Game.Position
  alias __MODULE__.Square

  @type t() :: %__MODULE__{
          squares: list(Square.t()),
          position: Position.t()
        }

  defstruct [:squares, :position]

  def new(),
    do: %__MODULE__{
      squares: 0..63 |> Enum.map(fn square_index -> Square.new(square_index) end),
      position: Position.new()
    }

  def select(game, _square_index), do: game
end
