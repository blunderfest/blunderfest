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

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{errors: %{code: "unauthorized"}})
  end
end
