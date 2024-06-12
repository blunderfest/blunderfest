defmodule BlunderfestWeb.Components.Square do
  @moduledoc false

  alias Blunderfest.Core.Bitboard
  use BlunderfestWeb, :live_component
  import Blunderfest.Core.Bitboard

  def update(%{square_index: square_index, selected_squares: selected_squares}, socket) do
    {:ok,
     socket
     |> assign(:square_index, square_index)
     |> assign(:color, color(square_index))
     |> assign(:selected, Bitboard.set?(selected_squares, square_index))
     |> assign(:selected_squares, selected_squares)
     |> dbg()}
  end

  defp color(square_index),
    do:
      dark_squares()
      |> shift_right(square_index)
      |> intersect(1)
      |> to_color()

  defp to_color(1), do: :dark
  defp to_color(_bitboard), do: :light
end
