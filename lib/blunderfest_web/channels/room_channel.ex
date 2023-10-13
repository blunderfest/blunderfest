defmodule BlunderfestWeb.RoomChannel do
  use BlunderfestWeb, :channel
  alias BlunderfestWeb.Presence
  alias Nanoid

  @impl true
  def join("room:" <> _roomCode, _payload, socket) do
    user_id =
      Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    send(self(), :after_join)
    {:ok, %{user_id: user_id}, assign(socket, :user_id, user_id)}
  end

  # Channels can be used in a request/response fashion
  # by sending replies to requests from the client
  @impl true
  def handle_in("ping", payload, socket) do
    {:reply, {:ok, payload}, socket}
  end

  # It is also common to receive messages from the client and
  # broadcast to everyone in the current topic (room:lobby).
  @impl true
  def handle_in("shout", payload, socket) do
    broadcast_from(socket, "shout", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    {:ok, _} =
      Presence.track(socket, socket.assigns.user_id, %{
        online_at: inspect(System.system_time(:millisecond)),
        user_id: socket.assigns.user_id
      })

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end
end
