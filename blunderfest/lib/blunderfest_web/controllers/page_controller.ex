defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def index(conn, _params), do:
    render(conn, :index, layout: false)
end
