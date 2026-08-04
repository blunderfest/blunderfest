defmodule BlunderfestWeb.HealthController do
  use BlunderfestWeb, :controller

  def check(conn, _params) do
    case Blunderfest.Repo.query("SELECT 1") do
      {:ok, _} ->
        json(conn, %{status: "ok"})

      {:error, _} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "error"})
    end
  end
end
