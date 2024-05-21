defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def index(conn, _params) do
    room_code = Nanoid.generate()

    Blunderfest.RoomServer.start_link(room_code)

    conn |> redirect(to: ~p"/#{room_code}")
  end

  def join(conn, %{"room_code" => room_code}) do
    if Blunderfest.RoomServer.exists?(room_code) do
      IO.puts("Joining #{room_code}")

      conn |> assign(:page_title, room_code) |> render(:index)
    else
      redirect(conn, to: ~p"/")
    end
  end
end
