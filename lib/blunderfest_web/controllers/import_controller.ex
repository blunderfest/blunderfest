defmodule BlunderfestWeb.ImportController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Game.Tree
  alias Blunderfest.Lichess
  alias Blunderfest.PGN

  def pgn(conn, %{"pgn" => pgn}) when is_binary(pgn) do
    render_pgn(conn, pgn)
  end

  def pgn(conn, _params), do: invalid_request(conn)

  def lichess(conn, %{"url" => url}) when is_binary(url) do
    with {:ok, game_id} <- Lichess.game_id(url),
         {:ok, pgn} <- Lichess.export_pgn(game_id) do
      render_pgn(conn, pgn)
    else
      {:error, :invalid_url} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{code: "invalid_lichess_url"}})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{errors: %{code: "lichess_game_not_found"}})

      {:error, _} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{errors: %{code: "lichess_fetch_failed"}})
    end
  end

  def lichess(conn, _params), do: invalid_request(conn)

  defp render_pgn(conn, pgn) do
    case PGN.parse_many(pgn) do
      {:ok, [tree], []} ->
        json(conn, %{tree: tree_json(tree)})

      {:ok, [], []} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{code: "invalid_pgn", detail: %{reason: "no_games"}}})

      {:ok, [], [first | _]} ->
        # Nothing parseable — behave like the old all-or-nothing parse:
        # single-game imports keep their exact error path.
        case first.detail do
          %{reason: :too_large} ->
            conn
            |> put_status(:request_entity_too_large)
            |> json(%{errors: %{code: "pgn_too_large"}})

          detail ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: %{code: "invalid_pgn", detail: detail}})
        end

      {:ok, trees, failures} ->
        json(conn, %{
          trees: Enum.map(trees, &tree_json/1),
          failures: Enum.map(failures, &failure_json/1)
        })
    end
  end

  defp invalid_request(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end

  defp tree_json(%Tree{} = tree), do: Tree.to_map(tree)

  defp failure_json(%{index: index, detail: detail}), do: %{index: index, detail: detail}
end
