defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  alias BlunderfestWeb.Presence
  alias Blunderfest.Game.IdGenerator
  alias Blunderfest.Game.RoomServer
  alias Nanoid

  def join(conn, %{"room_code" => room_code}) do
    case RoomServer.server_found?(room_code) do
      false ->
        conn
        |> redirect(to: ~p"/")
        |> halt()

      true ->
        conn
        |> assign(:room_code, room_code)
        |> render(:index, layout: false)
    end
  end

  def index(conn, _params), do: conn |> create_new_room()

  defp create_new_room(conn) do
    room_code =
      Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    Blunderfest.DynamicSupervisor.create_room(room_code)
    room = RoomServer.get_room(room_code)

    Enum.each(room.game_codes, fn game_code ->
      Blunderfest.DynamicSupervisor.create_game(game_code)
    end)

    conn
    |> redirect(to: ~p"/#{room_code}")
    |> halt()
  end
end
