defmodule BlunderfestWeb.RoomLive do
  alias Phoenix.Socket.Broadcast
  alias BlunderfestWeb.RoomPresence

  use BlunderfestWeb, :live_view

  import BlunderfestWeb.Board

  require Logger

  @impl true
  def mount(_params, %{"user_id" => user_id}, socket) do
    {:ok, socket |> assign(:user_id, user_id) |> assign(:room_code, "")}
  end

  @impl true
  def handle_params(%{"room_code" => room_code}, uri, socket) do
    if connected?(socket) do
      if Blunderfest.RoomServer.exists?(room_code) do
        Phoenix.PubSub.subscribe(Blunderfest.PubSub, RoomPresence.topic(room_code))
        RoomPresence.track_user(room_code, socket.assigns.user_id)

        {:noreply,
         socket
         |> assign_room(room_code)
         |> assign(:current_uri, uri)
         |> assign_users()
         |> push_event("restore", %{key: "state", event: "restore_state"})}
      else
        {:noreply, socket |> push_navigate(to: ~p"/")}
      end
    else
      {:noreply,
       socket
       |> render_with(fn assigns ->
         ~H"""
         Loading <.icon name="hero-arrow-path" class="ml-1 animate-spin" />
         """
       end)}
    end
  end

  @impl true
  def handle_event("restore_state", _params, socket) do
    {:noreply, socket}
  end

  def handle_event("copy_link", _params, %{assigns: %{current_uri: current_uri}} = socket) do
    {:noreply,
     socket
     |> push_event("copy-to-clipboard", %{text: current_uri})}
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
