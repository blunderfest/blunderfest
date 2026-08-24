defmodule Blunderfest.CorpusFacadeTest do
  # async: false — shares the app-booted Corpus process and rebuilds tables.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus

  @key "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)

    File.write!(Path.join(dir, "keys-10.tsv"), Enum.join([@key, "1", "2"], "\t") <> "\n")
    File.write!(Path.join(dir, "games-10.tsv"), "1\tA\tB\t1-0\td\te\to\t1\t2\tev\ttc\ts\n")
    File.write!(Path.join(dir, "moves-10.tsv"), "1\te4 c5\n")

    %{data_dir: dir}
  end

  test "delegates queries to the occurrence store", %{data_dir: dir} do
    # The application boots in test env, so `Blunderfest.Corpus` is already
    # registered and configured (config/test.exs points at blunderfest_test).
    assert Corpus.configured?()

    assert Corpus.rebuild(dir, 10).occurrences == 1
    assert Corpus.occurrences(@key) == [{1, 2}]
    assert Corpus.position(@key).first_gid == 1
    assert Corpus.moves(1) == ["e4", "c5"]
    assert Corpus.game(1).white == "A"
    assert Corpus.pawn_bucket(Corpus.position(@key).pawn_hash) == [@key]
    assert Corpus.counts() == %{positions: 1, occurrences: 1, games: 1, moves: 1}
  end

  test "an unconfigured instance answers not_configured on every query" do
    prev = Application.get_env(:blunderfest, Blunderfest.Corpus)
    Application.put_env(:blunderfest, Blunderfest.Corpus, db: nil)

    on_exit(fn -> Application.put_env(:blunderfest, Blunderfest.Corpus, prev) end)

    {:ok, probe} = Corpus.start_link(name: :unconfigured_probe)

    on_exit(fn ->
      if Process.alive?(probe), do: GenServer.stop(probe)
    end)

    refute GenServer.call(probe, :configured?)
    assert {:error, :not_configured} = GenServer.call(probe, {:occurrences, "k"})
    assert {:error, :not_configured} = GenServer.call(probe, {:position, "k"})
    assert {:error, :not_configured} = GenServer.call(probe, {:pawn_bucket, 1})
    assert {:error, :not_configured} = GenServer.call(probe, {:game, 1})
    assert {:error, :not_configured} = GenServer.call(probe, {:moves, 1})
    assert {:error, :not_configured} = GenServer.call(probe, :counts)
    assert {:error, :not_configured} = GenServer.call(probe, {:rebuild, "dir", 10})
  end
end
