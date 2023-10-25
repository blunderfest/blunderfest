defmodule BlunderfestWeb.RoomChannel do
  use BlunderfestWeb, :channel

  alias Blunderfest.Game
  alias BlunderfestWeb.Presence
  alias Nanoid

  @impl true
  def join("room:" <> _roomCode, _payload, socket) do
    user_id =
      Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    games = [Game.new("game_1"), Game.new("game_2"), Game.new("game_3")]

    send(self(), :after_join)

    {:ok,
     %{
       user_id: user_id
     }, socket |> assign(:user_id, user_id) |> assign(:games, games)}
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
        user_id: socket.assigns.user_id
      })

    push(socket, "presence_state", Presence.list(socket))

    socket.assigns.games
    |> Enum.map(fn game -> %{type: "games/add", payload: game} end)
    |> Enum.each(fn event -> push(socket, "shout", event) end)

    {:noreply, socket}
  end
end
