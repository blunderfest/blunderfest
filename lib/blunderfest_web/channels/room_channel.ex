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

    {:ok, %{user_id: socket.assigns.user_id}, socket |> assign(:room_code, room_code)}
  end

  @impl true
  def handle_in(event, payload, %{assigns: %{user_id: user_id, room_code: room_code}} = socket) do
    with {:ok} <- RoomServer.handle_event(user_id, room_code, event, payload) do
      broadcast_from(socket, event, payload)
    end

    {:noreply, socket}
  end
end
