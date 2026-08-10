defmodule BlunderfestWeb.HealthControllerTest do
  use BlunderfestWeb.ConnCase, async: true

  test "GET /api/healthz reports ok and the node's region", %{conn: conn} do
    conn = get(conn, "/api/healthz")

    assert json_response(conn, 200) == %{"status" => "ok", "region" => "local"}
  end
end
