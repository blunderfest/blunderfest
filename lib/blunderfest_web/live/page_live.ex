defmodule BlunderfestWeb.PageLive do
  alias Phoenix.Socket.Broadcast
  alias BlunderfestWeb.RoomPresence
  alias Blunderfest.RoomServer

  use BlunderfestWeb, :live_view

  require Logger

  @impl true
  def mount(params, %{"user_id" => user_id}, socket) do
    {:ok, socket |> assign_room(params) |> assign(:user_id, user_id) |> subscribe}
  end

  @impl true
  def handle_info(%Broadcast{event: "presence_diff", topic: "room:" <> room_code}, socket),
    do:
      {:noreply,
       socket
       |> assign_users(room_code)}

  defp assign_room(socket, %{"room_code" => room_code}) do
    if Blunderfest.RoomServer.exists?(room_code) do
      socket
      |> assign(:page_title, room_code)
      |> assign(:room_code, room_code)
      |> assign_users(room_code)
    else
      socket |> push_navigate(to: ~p"/")
    end
  end

  defp assign_room(socket, %{}) do
    room_code = Nanoid.generate()

    with {:ok, _pid} <-
           Horde.DynamicSupervisor.start_child(Blunderfest.Supervisor, {RoomServer, room_code}) do
      socket |> push_navigate(to: ~p"/#{room_code}")
    else
      err ->
        Logger.error("Could not start room: #{inspect(err)}")
        socket |> push_navigate(to: ~p"/")
    end
  end

  defp assign_users(socket, room_code), do: socket |> assign(:users, list_users(room_code))

  defp list_users(room_code) do
    topic = RoomPresence.topic(room_code)

    case RoomPresence.list(topic) do
      %{^room_code => %{metas: list}} -> list
      _other -> []
    end
  end

  defp subscribe(%{assigns: %{user_id: user_id, room_code: room_code}} = socket) do
    if connected?(socket) do
      Phoenix.PubSub.subscribe(Blunderfest.PubSub, RoomPresence.topic(room_code))

      {:ok, _ref} =
        RoomPresence.track(self(), RoomPresence.topic(room_code), room_code, %{user_id: user_id})
    end

    socket
  end

  defp subscribe(socket), do: socket
end
