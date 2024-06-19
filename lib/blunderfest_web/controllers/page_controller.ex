defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def index(conn, %{"room_code" => room_code}),
    do:
      conn
      |> put_layout(false)
      |> assign(:room_code, room_code)
      |> render(:index)

  def index(conn, %{}) do
    room_code = Nanoid.generate()
    redirect(conn, to: ~p"/#{room_code}")
  end
end
