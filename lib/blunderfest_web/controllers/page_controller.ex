defmodule BlunderfestWeb.PageController do
  use BlunderfestWeb, :controller

  def index(conn, _params) do
    # Serve index.html from priv/static
    send_file(conn, 200, "/app/priv/static/index.html")
  end
end
