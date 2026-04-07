defmodule BlunderfestWeb.ImportController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Game

  def pgn(conn, %{"file" => upload}) do
    case upload do
      %{path: path, filename: filename} ->
        case Game.import_pgn(path) do
          {:ok, count, errors} ->
            json(conn, %{
              success: true,
              data: %{
                imported: count,
                errors: errors,
                filename: filename
              }
            })

          {:error, reason} ->
            conn
            |> put_status(:bad_request)
            |> json(%{success: false, error: %{code: "IMPORT_ERROR", message: reason}})
        end

      _ ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: %{code: "INVALID_INPUT", message: "No file uploaded"}})
    end
  end

  def status(conn, %{"id" => id}) do
    case Game.import_status(id) do
      {:ok, status} ->
        json(conn, %{success: true, data: status})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: %{code: "NOT_FOUND", message: "Import job not found"}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end
end
