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
end
