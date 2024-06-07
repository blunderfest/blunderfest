defmodule BlunderfestWeb.Board do
  @moduledoc """
  Components for rendering the board.
  """

  use BlunderfestWeb, :html

  attr :color, :atom, values: [:dark, :light], required: true

  def square(assigns) do
    ~H"""
    <div>
      <%= @color %>
    </div>
    """
  end
end
