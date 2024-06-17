defmodule Blunderfest.Core.Square do
  @moduledoc """
  A square on the chess board.
  """
  import Blunderfest.Core.Bitboard

  @type t() :: %__MODULE__{
          id: String.t(),
          square_index: integer(),
          color: :dark | :light,
          selected: boolean()
        }

  defstruct [:id, :square_index, :color, :selected]

  @spec new(integer()) :: Blunderfest.Core.Square.t()
  def new(square_index) when square_index in 0..63,
    do: %__MODULE__{
      id: "square-#{square_index}",
      square_index: square_index,
      color: color(square_index),
      selected: false
    }

  defp color(square_index),
    do:
      dark_squares()
      |> shift_right(square_index)
      |> intersect(1)
      |> to_color()

  defp to_color(1), do: :dark
  defp to_color(_bitboard), do: :light
end
