defmodule BlunderfestWeb.IndexLive do
  alias Blunderfest.RoomSupervisor

  use BlunderfestWeb, :live_view

  require Logger

  @impl true
  def mount(_params, _session, socket) do
    room_code = Nanoid.generate()

    case RoomSupervisor.create_room(room_code) do
      {:ok, _pid} ->
        {:ok, socket |> push_navigate(to: ~p"/#{room_code}")}

      err ->
        Logger.error("Could not start room: #{inspect(err)}")
        {:ok, socket |> push_navigate(to: ~p"/")}
    end
  end
end
