defmodule BlunderfestWeb.HealthController do
  use BlunderfestWeb, :controller

  def check(conn, _params) do
    json(conn, %{status: "ok", region: Blunderfest.NodeInfo.region()})
  end
end
