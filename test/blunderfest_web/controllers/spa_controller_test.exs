defmodule BlunderfestWeb.SpaControllerTest do
  use BlunderfestWeb.ConnCase, async: false

  setup do
    path =
      Path.join(System.tmp_dir!(), "blunderfest_spa_#{System.unique_integer([:positive])}.html")

    Application.put_env(:blunderfest, :spa_index_path, path)

    on_exit(fn ->
      Application.delete_env(:blunderfest, :spa_index_path)
      File.rm(path)
    end)

    %{path: path}
  end

  test "serves the SPA shell for deep links", %{conn: conn, path: path} do
    File.write!(path, "<!doctype html><html><body>Blunderfest</body></html>")

    conn = get(conn, "/some/deep/link")

    assert response(conn, 200)
    assert get_resp_header(conn, "content-type") == ["text/html; charset=utf-8"]
  end

  test "reports 503 when the frontend has not been built", %{conn: conn} do
    conn = get(conn, "/some/deep/link")

    assert response(conn, 503)
    assert json_response(conn, 503) == %{"errors" => %{"detail" => "Frontend not built"}}
  end
end
