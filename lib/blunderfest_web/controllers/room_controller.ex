defmodule BlunderfestWeb.RoomController do
  alias Blunderfest.Rooms
  use BlunderfestWeb, :controller

  def index(
        conn,
        %{"room_code" => room_code}
      ) do
    if Rooms.exists?(room_code) do
      conn
      |> assign(:room_code, room_code)
      |> render(:index, layout: false)
    else
      conn
      |> redirect(to: ~p"/")
    end
  end

  def index(conn, params) when params == %{} do
    with {:ok, room_code} <- Rooms.create(), do: conn |> redirect(to: ~p"/#{room_code}")
  end

  def index(conn, %{"room_code" => _dummy}) do
    conn
    |> resp(404, "Not Found")
  end
end
