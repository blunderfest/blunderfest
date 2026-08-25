defmodule BlunderfestWeb.SpaController do
  @moduledoc """
  Serves the single-page application shell for non-API requests.

  The React frontend is compiled into `priv/static/index.html` (plus hashed
  assets) during the release build, so the backend carries no UI logic of its
  own — it only hands out the built bundle.
  """
  use BlunderfestWeb, :controller

  def index(conn, _params) do
    case File.read(index_path()) do
      {:ok, html} ->
        conn
        # The shell must never be reused across deploys: it references the
        # hashed asset bundle, so a cached shell keeps serving a stale app
        # after a deploy. `no-store` (not just revalidation) rules out any
        # browser/cache variance. The hashed assets themselves may be
        # cached; open tabs learn about deploys via the version beacon.
        |> put_resp_header("cache-control", "no-store")
        |> put_resp_header("content-type", "text/html; charset=utf-8")
        |> send_resp(:ok, html)

      {:error, _} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{errors: %{detail: "Frontend not built"}})
    end
  end

  defp index_path do
    Application.get_env(:blunderfest, :spa_index_path) ||
      Path.join(Application.app_dir(:blunderfest, "priv/static"), "index.html")
  end
end
