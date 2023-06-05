defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def index(conn, _params), do:
    conn
    |> render(:index, layout: false)
end
