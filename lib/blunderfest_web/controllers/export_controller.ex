defmodule BlunderfestWeb.ExportController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Game

  def pgn(conn, params) do
    filters = Map.get(params, "filters", %{})

    case Game.export_pgn(filters) do
      {:ok, pgn} ->
        conn
        |> put_resp_content_type("application/x-chess-pgn")
        |> send_resp(200, pgn)

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "EXPORT_ERROR", message: reason}})
    end
  end
end
