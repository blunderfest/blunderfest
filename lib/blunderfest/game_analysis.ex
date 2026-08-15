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
        {score, best_move} =
          case terminal_score(fen) do
            nil ->
              case Pool.eval(fen, @depth) do
                {:ok, %{score: score, best_move: best_move}} -> {to_white(score, fen), best_move}
                {:error, _} -> {nil, nil}
              end

            result ->
              {result, nil}
          end

        Endpoint.broadcast("room:" <> slug, "analysis_progress", %{
          "game_id" => game_id,
          "done" => done,
          "total" => total
        })

        %{"ply" => ply, "score" => score, "best_move" => best_move}
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

  # Terminal positions never reach the engine: a mated side comes back as
  # "mate 0", whose meaning ("side to move is mated") a perspective flip
  # cannot represent — flipping zero is still zero, so a white mate read as
  # a black win and the mating move was flagged as a blunder. The game's
  # result is stored instead.
  defp terminal_score(fen) do
    game = Echecs.new_game(fen)

    case Echecs.status(game) do
      :checkmate ->
        if fen |> String.split(" ") |> Enum.at(1) == "w" do
          %{"result" => "0-1"}
        else
          %{"result" => "1-0"}
        end

      :stalemate ->
        %{"result" => "1/2-1/2"}

      :draw ->
        %{"result" => "1/2-1/2"}

      :active ->
        nil
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
