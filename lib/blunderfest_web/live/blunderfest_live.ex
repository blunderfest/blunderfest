defmodule BlunderfestWeb.BlunderfestLive do
  use BlunderfestWeb, :live_view

  alias Blunderfest.RoomSupervisor
  alias BlunderfestWeb.Presence
  alias Blunderfest.Core.RoomServer
  alias Blunderfest.Core.State.Game.LocalState

  def mount(
        %{"room_code" => room_code} = _params,
        %{"user_id" => user_id} = _session,
        socket
      ) do
    if connected?(socket) do
      case RoomServer.join(room_code, user_id) do
        {:error, :room_not_found} -> {:ok, push_navigate(socket, to: "/")}
        state -> {:ok, socket |> assign(:local, state) |> assign(:users, [])}
      end
    else
      {:ok, socket |> assign(:local, nil) |> assign(:users, [])}
    end
  end

  def mount(_params, _session, socket) do
    room_code = Nanoid.generate()
    RoomSupervisor.start_child(room_code)

    {:ok, socket |> push_navigate(to: ~p"/#{room_code}")}
  end

  def handle_info(%{event: "presence_diff", topic: topic}, socket) do
    {:noreply, socket |> assign(:users, Presence.list_users(topic))}
  end

  # https://www.youtube.com/watch?v=aErs_DIWxl8
  def handle_info({event, params}, socket), do: do_handle_event(event, params, socket)

  def handle_event(event, params, socket), do: do_handle_event(event, params, socket)

  defp do_handle_event(raw_event, params, socket) do
    {:noreply,
     socket
     |> assign(
       :local,
       raw_event |> normalize_event() |> LocalState.handle_event(params, socket.assigns)
     )}
  end

  defp normalize_event(event), do: event |> String.split("/")
end
