defmodule BlunderfestWeb.MovesController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Game.Moves

  def moves(conn, %{"fen" => fen}) when is_binary(fen) do
    case Moves.legal_moves(fen) do
      {:ok, moves} ->
        json(conn, %{moves: moves})

      {:error, _} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{code: "invalid_fen"}})
    end
  end

  def moves(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end
end
