defmodule Blunderfest.Rooms do
  alias Blunderfest.Rooms.RoomServer
  alias Blunderfest.Rooms.RoomSupervisor

  def create() do
    room_code = Nanoid.generate()

    with {:ok, _pid} <- RoomSupervisor.create(room_code) do
      {:ok, room_code}
    end
  end

  defdelegate exists?(room_code), to: RoomServer
end
