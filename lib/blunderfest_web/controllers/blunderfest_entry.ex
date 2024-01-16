defmodule BlunderfestWeb.BlunderfestEntry do
  use BlunderfestWeb, :controller

  alias Blunderfest.RoomSupervisor

  def index(conn, _params) do
    room_code = Nanoid.generate()

    RoomSupervisor.start_child(room_code)

    redirect(conn, to: ~p"/#{room_code}")
  end
end
