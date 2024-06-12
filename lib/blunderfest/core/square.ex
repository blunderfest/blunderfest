defmodule Blunderfest.Core.Square do
  @moduledoc """
  A square on the chess board.
  """
  alias Blunderfest.Core.Bitboard
  import Blunderfest.Core.Bitboard

  @type t() :: %__MODULE__{
          square_index: integer()
        }

  defstruct [:square_index, :color, :selected]

  @spec new(integer()) :: Blunderfest.Core.Square.t()
  def new(square_index) when square_index in 0..63,
    do: %__MODULE__{
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
