defmodule BlunderfestWeb.PositionController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Position

  def show(conn, %{"fen" => fen}) do
    case Position.stats(fen) do
      {:ok, stats} ->
        json(conn, %{success: true, data: stats})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def search(conn, params) do
    case Position.search(params) do
      {:ok, positions} ->
        json(conn, %{success: true, data: positions})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def games(conn, %{"fen" => fen}) do
    limit = conn.params["limit"] || "100"

    case Position.games(fen, limit: String.to_integer(limit)) do
      {:ok, games} ->
        json(conn, %{success: true, data: games})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def similar(conn, %{"fen" => fen}) do
    threshold = (conn.params["threshold"] || "0.8") |> Float.parse() |> elem(0)

    case Position.similar(fen, threshold: threshold) do
      {:ok, positions} ->
        json(conn, %{success: true, data: positions})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def transpositions(conn, %{"fen" => fen}) do
    case Position.transpositions(fen) do
      {:ok, transpositions} ->
        json(conn, %{success: true, data: transpositions})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end
end
