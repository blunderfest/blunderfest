defmodule BlunderfestWeb.AnalysisController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Analysis

  def create(conn, params) do
    fen = params["fen"]
    depth = params["depth"] || 20
    engine = params["engine"] || "stockfish"

    case Analysis.analyze(fen, depth: depth, engine: engine) do
      {:ok, analysis_id} ->
        json(conn, %{success: true, data: %{id: analysis_id}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "ANALYSIS_ERROR", message: reason}})
    end
  end

  def show(conn, %{"id" => id}) do
    case Analysis.get(id) do
      {:ok, analysis} ->
        json(conn, %{success: true, data: analysis})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: %{code: "NOT_FOUND", message: "Analysis not found"}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def cancel(conn, %{"id" => id}) do
    case Analysis.cancel(id) do
      :ok ->
        json(conn, %{success: true})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "ANALYSIS_ERROR", message: reason}})
    end
  end
end
