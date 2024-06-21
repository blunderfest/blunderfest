defmodule BlunderfestWeb.RoomChannel do
  @moduledoc false
  alias Blunderfest.RoomServer

  use BlunderfestWeb, :channel

  require Logger

  @impl true
  def join("room:" <> room_code, _payload, socket) do
    Process.flag(:trap_exit, true)

    case RoomServer.start(room_code) do
      {:ok, pid} ->
        Logger.info("Started room #{room_code}: #{inspect(pid)}")

      {:error, {:already_started, pid}} ->
        Logger.info("Room already started #{room_code}: #{inspect(pid)}")
    end

    {:ok, %{user_id: socket.assigns.user_id}, socket}
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
    broadcast(socket, "shout", payload)
    {:noreply, socket}
  end

  @impl true
  def handle_in("counter/increment", _payload, socket) do
    {:reply, {:ok, %{type: "server/some_server_event", payload: socket.assigns}}, socket}
  end

  def handle_in(_event, _payload, socket) do
    {:stop, :invalid_event, socket}
  end
end
