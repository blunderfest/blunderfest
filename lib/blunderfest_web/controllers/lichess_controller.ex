defmodule BlunderfestWeb.LichessController do
  @moduledoc """
  Lichess-data endpoints for a linked profile (ADR-0022): listing the
  owner's studies and importing one (every chapter becomes a game in the
  room, via the shared multi-game PGN parsing).
  """

  use BlunderfestWeb, :controller

  alias Blunderfest.Lichess
  alias BlunderfestWeb.{Auth, ImportController}

  def studies(conn, _params) do
    with {:ok, profile} <- Auth.bearer_profile(conn),
         account when not is_nil(account) <- Auth.lichess_account(profile),
         {:ok, studies} <- Lichess.studies(account.token, account.username) do
      json(conn, %{studies: studies})
    else
      :error ->
        unauthorized(conn)

      nil ->
        conn
        |> put_status(:forbidden)
        |> json(%{errors: %{code: "lichess_not_linked"}})

      {:error, :fetch_failed} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{errors: %{code: "lichess_fetch_failed"}})
    end
  end

  def import_study(conn, %{"study_id" => study_id}) when is_binary(study_id) do
    with {:ok, profile} <- Auth.bearer_profile(conn),
         account when not is_nil(account) <- Auth.lichess_account(profile),
         {:ok, pgn} <- Lichess.study_pgn(account.token, study_id) do
      ImportController.render_pgn(conn, pgn)
    else
      :error ->
        unauthorized(conn)

      nil ->
        conn
        |> put_status(:forbidden)
        |> json(%{errors: %{code: "lichess_not_linked"}})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{errors: %{code: "lichess_study_not_found"}})

      {:error, :fetch_failed} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{errors: %{code: "lichess_fetch_failed"}})
    end
  end

  def import_study(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end

  @max_games_per_import 10

  def games(conn, params) do
    max =
      case Integer.parse(to_string(params["max"] || "10")) do
        {n, ""} when n > 0 and n <= 25 -> n
        _ -> 10
      end

    with {:ok, profile} <- Auth.bearer_profile(conn),
         account when not is_nil(account) <- Auth.lichess_account(profile),
         {:ok, games} <- Lichess.recent_games(account.token, account.username, max) do
      json(conn, %{games: games})
    else
      :error ->
        unauthorized(conn)

      nil ->
        conn
        |> put_status(:forbidden)
        |> json(%{errors: %{code: "lichess_not_linked"}})

      {:error, :fetch_failed} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{errors: %{code: "lichess_fetch_failed"}})
    end
  end

  def import_games(conn, %{"game_ids" => game_ids})
      when is_list(game_ids) and length(game_ids) > 0 and
             length(game_ids) <= @max_games_per_import do
    with {:ok, profile} <- Auth.bearer_profile(conn),
         account when not is_nil(account) <- Auth.lichess_account(profile) do
      {trees, failures} =
        game_ids
        |> Enum.with_index(1)
        |> Enum.reduce({[], []}, fn {game_id, index}, {trees, failures} ->
          case import_one_game(account.token, game_id) do
            {:ok, tree} -> {[Blunderfest.Game.Tree.to_map(tree) | trees], failures}
            {:error, reason} -> {trees, [%{index: index, detail: %{reason: reason}} | failures]}
          end
        end)

      json(conn, %{trees: Enum.reverse(trees), failures: Enum.reverse(failures)})
    else
      :error ->
        unauthorized(conn)

      nil ->
        conn
        |> put_status(:forbidden)
        |> json(%{errors: %{code: "lichess_not_linked"}})
    end
  end

  def import_games(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end

  # Fetch and parse one game; exports are public but the token keeps the
  # rate limit per-user rather than per-IP. Failures never sink the batch.
  defp import_one_game(token, game_id) do
    case Lichess.export_pgn(game_id, token) do
      {:ok, pgn} ->
        case Blunderfest.PGN.parse(pgn) do
          {:ok, tree} -> {:ok, tree}
          {:error, detail} -> {:error, detail.reason}
        end

      {:error, :not_found} ->
        {:error, :lichess_game_not_found}

      {:error, :fetch_failed} ->
        {:error, :lichess_fetch_failed}
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{errors: %{code: "unauthorized"}})
  end
end
