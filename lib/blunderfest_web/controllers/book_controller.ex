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
        # A short cache: eases the cursor's repeat visits without pinning a
        # stale corpus — the tables change only on a rebuild, but a long
        # max-age would serve the pre-rebuild numbers for a day.
        conn
        |> put_resp_header("cache-control", "private, max-age=300")
        |> json(%{moves: rows})
    end
  end

  def show(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{errors: %{code: "invalid_fen", detail: "fen is required"}})
  end

  @doc """
  `POST /api/book/counts` — independent-game counts for a batch of FENs
  (the transposition candidates' support). Body: `{"fens": [...]}`.
  Returns `%{fen => games}`; positions with no occurrences are absent.
  503 when no corpus is configured.
  """
  def counts(conn, %{"fens" => fens}) when is_list(fens) do
    case Blunderfest.Corpus.book_counts(fens) do
      {:error, :not_configured} ->
        conn
        |> put_status(503)
        |> json(%{errors: %{code: "corpus_unavailable"}})

      counts ->
        json(conn, %{counts: counts})
    end
  end

  def counts(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{errors: %{code: "invalid_fens", detail: "fens is required"}})
  end
end
