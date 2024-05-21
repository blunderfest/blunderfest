defmodule BlunderfestWeb.PageController do
  alias Blunderfest.RoomServer
  use BlunderfestWeb, :controller

  require Logger

  def index(conn, _params) do
    room_code = Nanoid.generate()

    with {:ok, _pid} <-
           Horde.DynamicSupervisor.start_child(Blunderfest.Supervisor, {RoomServer, room_code}) do
      conn |> redirect(to: ~p"/#{room_code}")
    else
      err ->
        Logger.error("Could not start room: #{inspect(err)}")
        conn |> send_resp(400, "No thanks")
    end
  end

  def join(conn, %{"room_code" => room_code}) do
    if Blunderfest.RoomServer.exists?(room_code) do
      conn |> assign(:page_title, room_code) |> render(:index)
    else
      Logger.info("Room #{room_code} not found. Redirecting to index")

      redirect(conn, to: ~p"/")
    end
  end
end
