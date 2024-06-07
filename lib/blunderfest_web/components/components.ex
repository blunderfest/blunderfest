defmodule BlunderfestWeb.Components do
  @moduledoc """
  Defines the UI components.
  """

  use Phoenix.Component
  import BlunderfestWeb.CoreComponents
  alias Phoenix.LiveView.JS

  embed_templates "pages/*"

  attr :room_code, :string, required: true

  def room_link(%{room_code: ""} = assigns) do
    ~H"""
    """
  end

  def room_link(assigns) do
    ~H"""
    <%= @room_code %>

    <.button :if={String.length(@room_code) > 0} phx-click="copy_link">
      <.icon name="hero-clipboard" class="size-5" />
    </.button>
    """
  end
end
