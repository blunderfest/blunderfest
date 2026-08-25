defmodule BlunderfestWeb.HistoricalEvidenceController do
  use BlunderfestWeb, :controller

  @doc """
  `POST /api/historical-evidence` — the vertical slice's Analyze endpoint.

  Body:

      {"fen": "<FEN>", "route": ["e4", "e5", ...], "ref_ply": 16}

  `route` is the SAN list leading to the position in the user's game (the
  moves up to and including `ref_ply`); when `ref_ply` is omitted it
  defaults to the route length. Both are optional — a bare FEN is a valid
  analysis target.
  """

  def analyze(conn, %{"fen" => fen} = params) do
    route = params["route"]
    ref_ply = params["ref_ply"]

    opts =
      []
      |> then(&if(route, do: Keyword.put(&1, :route, route), else: &1))
      |> then(&if(is_integer(ref_ply), do: Keyword.put(&1, :ref_ply, ref_ply), else: &1))

    case Blunderfest.HistoricalEvidence.analyze(fen, opts) do
      {:ok, result} ->
        json(conn, result)

      {:error, {:invalid_fen, reason}} ->
        conn
        |> put_status(422)
        |> json(%{errors: %{code: "invalid_fen", detail: reason}})
    end
  end

  def analyze(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{errors: %{code: "invalid_fen", detail: "fen is required"}})
  end

  @doc """
  `GET /api/historical-evidence/games/:gid` — a corpus game as a playable
  tree, so an evidence card can open the full game.
  """
  def game(conn, %{"gid" => gid}) do
    case Integer.parse(gid) do
      {n, ""} when n > 0 ->
        case Blunderfest.HistoricalEvidence.game(n) do
          {:ok, tree} ->
            json(conn, %{tree: tree})

          {:error, :not_found} ->
            conn
            |> put_status(404)
            |> json(%{errors: %{code: "game_not_found"}})

          {:error, :unavailable} ->
            conn
            |> put_status(503)
            |> json(%{errors: %{code: "corpus_unavailable"}})
        end

      _ ->
        conn
        |> put_status(422)
        |> json(%{errors: %{code: "invalid_gid"}})
    end
  end

  def game(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{errors: %{code: "invalid_gid"}})
  end
end
