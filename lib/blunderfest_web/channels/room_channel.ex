defmodule BlunderfestWeb.RoomChannel do
  @moduledoc false
  alias Blunderfest.RoomServer
  alias BlunderfestWeb.Presence

  use BlunderfestWeb, :channel

  require Logger

  @impl Phoenix.Channel
  def join("room:" <> room_code, _payload, socket) do
    send(self(), :after_join)

    {:ok, %{user_id: socket.assigns.user_id}, socket |> assign(:room_code, room_code)}
  end

  @impl Phoenix.Channel
  def handle_info(:after_join, socket) do
    {:ok, _} =
      Presence.track(socket, socket.assigns.user_id, %{
        online_at: inspect(System.system_time(:second))
      })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl Phoenix.Channel
  def handle_in(event, payload, %{assigns: %{user_id: user_id, room_code: room_code}} = socket) do
    with {:ok} <- RoomServer.handle_event(user_id, room_code, event, payload) do
      broadcast_from(socket, event, payload)
    end

    {:noreply, socket}
  end
end
