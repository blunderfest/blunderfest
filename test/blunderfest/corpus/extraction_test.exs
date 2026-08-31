defmodule Blunderfest.Corpus.ExtractionTest do
  use ExUnit.Case, async: true

  @moduletag :tmp_dir

  alias Blunderfest.Corpus.{Extraction, PositionKey}

  # Three games: a clean Sicilian, one with comments/variations and a
  # multi-line movetext, and one whose SAN fails to resolve mid-game.
  @fixture """
  [Event "Rated Blitz game"]
  [Site "https://lichess.org/AbCdEf12"]
  [White "PlayerA"]
  [Black "PlayerB"]
  [Result "1-0"]
  [UTCDate "2017.05.01"]
  [ECO "B32"]
  [Opening "Sicilian Defense"]
  [WhiteElo "2400"]
  [BlackElo "2350"]
  [TimeControl "300+0"]

  1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 1-0

  [Event "Rated Classical game"]
  [Site "https://lichess.org/XyZz99"]
  [White "PlayerC"]
  [Black "PlayerD"]
  [Result "1/2-1/2"]
  [UTCDate "2017.05.02"]
  [ECO "C67"]
  [Opening "Ruy Lopez"]
  [WhiteElo "2100"]
  [BlackElo "2090"]
  [TimeControl "900+15"]

  1. e4 e5 2. Nf3 Nc6 3. Bb5 {the Ruy} a6 (3... Nf6 4. O-O) 4. Ba4 Nf6 5. O-O
  Be7 1/2-1/2

  [Event "Broken game"]
  [Site "https://lichess.org/BrOkEn"]
  [White "PlayerE"]
  [Black "PlayerF"]
  [Result "0-1"]
  [UTCDate "2017.05.03"]
  [ECO "?"]
  [Opening "?"]
  [WhiteElo "1500"]
  [BlackElo "1510"]
  [TimeControl "600+0"]

  1. e4 Qz9 0-1
  """

  setup context do
    path = Path.join(context.tmp_dir, "fixture.pgn")
    out = Path.join(context.tmp_dir, "out")
    File.write!(path, @fixture)
    %{corpus: path, out_dir: out}
  end

  test "run/2 extracts games, moves, keys and occ in corpus order", %{
    corpus: corpus,
    out_dir: out_dir
  } do
    result = Extraction.run(corpus, games: 3, out_dir: out_dir)

    assert result.stats.games == 2
    assert result.stats.games_failed == 1
    # game 1: 10 plies + the ply-0 start position, game 2: 10 plies + ply 0
    assert result.stats.plies == 22
    assert result.wall_ms >= 0

    moves = File.read!(result.paths.moves)
    games = File.read!(result.paths.games)
    keys = File.read!(result.paths.keys)
    occ = File.read!(result.paths.occ)

    # Moves: one row per game (the failed game keeps its row).
    assert String.split(moves, "\n", trim: true) |> length() == 3

    assert moves =~ "1\te4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6\n"

    # The failed game's movetext survives as scanned SANs.
    assert moves =~ "3\te4 Qz9\n"

    # Game metadata rows: 12 columns; site prefix stripped.
    assert String.split(games, "\n", trim: true) |> length() == 3

    assert games =~
             "1\tPlayerA\tPlayerB\t1-0\t2017.05.01\tB32\tSicilian Defense\t2400\t2350\t" <>
               "Rated Blitz game\t300+0\tAbCdEf12\n"

    # Keys: only replayed games contribute ply rows; each game now leads with
    # its ply-0 start position.
    key_rows = String.split(keys, "\n", trim: true)
    assert length(key_rows) == 22

    assert hd(key_rows) ==
             "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -\t1\t0"

    # The position after 1. e4 is ply 1 (the ply-0 start position precedes it).
    assert Enum.at(key_rows, 1) ==
             "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -\t1\t1"

    # Occ: hash rows match the canonical key rows.
    occ_rows = String.split(occ, "\n", trim: true)
    assert length(occ_rows) == 22

    assert hd(occ_rows) ==
             PositionKey.to_hash128_hex("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -") <>
               "\t1\t0"

    # A capturable EP square makes it into the key (game 1 ply 7: d4 cxd4...
    # no EP; ply 1 e4 has no capturer — check a real EP key instead: none in
    # this fixture, so assert the EP convention through from_game directly
    # is covered in PositionKeyTest).
    stats = File.read!(result.paths.stats) |> Jason.decode!()
    assert stats["games"] == 2
    assert stats["games_failed"] == 1
    assert stats["plies"] == 22
    assert stats["wall_ms"] >= 0
  end

  test "stream_games/1 yields headers, movetext and 1-based gid", %{corpus: corpus} do
    games = Extraction.stream_games(corpus) |> Enum.to_list()

    assert length(games) == 3

    # gid is the 1-based stream position.
    {{headers, movetext}, 1} = Enum.at(games, 0)
    assert headers["White"] == "PlayerA"
    assert headers["Site"] == "https://lichess.org/AbCdEf12"
    assert movetext =~ "1. e4 c5"

    {{_headers, movetext2}, 2} = Enum.at(games, 1)
    assert movetext2 =~ "1. e4 e5 2. Nf3 Nc6"
  end

  test "run/2 caps at the games limit", %{corpus: corpus, out_dir: out_dir} do
    result = Extraction.run(corpus, games: 2, out_dir: out_dir)
    assert result.stats.games == 2
    assert String.split(File.read!(result.paths.games), "\n", trim: true) |> length() == 2
  end

  test "non-standard games are skipped; Date is the UTCDate fallback", %{
    tmp_dir: tmp_dir
  } do
    # A standard game, a Chess960 game, a From-Position game, and a standard
    # game carrying only Date (no UTCDate). Only the two standard games land
    # in the corpus; the variant/setup games are counted as skipped, and the
    # Date-only game keeps its date.
    fixture = """
    [Event "Standard"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2026.01.01"]

    1. e4 e5 1-0

    [Event "Chess960"]
    [Variant "Chess960"]
    [White "C"]
    [Black "D"]
    [Result "1-0"]

    1. e4 e5 1-0

    [Event "From Position"]
    [Variant "From Position"]
    [SetUp "1"]
    [FEN "8/8/8/8/8/8/8/K6k w - - 0 1"]
    [White "E"]
    [Black "F"]
    [Result "0-1"]

    1. Kb1 0-1

    [Event "Date only"]
    [White "G"]
    [Black "H"]
    [Result "1/2-1/2"]
    [Date "2026.02.03"]

    1. d4 d5 1/2-1/2
    """

    corpus = Path.join(tmp_dir, "mixed.pgn")
    File.write!(corpus, fixture)
    out = Path.join(tmp_dir, "out")

    result = Extraction.run(corpus, games: 4, out_dir: out)

    assert result.stats.games == 2
    assert result.stats.games_skipped == 2
    assert result.stats.games_failed == 0

    games = File.read!(result.paths.games)
    # Only the two standard games; the variant/from-position games are absent.
    assert String.split(games, "\n", trim: true) |> length() == 2
    assert games =~ "\tA\tB\t"
    assert games =~ "\tG\tH\t"
    refute games =~ "\tC\tD\t"
    refute games =~ "\tE\tF\t"

    # The Date-only game carries its date (UTCDate fell back to Date).
    assert games =~ "\tG\tH\t1/2-1/2\t2026.02.03\t"

    # The stats JSON records the skip count.
    stats = File.read!(result.paths.stats) |> Jason.decode!()
    assert stats["games_skipped"] == 2
  end

  test "header values are sanitized for COPY (backslashes → slashes)", %{
    tmp_dir: tmp_dir
  } do
    # A raw backslash before a tab/newline makes COPY's text format treat it
    # as an escape and corrupt the row (bad_copy_file_format on load). The
    # extractor rewrites it to a forward slash.
    fixture = """
    [Event "T\\ournament"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2026.01.01"]

    1. e4 e5 1-0
    """

    corpus = Path.join(tmp_dir, "backslash.pgn")
    File.write!(corpus, fixture)
    out = Path.join(tmp_dir, "out")

    result = Extraction.run(corpus, games: 1, out_dir: out)
    games = File.read!(result.paths.games)

    assert result.stats.games == 1
    assert games =~ "T/ournament"
    refute games =~ "T\\ournament"
  end
end
