defmodule Blunderfest.RoomSupervisor do
  use DynamicSupervisor

  alias Blunderfest.Core.RoomServer

  def start_child(room_code) do
    child_spec = %{
      id: RoomServer,
      start: {RoomServer, :start_link, [room_code]},
      restart: :transient
    }

    DynamicSupervisor.start_child(__MODULE__, child_spec)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
