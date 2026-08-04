defmodule BlunderfestWeb.HealthController do
  use BlunderfestWeb, :controller

  def check(conn, _params) do
    json(conn, %{status: "ok"})
  end
end
