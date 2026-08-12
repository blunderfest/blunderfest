defmodule Blunderfest.EngineTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Engine.{Pool, Worker}

  @fake Path.expand("../support/fake_uci_engine.sh", __DIR__)
  @fen "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  describe "Worker" do
    test "handshakes and evaluates a position" do
      worker = start_supervised!({Worker, binary: @fake})

      assert {:ok, result} = Worker.eval(worker, @fen, 12)
      assert result.score == %{"cp" => 42}
      assert result.depth == 12
      assert result.best_move == "e2e4"
    end

    test "a missing binary answers with an error, never a crash" do
      worker = start_supervised!({Worker, binary: "/no/such/stockfish"})

      assert {:error, :engine_unavailable} = Worker.eval(worker, @fen, 12)
    end
  end

  describe "Pool" do
    test "evaluates through a worker" do
      pool = start_supervised!({Pool, binary: @fake, size: 1, name: nil})

      assert {:ok, %{score: %{"cp" => 42}}} = Pool.eval(@fen, 12, pool)
    end

    test "queues beyond the pool size and answers everyone" do
      pool = start_supervised!({Pool, binary: @fake, size: 1, name: nil})

      results =
        1..4
        |> Enum.map(fn _ -> Task.async(fn -> Pool.eval(@fen, 12, pool) end) end)
        |> Task.await_many()

      assert Enum.all?(results, &match?({:ok, %{score: %{"cp" => 42}}}, &1))
    end

    test "a missing binary reports unavailable, and the pool stays alive" do
      pool = start_supervised!({Pool, binary: "/no/such/stockfish", size: 2, name: nil})

      assert {:error, :engine_unavailable} = Pool.eval(@fen, 12, pool)
      assert Process.alive?(pool)
    end
  end
end
