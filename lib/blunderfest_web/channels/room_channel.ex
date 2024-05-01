defmodule BlunderfestWeb.RoomChannel do
  use Phoenix.Channel

  @impl true
  def join(_topic, _payload, socket) do
    {:ok, socket}
  end

  @impl true
  def handle_in(_event, _payload, socket) do
    {:stop, :shutdown, socket}
  end
end
