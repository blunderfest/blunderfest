defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  alias Blunderfest.RoomSupervisor
  alias Blunderfest.Core.RoomServer
  # alias Blunderfest.Presence

  def index(
        conn,
        %{"room_code" => room_code} = _params
      ) do
    user_id = get_session(conn, :user_id)

    case RoomServer.join(room_code, user_id) do
      {:error, :room_not_found} ->
        conn |> redirect(to: ~p"/") |> halt()

      {:ok, room} ->
        conn
        |> assign(:room_code, room_code)
        |> assign(:room, room)
        |> assign(:users, [])
        |> render(:index, layout: false)
    end
  end

  def index(conn, _params) do
    case RoomSupervisor.create() do
      {:ok, room_code} -> conn |> redirect(to: ~p"/#{room_code}")
      {:error, error} -> raise error
    end
  end
end
