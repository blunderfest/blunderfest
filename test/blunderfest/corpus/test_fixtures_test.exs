defmodule Blunderfest.Corpus.TestFixturesTest do
  # async: false — rebuilds the shared test-database corpus tables.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.{Extraction, Occurrences, TestFixtures}

  setup context do
    dir = Path.join(context.tmp_dir, "data")
    File.mkdir_p!(dir)
    corpus = Path.join(dir, "fixture.pgn")
    File.write!(corpus, TestFixtures.pgn())

    db_opts = Application.fetch_env!(:blunderfest, Blunderfest.Corpus)[:db]
    conn = start_supervised!({Postgrex, db_opts ++ [name: :fixtures_test_pool, pool_size: 2]})

    %{conn: conn, dir: dir, corpus: corpus}
  end

  test "the fixture replays cleanly and the corpus matches the expected occurrences", %{
    conn: conn,
    dir: dir,
    corpus: corpus
  } do
    out = Path.join(dir, "extracted")
    %{stats: stats} = Extraction.run(corpus, games: 12, out_dir: out)
    assert stats.games == 12
    assert stats.games_failed == 0

    Occurrences.rebuild(conn, out, 12)

    for {key, expected} <- TestFixtures.expected_occurrences() do
      assert Occurrences.occurrences(conn, key) == expected, "occurrence mismatch for #{key}"
    end
  end

  test "game rows carry the fixture metadata", %{conn: conn, dir: dir, corpus: corpus} do
    out = Path.join(dir, "extracted2")
    Extraction.run(corpus, games: 12, out_dir: out)
    Occurrences.rebuild(conn, out, 12)

    game = Occurrences.game(conn, 1)
    assert game.white == "A"
    assert game.black == "B"
    assert game.eco == "E97"
    assert game.white_elo == 2400
    assert game.site == "fix01"
  end
end
