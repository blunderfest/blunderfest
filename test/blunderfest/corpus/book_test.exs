defmodule Blunderfest.Corpus.BookTest do
  # async: false — rebuilds the shared test corpus tables.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus

  # The start position after 1. e4 (black to move).
  @e4 "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
  @fen_after_e4 "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)

    # Two games continuing 1. e4: one that answers e5 and wins as white,
    # one that answers c5 and loses as white. A third game reaching the
    # same position twice only counts once for its (distinct) answer.
    File.write!(
      Path.join(dir, "keys-10.tsv"),
      Enum.join(
        [
          Enum.join([@e4, "1", "1"], "\t"),
          Enum.join([@e4, "2", "1"], "\t")
        ],
        "\n"
      ) <> "\n"
    )

    File.write!(
      Path.join(dir, "games-10.tsv"),
      Enum.join(
        [
          Enum.join(["1", "A", "B", "1-0", "d", "e", "o", "1", "2", "ev", "tc", "s"], "\t"),
          Enum.join(["2", "C", "D", "0-1", "d", "e", "o", "1", "2", "ev", "tc", "s"], "\t")
        ],
        "\n"
      ) <> "\n"
    )

    File.write!(
      Path.join(dir, "moves-10.tsv"),
      Enum.join(
        [
          Enum.join(["1", "e4 e5 Nf3"], "\t"),
          Enum.join(["2", "e4 c5 Nf3"], "\t")
        ],
        "\n"
      ) <> "\n"
    )

    %{data_dir: dir}
  end

  test "per-move games and W/D/B, independent games not occurrences", %{data_dir: dir} do
    assert Corpus.rebuild(dir, 10).games == 2

    assert {:ok, rows} = fetch(dir)
    by_move = Map.new(rows, &{&1.move, &1})

    # e5: one game, white won it. c5: one game, white lost (black won).
    assert by_move["e5"] == %{move: "e5", games: 1, white: 1, draw: 0, black: 0}
    assert by_move["c5"] == %{move: "c5", games: 1, white: 0, draw: 0, black: 1}
  end

  test "empty for a position with no occurrences", %{data_dir: dir} do
    assert Corpus.rebuild(dir, 10).games == 2

    # A position that is not in the corpus at all.
    assert Corpus.book("8/8/8/8/8/8/8/K6k w - - 0 1") == []
  end

  test "invalid FEN is rejected" do
    assert {:error, :invalid_fen} = Corpus.book("not a fen")
  end

  test "book_counts batches keys into one per-FEN count map", %{data_dir: dir} do
    assert Corpus.rebuild(dir, 10).games == 2

    # The after-e4 position has 2 independent games; the start position and
    # an unseen position have none (absent from the map). An invalid FEN is
    # skipped, not an error.
    counts =
      Corpus.book_counts([
        @fen_after_e4,
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "8/8/8/8/8/8/8/K6k w - - 0 1",
        "not a fen"
      ])

    assert counts == %{@fen_after_e4 => 2}
  end

  # The book query reads the shared configured corpus (the app boots with it).
  defp fetch(_dir) do
    case Corpus.book(@fen_after_e4) do
      {:error, _} = err -> err
      rows -> {:ok, rows}
    end
  end
end
