defmodule BlunderfestWeb.BlunderfestLive do
  use BlunderfestWeb, :live_view

  alias Blunderfest.RoomSupervisor
  alias Blunderfest.Core.RoomServer
  alias BlunderfestWeb.Presence

  def mount(
        %{"room_code" => room_code} = _params,
        %{"user_id" => user_id} = _session,
        socket
      ) do
    if connected?(socket) do
      case RoomServer.join(room_code, user_id) do
        {:error, :room_not_found} -> {:ok, socket |> push_navigate(to: "/")}
        {:ok, _room} -> {:ok, socket |> assign_room(room_code) |> assign(:users, [])}
      end
    else
      {:ok, socket |> assign(:room, nil) |> assign(:users, [])}
    end
  end

  def mount(_params, _session, socket) do
    case RoomSupervisor.create() do
      {:ok, room_code} -> {:ok, socket |> push_navigate(to: ~p"/#{room_code}")}
      {:error, error} -> raise error
    end
  end

  def handle_info(%{event: "presence_diff", topic: topic}, socket) do
    {:noreply, socket |> assign(:users, Presence.list_users(topic))}
  end

  def handle_info(:update, socket) do
    {:noreply, socket |> assign_room()}
  end

  # https://www.youtube.com/watch?v=aErs_DIWxl8
  def handle_info(event, params, socket), do: do_handle_event(event, params, socket)

  def handle_event(event, params, socket), do: do_handle_event(event, params, socket)

  defp do_handle_event(raw_event, params, %{assigns: %{room: %{room_code: room_code}}} = socket) do
    :ok = RoomServer.handle_event(room_code, raw_event, params)
    {:noreply, socket}
  end

  defp assign_room(socket, room_code) do
    socket
    |> assign(:room_code, room_code)
    |> assign_room()
  end

  defp assign_room(%{assigns: %{room_code: room_code}} = socket) do
    socket
    |> assign(:room, RoomServer.get(room_code))
  end
end
