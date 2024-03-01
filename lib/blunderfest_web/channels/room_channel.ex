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
  def handle_in("increment", _params, socket) do
    IO.puts("Increment")
    {:noreply, socket}
  end

  @impl true
  def handle_in("incrementByAmount", %{"amount" => amount}, socket) do
    IO.puts("Increment by #{amount}")
    {:noreply, socket}
  end

  @impl true
  def handle_in("decrement", _params, socket) do
    IO.puts("Decrement")
    {:noreply, socket}
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end
end
