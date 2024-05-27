defmodule BlunderfestWeb.RoomController do
  use BlunderfestWeb, :controller

  alias Blunderfest.RoomSupervisor

  def index(conn, _params) do
    room_code = Nanoid.generate()

    {:ok, _pid} = RoomSupervisor.create_room(room_code)

    redirect(conn, to: ~p"/#{room_code}")
  end
end
