defmodule BlunderfestWeb.PageLive do
  alias Blunderfest.RoomSupervisor
  alias Phoenix.Socket.Broadcast
  alias BlunderfestWeb.RoomPresence

  use BlunderfestWeb, :live_view

  require Logger

  @impl true
  def mount(%{"room_code" => room_code}, %{"user_id" => user_id}, socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Blunderfest.PubSub, RoomPresence.topic(room_code))
      RoomPresence.track_user(room_code, user_id)
    end

    {:ok, socket |> assign_room(room_code) |> assign_users() |> assign(:user_id, user_id)}
  end

  @impl true
  def mount(_params, _session, socket) do
    room_code = Nanoid.generate()

    with {:ok, _pid} <- RoomSupervisor.create_room(room_code) do
      {:ok, socket |> push_navigate(to: ~p"/#{room_code}")}
    else
      err ->
        Logger.error("Could not start room: #{inspect(err)}")
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
    if Blunderfest.RoomServer.exists?(room_code) do
      socket
      |> assign(:page_title, room_code)
      |> assign(:room_code, room_code)
    else
      socket |> push_navigate(to: ~p"/")
    end
  end

  defp assign_users(socket),
    do: socket |> assign(:users, RoomPresence.list_users(socket.assigns.room_code))
end
