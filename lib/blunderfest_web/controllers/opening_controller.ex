defmodule BlunderfestWeb.OpeningController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Analysis

  def index(conn, _params) do
    case Analysis.list_openings() do
      {:ok, openings} ->
        json(conn, %{success: true, data: openings})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def show(conn, %{"eco" => eco}) do
    case Analysis.get_opening(eco) do
      {:ok, opening} ->
        json(conn, %{success: true, data: opening})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: %{code: "NOT_FOUND", message: "Opening not found"}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def tree(conn, %{"eco" => eco}) do
    case Analysis.opening_tree(eco) do
      {:ok, tree} ->
        json(conn, %{success: true, data: tree})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def stats(conn, %{"eco" => eco}) do
    case Analysis.opening_stats(eco) do
      {:ok, stats} ->
        json(conn, %{success: true, data: stats})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end
end
