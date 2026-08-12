defmodule Blunderfest.GameAnalysis do
  @moduledoc """
  Whole-game analysis jobs (ADR-0009): evaluates each mainline position on
  the engine pool, broadcasts progress, and finishes by appending a
  `set_analysis` op to the room — the op log keeps the single source of
  truth, so every member (re)joining gets the same evals.

  One job per room at a time; a second request while busy is `:busy`.
  Results are recomputed on demand — nothing here is durable (ADR-0001).
  """

  alias Blunderfest.Engine.Pool
  alias Blunderfest.Rooms
  alias BlunderfestWeb.Endpoint

  @depth 12

  @doc "Starts a job for `positions` ([{ply, fen}] mainline order); `:ok` or `{:error, :busy}`."
  def start(slug, game_id, positions) do
    case Registry.lookup(Blunderfest.AnalysisJobs, slug) do
      [] ->
        Task.start(fn -> run(slug, game_id, positions) end)
        :ok

      _ ->
        {:error, :busy}
    end
  end

  defp run(slug, game_id, positions) do
    Registry.register(Blunderfest.AnalysisJobs, slug, nil)
    total = length(positions)

    evals =
      positions
      |> Enum.with_index(1)
      |> Enum.map(fn {{ply, fen}, done} ->
        result = Pool.eval(fen, @depth)

        Endpoint.broadcast("room:" <> slug, "analysis_progress", %{
          "game_id" => game_id,
          "done" => done,
          "total" => total
        })

        case result do
          {:ok, %{score: score, best_move: best_move}} ->
            %{"ply" => ply, "score" => to_white(score, fen), "best_move" => best_move}

          {:error, _} ->
            %{"ply" => ply, "score" => nil, "best_move" => nil}
        end
      end)

    op = %{
      "type" => "set_analysis",
      "author" => "Blunderfest",
      "payload" => %{"game_id" => game_id, "depth" => @depth, "evals" => evals}
    }

    case Rooms.append(slug, op) do
      {:ok, stamped} -> Endpoint.broadcast("room:" <> slug, "new_op", stamped)
      {:error, _} -> :ok
    end
  end

  # UCI scores are from the side to move; we store white's perspective.
  defp to_white(score, fen) do
    black_to_move = fen |> String.split(" ") |> Enum.at(1) == "b"

    case {score, black_to_move} do
      {%{"cp" => cp}, true} -> %{"cp" => -cp}
      {%{"mate" => n}, true} -> %{"mate" => -n}
      {score, false} -> score
    end
  end
end
