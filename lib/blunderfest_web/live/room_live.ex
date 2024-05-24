defmodule BlunderfestWeb.RoomLive do
  alias Phoenix.Socket.Broadcast
  alias BlunderfestWeb.RoomPresence

  use BlunderfestWeb, :live_view

  require Logger

  @impl true
  def mount(%{"room_code" => room_code}, %{"user_id" => user_id}, socket) do
    if Blunderfest.RoomServer.exists?(room_code) do
      if connected?(socket) do
        Phoenix.PubSub.subscribe(Blunderfest.PubSub, RoomPresence.topic(room_code))
        RoomPresence.track_user(room_code, user_id)
      end

      {:ok, socket |> assign_room(room_code) |> assign_users() |> assign(:user_id, user_id)}
    else
      {:ok, socket |> push_navigate(to: ~p"/")}
    end
  end

  @impl true
  def handle_info(%Broadcast{event: "presence_diff"}, socket),
    do:
      {:noreply,
       socket
       |> assign_users()}

  defp assign_room(socket, room_code) do
    socket
    |> assign(:page_title, room_code)
    |> assign(:room_code, room_code)
  end

  defp assign_users(socket),
    do: socket |> assign(:users, RoomPresence.list_users(socket.assigns.room_code))
end
