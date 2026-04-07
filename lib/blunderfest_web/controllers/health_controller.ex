defmodule BlunderfestWeb.HealthController do
  use BlunderfestWeb, :controller

  def index(conn, _params) do
    json(conn, %{
      status: "ok",
      version: Blunderfest.version(),
      timestamp: DateTime.utc_now()
    })
  end
end
