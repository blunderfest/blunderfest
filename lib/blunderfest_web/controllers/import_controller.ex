defmodule BlunderfestWeb.ImportController do
  use BlunderfestWeb, :controller

  alias Blunderfest.Game.{Node, Tree}
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
    case PGN.parse(pgn) do
      {:ok, tree} ->
        json(conn, %{tree: tree_json(tree)})

      {:error, %{reason: :too_large}} ->
        conn
        |> put_status(:request_entity_too_large)
        |> json(%{errors: %{code: "pgn_too_large"}})

      {:error, detail} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{code: "invalid_pgn", detail: detail}})
    end
  end

  defp invalid_request(conn) do
    conn
    |> put_status(:bad_request)
    |> json(%{errors: %{code: "invalid_request"}})
  end

  defp tree_json(%Tree{} = tree) do
    %{
      headers: tree.headers,
      result: tree.result,
      setup: tree.setup,
      root: node_json(tree.root),
      mainline_ply_count: Tree.mainline_ply_count(tree),
      node_count: Tree.node_count(tree)
    }
  end

  defp node_json(%Node{} = node) do
    %{
      id: node.id,
      ply: node.ply,
      san: node.san,
      from: node.from,
      to: node.to,
      promotion: node.promotion,
      comment: node.comment,
      nags: node.nags,
      status: node.status,
      fen: node.fen,
      children: Enum.map(node.children, &node_json/1)
    }
  end
end
