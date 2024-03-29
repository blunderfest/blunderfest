defmodule BlunderfestWeb.RoomChannel do
  use BlunderfestWeb, :channel

  alias Blunderfest.Core.RoomServer

  @impl true
  def join("room:" <> room_code, _params, socket) do
    case RoomServer.join(room_code, socket.assigns[:user_id]) do
      {:error, :room_not_found} ->
        {:error, "room_not_found"}

      {:ok, room} ->
        {:ok, room, socket}
    end
  end

  @impl true
  def handle_in(
        event,
        %{"meta" => %{"room_code" => room_code} = meta, "payload" => payload},
        socket
      ) do
    RoomServer.handle_event(room_code, event, %{meta: meta, payload: payload})

    {:noreply, socket}
  end

  @impl true
  def handle_info(%{event: event, payload: payload}, socket) do
    push(socket, event, payload)

    {:noreply, socket}
  end
end
