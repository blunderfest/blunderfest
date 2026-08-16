defmodule BlunderfestWeb.ChesscomController do
  @moduledoc """
  Lists a chess.com player's games for one month via the official public
  API (see `Blunderfest.Chesscom` for the terms posture). Device
  credentials are required so the endpoint isn't a free proxy.
  """

  use BlunderfestWeb, :controller

  alias Blunderfest.Chesscom
  alias BlunderfestWeb.Auth

  def games(conn, params) do
    with {:ok, _profile} <- Auth.bearer_profile(conn),
         {:ok, username} <- fetch_username(params),
         {:ok, {year, month}} <- fetch_month(params) do
      case Chesscom.games_for_month(username, year, month) do
        {:ok, games} ->
          json(conn, %{games: games})

        {:error, :not_found} ->
          conn
          |> put_status(:not_found)
          |> json(%{errors: %{code: "chesscom_player_not_found"}})

        {:error, :fetch_failed} ->
          conn
          |> put_status(:bad_gateway)
          |> json(%{errors: %{code: "chesscom_fetch_failed"}})
      end
    else
      :error ->
        unauthorized(conn)

      {:error, :invalid_request} ->
        invalid_request(conn)
    end
  end

  defp fetch_username(params) do
    case Map.get(params, "username") do
      username when is_binary(username) and byte_size(username) in 1..32 -> {:ok, username}
      _ -> {:error, :invalid_request}
    end
  end

  defp fetch_month(params) do
    today = Date.utc_today()
    year = parse_int(params["year"], today.year)
    month = parse_int(params["month"], today.month)

    if year in 2007..2100 and month in 1..12 do
      {:ok, {year, month}}
    else
      {:error, :invalid_request}
    end
  end

  defp parse_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} -> n
      _ -> default
    end
  end

  defp parse_int(value, _default) when is_integer(value), do: value
  defp parse_int(_, default), do: default

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{errors: %{code: "unauthorized"}})
  end

  defp invalid_request(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end
end
