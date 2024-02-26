defmodule BlunderfestWeb.BlunderfestLive do
  use BlunderfestWeb, :live_view

  alias Blunderfest.RoomSupervisor
  alias Blunderfest.Core.RoomServer
  alias Blunderfest.Presence

  def mount(
        %{"room_code" => room_code} = _params,
        %{"user_id" => user_id} = _session,
        socket
      ) do
    if connected?(socket) do
      case RoomServer.join(room_code, user_id) do
        {:error, :room_not_found} ->
          {:ok, socket |> push_navigate(to: "/")}

        {:ok, room} ->
          {:ok,
           socket
           |> assign(:room_code, room_code)
           |> assign(:room, room)
           |> assign(:users, [])}
      end
    else
      {:ok,
       socket
       |> assign(:room_code, nil)
       |> assign(:users, [])
       |> assign(:room, nil)}
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

  def handle_info(:update, %{assigns: %{room: %{room_code: room_code}}} = socket) do
    {:noreply, socket |> assign(:room, RoomServer.get(room_code))}
  end

  # https://www.youtube.com/watch?v=aErs_DIWxl8
  def handle_info(event, params, socket), do: do_handle_event(event, params, socket)

  def handle_event(event, params, socket), do: do_handle_event(event, params, socket)

  defp do_handle_event(raw_event, params, %{assigns: %{room_code: room_code}} = socket) do
    {:ok, room} = RoomServer.handle_event(room_code, raw_event, params)
    {:noreply, socket |> assign(:room, room)}
  end
end
