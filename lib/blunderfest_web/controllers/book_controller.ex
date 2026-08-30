defmodule BlunderfestWeb.BookController do
  use BlunderfestWeb, :controller

  @doc """
  `GET /api/book?fen=…` — the opening-book next-move stats for a position
  (games + white/draw/black counts per move). 200 with an empty list for a
  position with no occurrences; 503 when no corpus is configured.
  """

  def show(conn, %{"fen" => fen}) do
    case Blunderfest.Corpus.book(fen) do
      {:error, :invalid_fen} ->
        conn
        |> put_status(422)
        |> json(%{errors: %{code: "invalid_fen"}})

      {:error, :not_configured} ->
        conn
        |> put_status(503)
        |> json(%{errors: %{code: "corpus_unavailable"}})

      rows ->
        json(conn, %{moves: rows})
    end
  end

  def show(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{errors: %{code: "invalid_fen", detail: "fen is required"}})
  end
end
