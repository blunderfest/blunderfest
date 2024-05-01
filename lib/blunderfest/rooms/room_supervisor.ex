defmodule Blunderfest.Rooms.RoomSupervisor do
  alias Blunderfest.Rooms.RoomServer

  use DynamicSupervisor

  def start_link(arg),
    do: DynamicSupervisor.start_link(__MODULE__, arg, name: __MODULE__)

  @impl true
  def init(_init_arg), do: DynamicSupervisor.init(strategy: :one_for_one)

  def create(room_code), do: DynamicSupervisor.start_child(__MODULE__, {RoomServer, room_code})
end
