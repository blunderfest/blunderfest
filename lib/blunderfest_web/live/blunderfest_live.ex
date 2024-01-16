defmodule BlunderfestWeb.BlunderfestLive do
  use BlunderfestWeb, :live_view

  alias Blunderfest.Core.RoomServer
  alias Blunderfest.Core.State.Game.LocalState

  def mount(%{"room_code" => room_code}, _session, socket) do
    IO.puts("mount: #{inspect(self())}")

    if connected?(socket) do
      case RoomServer.join(room_code) do
        {:error, :room_not_found} -> {:ok, push_navigate(socket, to: "/")}
        state -> {:ok, socket |> assign(:local, state)}
      end
    else
      {:ok, socket |> assign(:local, nil)}
    end
  end

  # https://www.youtube.com/watch?v=aErs_DIWxl8

  def handle_event(event, params, socket), do: do_handle_event(event, params, socket)

  def handle_info({event, params}, socket), do: do_handle_event(event, params, socket)

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
