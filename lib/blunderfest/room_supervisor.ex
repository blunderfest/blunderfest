defmodule Blunderfest.RoomSupervisor do
  @moduledoc """
  Supervises RoomServers.
  """
  alias Blunderfest.RoomServer

  use Horde.DynamicSupervisor

  def start_link(init_arg) do
    Horde.DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  def init(init_arg) do
    [strategy: :one_for_one, members: :auto]
    |> Keyword.merge(init_arg)
    |> Horde.DynamicSupervisor.init()
  end

  def create_room(room_code) do
    Horde.DynamicSupervisor.start_child(__MODULE__, {RoomServer, room_code})
  end
end
