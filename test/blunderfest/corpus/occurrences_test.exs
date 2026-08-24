defmodule Blunderfest.Corpus.OccurrencesTest do
  # async: false — every test rebuilds the corpus tables in a shared database.
  use ExUnit.Case, async: false

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.{Occurrences, PositionKey}

  @key_a "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
  @key_b "rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq -"
  @key_c "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RN1QKBNR b KQkq -"

  setup context do
    dir = Path.join(context.tmp_dir, "data")

    File.mkdir_p!(dir)
    File.write!(Path.join(dir, "keys-10.tsv"), keys_fixture())
    File.write!(Path.join(dir, "games-10.tsv"), games_fixture())
    File.write!(Path.join(dir, "moves-10.tsv"), moves_fixture())

    db_opts = Application.fetch_env!(:blunderfest, Blunderfest.Corpus)[:db]

    conn =
      start_supervised!(
        {Postgrex,
         [name: :occurrences_test_pool, pool_size: 2] ++ Keyword.put(db_opts, :name, nil)}
      )

    %{conn: conn, data_dir: dir}
  end

  defp keys_fixture do
    Enum.join(
      [
        Enum.join([@key_a, "1", "5"], "\t"),
        Enum.join([@key_b, "2", "4"], "\t"),
        Enum.join([@key_a, "3", "2"], "\t"),
        Enum.join([@key_c, "4", "1"], "\t")
      ],
      "\n"
    ) <> "\n"
  end

  defp games_fixture do
    Enum.join(
      [
        "1\tAlpha\tBeta\t1-0\t2017.05.01\tB32\tSicilian\t2400\t2350\tEvent A\t300+0\tabc12",
        "2\tGamma\tDelta\t0-1\t2017.05.02\tC67\tRuy Lopez\t?\t?\tEvent B\t900+15\tdef34"
      ],
      "\n"
    ) <> "\n"
  end

  defp moves_fixture do
    Enum.join(["1\te4 c5 Nf3 d6 d4", "2\td4 d5 c4 e6 Nc3"], "\n") <> "\n"
  end

  defp pawn_hash(key) do
    key
    |> PositionKey.pawn_key()
    |> PositionKey.to_hash128()
    |> binary_part(0, 8)
    |> :binary.decode_unsigned()
    |> Bitwise.band(0x7FFFFFFFFFFFFFFF)
  end

  test "rebuild/3 loads all four tables", %{conn: conn, data_dir: dir} do
    assert Occurrences.rebuild(conn, dir, 10) == %{
             positions: 3,
             occurrences: 4,
             games: 2,
             moves: 2
           }
  end

  test "occurrences/2 returns all (gid, ply) in order", %{conn: conn, data_dir: dir} do
    Occurrences.rebuild(conn, dir, 10)

    assert Occurrences.occurrences(conn, @key_a) == [{1, 5}, {3, 2}]
    assert Occurrences.occurrences(conn, @key_c) == [{4, 1}]
    assert Occurrences.occurrences(conn, "unknown key") == []
  end

  test "position/2 carries pawn hash and the first occurrence", %{conn: conn, data_dir: dir} do
    Occurrences.rebuild(conn, dir, 10)

    assert Occurrences.position(conn, @key_a) == %{
             key: @key_a,
             pawn_hash: pawn_hash(@key_a),
             first_gid: 1,
             first_ply: 5
           }

    assert Occurrences.position(conn, "unknown key") == nil
  end

  test "pawn_bucket/2 returns distinct keys sharing the skeleton", %{conn: conn, data_dir: dir} do
    Occurrences.rebuild(conn, dir, 10)

    # key_a and key_c share the e4 skeleton; key_b differs.
    bucket = Occurrences.pawn_bucket(conn, pawn_hash(@key_a))
    assert Enum.sort(bucket) == Enum.sort([@key_a, @key_c])

    assert Occurrences.pawn_bucket(conn, pawn_hash(@key_b)) == [@key_b]
    assert Occurrences.pawn_bucket(conn, 0) == []
  end

  test "game/2 returns metadata with nullable elos", %{conn: conn, data_dir: dir} do
    Occurrences.rebuild(conn, dir, 10)

    assert Occurrences.game(conn, 1) == %{
             gid: 1,
             white: "Alpha",
             black: "Beta",
             result: "1-0",
             date: "2017.05.01",
             eco: "B32",
             opening: "Sicilian",
             white_elo: 2400,
             black_elo: 2350,
             event: "Event A",
             time_control: "300+0",
             site: "abc12"
           }

    assert Occurrences.game(conn, 2).white_elo == nil
    assert Occurrences.game(conn, 99) == nil
  end

  test "moves/2 returns the SAN list", %{conn: conn, data_dir: dir} do
    Occurrences.rebuild(conn, dir, 10)

    assert Occurrences.moves(conn, 1) == ["e4", "c5", "Nf3", "d6", "d4"]
    assert Occurrences.moves(conn, 99) == []
  end

  test "rebuild/3 is idempotent", %{conn: conn, data_dir: dir} do
    assert Occurrences.rebuild(conn, dir, 10) == %{
             positions: 3,
             occurrences: 4,
             games: 2,
             moves: 2
           }

    assert Occurrences.rebuild(conn, dir, 10) == %{
             positions: 3,
             occurrences: 4,
             games: 2,
             moves: 2
           }
  end

  test "rebuild/3 works from freshly extracted artifacts", %{conn: conn, data_dir: dir} do
    pgn = """
    [Event "X"]
    [Site "https://lichess.org/X1"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.01"]
    [ECO "B20"]
    [Opening "Sicilian"]
    [WhiteElo "2200"]
    [BlackElo "2100"]
    [TimeControl "600+0"]

    1. e4 c5 2. Nf3 d6 1-0

    [Event "Y"]
    [Site "https://lichess.org/Y2"]
    [White "C"]
    [Black "D"]
    [Result "1/2-1/2"]
    [UTCDate "2017.05.02"]
    [ECO "C20"]
    [Opening "KP"]
    [WhiteElo "1800"]
    [BlackElo "1900"]
    [TimeControl "300+0"]

    1. e4 e5 2. Nf3 Nc6 1/2-1/2
    """

    corpus = Path.join(Path.dirname(dir), "mini.pgn")
    File.write!(corpus, pgn)

    out = Path.join(dir, "extracted")
    %{stats: stats} = Blunderfest.Corpus.Extraction.run(corpus, games: 2, out_dir: out)
    assert stats.games == 2

    assert Occurrences.rebuild(conn, out, 2) == %{
             positions: 7,
             occurrences: 8,
             games: 2,
             moves: 2
           }

    key = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
    assert Occurrences.occurrences(conn, key) == [{1, 1}, {2, 1}]
    assert Occurrences.moves(conn, 1) == ["e4", "c5", "Nf3", "d6"]
  end
end
