defmodule Blunderfest.Corpus.GameExportTest do
  # async: false — the corpus tables are rebuilt from the research fixture.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.{Extraction, TestFixtures}
  alias Blunderfest.Game.Tree

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)
    corpus = Path.join(dir, "fixture.pgn")
    File.write!(corpus, TestFixtures.pgn())

    out = Path.join(dir, "extracted")
    Extraction.run(corpus, games: 13, out_dir: out)
    Blunderfest.Corpus.rebuild(out, 13)

    :ok
  end

  test "rebuilds a playable mainline tree from the corpus rows" do
    assert {:ok, %Tree{} = tree} = Blunderfest.Corpus.export_game(1)

    assert tree.headers["White"] == "A"
    assert tree.headers["Black"] == "B"
    assert tree.headers["ECO"] == "E97"
    assert tree.headers["WhiteElo"] == "2400"
    assert tree.result == "1-0"

    mainline =
      Enum.reduce_while(Stream.iterate(0, &(&1 + 1)), tree.root, fn _i, node ->
        case node.children do
          [next | _] -> {:cont, next}
          [] -> {:halt, node}
        end
      end)

    # Game 1: 12 full moves (1. d4 … 12. … a5) = 24 plies.
    assert mainline.ply == 24
    assert mainline.san == "a5"
  end

  test "the root starts at the initial position with the first move as d4" do
    assert {:ok, tree} = Blunderfest.Corpus.export_game(2)

    assert tree.root.ply == 0
    assert tree.root.san == nil
    [first | _] = tree.root.children
    assert first.san == "d4"
    assert first.ply == 1
  end

  test "an unknown gid is not found" do
    assert {:error, :not_found} = Blunderfest.Corpus.export_game(999_999)
  end
end
