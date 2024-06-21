defmodule BlunderfestWeb.PageController do
  alias Blunderfest.RoomServer
  use BlunderfestWeb, :controller

  def index(conn, %{"room_code" => room_code}) do
    if RoomServer.whereis(room_code) do
      conn
      |> put_layout(false)
      |> assign(:room_code, room_code)
      |> render(:index)
    else
      redirect(conn, to: ~p"/")
    end
  end

  def index(conn, %{}) do
    room_code = Nanoid.generate()
    RoomServer.start_room(room_code)

    redirect(conn, to: ~p"/#{room_code}")
  end
end
