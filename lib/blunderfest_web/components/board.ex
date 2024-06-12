defmodule BlunderfestWeb.Components.Board do
  @moduledoc """
  Components for rendering the board.
  """

  use BlunderfestWeb, :html

  attr :square_index, :integer, required: true
  attr :selected, :boolean, required: true
  attr :color, :atom, values: [:dark, :light], required: true

  def square(assigns) do
    ~H"""
    <div
      class={[
        "aspect-square flex",
        @color == :dark && "bg-neutral-700 dark:bg-neutral-700",
        @color == :light && "bg-neutral-300 dark:bg-neutral-300"
      ]}
      phx-click="select_square"
      phx-value-square-index={@square_index}
    >
      <div class={[
        @selected &&
          "border-8 border-blue-800 h-full w-full"
      ]}>
      </div>
    </div>
    """
  end
end
