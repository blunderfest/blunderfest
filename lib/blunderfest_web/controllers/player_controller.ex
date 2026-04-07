defmodule BlunderfestWeb.PlayerController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Player

  def index(conn, params) do
    query = params["q"] || ""

    case Player.search(query) do
      {:ok, players} ->
        json(conn, %{success: true, data: players})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def show(conn, %{"id" => id}) do
    case Player.get(String.to_integer(id)) do
      {:ok, player} ->
        json(conn, %{success: true, data: player})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: %{code: "NOT_FOUND", message: "Player not found"}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def games(conn, %{"id" => id}) do
    limit = conn.params["limit"] || "50"

    case Player.games(String.to_integer(id), limit: String.to_integer(limit)) do
      {:ok, games} ->
        json(conn, %{success: true, data: games})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def stats(conn, %{"id" => id}) do
    case Player.stats(String.to_integer(id)) do
      {:ok, stats} ->
        json(conn, %{success: true, data: stats})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def head_to_head(conn, %{"id1" => id1, "id2" => id2}) do
    case Player.head_to_head(String.to_integer(id1), String.to_integer(id2)) do
      {:ok, h2h} ->
        json(conn, %{success: true, data: h2h})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end
end
