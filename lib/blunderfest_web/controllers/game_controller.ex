defmodule BlunderfestWeb.GameController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Game

  def index(conn, params) do
    limit = Map.get(params, "limit", 20) |> String.to_integer()
    offset = Map.get(params, "offset", 0) |> String.to_integer()

    case Game.list(limit: limit, offset: offset) do
      {:ok, games} ->
        json(conn, %{success: true, data: games})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def show(conn, %{"id" => id}) do
    case Game.get(String.to_integer(id)) do
      {:ok, game} ->
        json(conn, %{success: true, data: game})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: %{code: "NOT_FOUND", message: "Game not found"}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def create(conn, %{"pgn" => pgn}) do
    case Game.add(pgn) do
      {:ok, game_id} ->
        conn
        |> put_status(:created)
        |> json(%{success: true, data: %{id: game_id}})

      {:error, reason} ->
        conn
        |> put_status(:bad_request)
        |> json(%{success: false, error: %{code: "INVALID_INPUT", message: reason}})
    end
  end

  def update(conn, %{"id" => id, "annotations" => annotations}) do
    case Game.update(String.to_integer(id), annotations: annotations) do
      :ok ->
        json(conn, %{success: true})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def delete(conn, %{"id" => id}) do
    case Game.delete(String.to_integer(id)) do
      :ok ->
        json(conn, %{success: true})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def pgn(conn, %{"id" => id}) do
    case Game.get_pgn(String.to_integer(id)) do
      {:ok, pgn} ->
        text(conn, pgn)

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{success: false, error: %{code: "NOT_FOUND", message: "Game not found"}})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end

  def positions(conn, %{"id" => id}) do
    case Game.get_positions(String.to_integer(id)) do
      {:ok, positions} ->
        json(conn, %{success: true, data: positions})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{success: false, error: %{code: "DATABASE_ERROR", message: reason}})
    end
  end
end
