defmodule BlunderfestWeb.RoomChannel do
  use BlunderfestWeb, :channel

  alias Blunderfest.Core.RoomServer

  @impl true
  def join("room:" <> room_code, %{"user_id" => user_id}, socket) do
    case RoomServer.join(room_code, user_id) do
      {:error, :room_not_found} ->
        {:error, "room_not_found"}

      {:ok, _room} ->
        {:ok, socket}
    end
  end

  @impl true
  def handle_in(event, payload, %{topic: "room:" <> room_code} = socket) do
    RoomServer.handle_event(room_code, event, payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: event, payload: payload}, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end
end
