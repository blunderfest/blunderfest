defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  alias Blunderfest.RoomSupervisor
  alias Blunderfest.Core.RoomServer
  # alias Blunderfest.Presence

  def index(
        conn,
        %{"room_code" => room_code} = _params
      ) do
    # if RoomServer.exists?(room_code) do
    conn
    |> assign(:room_code, room_code)
    |> render(:index, layout: false)

    # else
    #   conn |> redirect(to: ~p"/") |> halt()
    # end
  end

  def index(conn, _params) do
    case RoomSupervisor.create() do
      {:ok, room_code} -> conn |> redirect(to: ~p"/#{room_code}")
      {:error, error} -> raise error
    end
  end
end
