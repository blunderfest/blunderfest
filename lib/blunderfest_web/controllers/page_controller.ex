defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def index(conn, _params) do
    room_code = Nanoid.generate()

    Horde.DynamicSupervisor.start_child(Blunderfest.Supervisor, Blunderfest.RoomServer)

    conn |> redirect(to: ~p"/#{room_code}")
  end

  def join(conn, %{"room_code" => room_code}) do
    IO.puts("Joining #{room_code}")

    conn |> assign(:page_title, room_code) |> render(:index)
  end
end
