defmodule BlunderfestWeb.IndexLive do
  alias Blunderfest.RoomSupervisor

  use BlunderfestWeb, :live_view

  require Logger

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
end
