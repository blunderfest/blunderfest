defmodule BlunderfestWeb.PageController do
  alias Blunderfest.RoomServer
  use BlunderfestWeb, :controller

  require Logger

  def index(conn, _params) do
    room_code = Nanoid.generate()

    with {:ok, pid} <-
           Horde.DynamicSupervisor.start_child(Blunderfest.Supervisor, {RoomServer, room_code}) do
      found = Blunderfest.RoomServer.exists?(room_code)
      Logger.info("Started room #{room_code} with PID #{inspect(pid)}. Exists? #{found}")
      conn |> redirect(to: ~p"/#{room_code}")
    else
      err ->
        Logger.error("Could not start room: #{inspect(err)}")
        conn |> send_resp(400, "No thanks")
    end
  end

  def join(conn, %{"room_code" => room_code}) do
    if Blunderfest.RoomServer.exists?(room_code) do
      IO.puts("Joining #{room_code}")

      conn |> assign(:page_title, room_code) |> render(:index)
    else
      Logger.info("Room #{room_code} not found. Redirecting to index")

      redirect(conn, to: ~p"/")
    end
  end
end
