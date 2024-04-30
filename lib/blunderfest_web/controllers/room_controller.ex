defmodule BlunderfestWeb.RoomController do
  use BlunderfestWeb, :controller

  def index(
        conn,
        %{"room_code" => room_code} = _params
      ) do

    conn
    |> assign(:room_code, room_code)
    |> render(:index, layout: false)
  end

  def index(conn, _params) do
    room_code = Nanoid.generate()
    conn |> redirect(to: ~p"/#{room_code}")
  end
end
