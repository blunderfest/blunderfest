defmodule Blunderfest.Corpus.TestFixtures do
  @moduledoc """
  The research regression corpus (design brief §18): a 12-game synthetic
  corpus encoding the empirical findings of Spikes 04–06, so pipeline tests
  can assert the known case properties without the 100k tier.

  Cases (all keys and routes verified against echecs):

    * **F1** (gids 1–4) — the King's Indian Classical tabiya
      (`r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - -`,
      after 8…Ne7). Two continuation families: A (white Ne1/Nd3/Bd2, black
      Ne8/f5) and B (white Bd2/a3/Rb1, black a5/Nd7/f5).
    * **B1** (gid 5) — the tempo twin: same placement, black to move,
      reached one ply later via e3…e4 instead of e4 (route divergence at
      ply 7). Black's continuation {Ne8, h6, f5} belongs to family A on
      black's side; white's differs.
    * **B3** (gid 6) — Qc2 sideline, continuation {c5, dxc6, bxc6, b4,
      Be6, a4}: joins no family (own singleton).
    * **B4** (gid 7) — Nd2 hybrid: black's {a5, Nd7, f5} is exactly
      family B's black side; white's differs (a3/Rb1/f3 vs Bd2/a3/Rb1).
    * **A2** (gids 8–11) — the Ruy López tabiya after 7.Re1
      (`r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq -`).
      Two gids Closed (…d6 c3 O-O d4 Bg4), two gids Marshall (…O-O c3 d5).
    * **Same-game** (gid 12) — the F1 tabiya occurs at ply 16 and again at
      ply 20 (Ne1 Ne8 Nf3 Ng8 shuffle) in the same game.
  """

  @doc """
  The 12-game fixture PGN. Games carry minimal lichess-style headers so
  extraction produces full metadata rows.
  """
  @spec pgn() :: String.t()
  def pgn do
    """
    [Event "Fixture"]
    [Site "https://lichess.org/fix01"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.01"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2400"]
    [BlackElo "2350"]
    [TimeControl "300+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Ne1 Ne8 10. Nd3 f5 11. Bd2 Kh8 12. Rc1 a5 1-0

    [Event "Fixture"]
    [Site "https://lichess.org/fix02"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.01"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2200"]
    [BlackElo "2150"]
    [TimeControl "300+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Ne1 Ne8 10. Nd3 f5 11. Bd2 g5 12. f3 Kh8 1-0

    [Event "Fixture"]
    [Site "https://lichess.org/fix03"]
    [White "A"]
    [Black "B"]
    [Result "1/2-1/2"]
    [UTCDate "2017.05.01"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2100"]
    [BlackElo "2050"]
    [TimeControl "600+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Bd2 a5 10. a3 Nd7 11. Rb1 f5 12. Qc2 Kh8 1/2-1/2

    [Event "Fixture"]
    [Site "https://lichess.org/fix04"]
    [White "A"]
    [Black "B"]
    [Result "0-1"]
    [UTCDate "2017.05.01"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2000"]
    [BlackElo "2100"]
    [TimeControl "600+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Bd2 a5 10. a3 Nd7 11. Rb1 f5 12. Qc2 g5 0-1

    [Event "Fixture"]
    [Site "https://lichess.org/fix05"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.02"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2300"]
    [BlackElo "2250"]
    [TimeControl "300+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e3 O-O 5. Nf3 d6 6. Be2 Nc6 7. O-O e5
    8. d5 Ne7 9. e4 Ne8 10. Bg5 h6 11. Be3 f5 12. Qc1 Kh8 1-0

    [Event "Fixture"]
    [Site "https://lichess.org/fix06"]
    [White "A"]
    [Black "B"]
    [Result "0-1"]
    [UTCDate "2017.05.02"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "1900"]
    [BlackElo "1950"]
    [TimeControl "600+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Qc2 c5 10. dxc6 bxc6 11. b4 Be6 12. a4 Qc7 0-1

    [Event "Fixture"]
    [Site "https://lichess.org/fix07"]
    [White "A"]
    [Black "B"]
    [Result "1/2-1/2"]
    [UTCDate "2017.05.02"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2150"]
    [BlackElo "2100"]
    [TimeControl "600+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Nd2 a5 10. a3 Nd7 11. Rb1 f5 12. f3 Kh8 1/2-1/2

    [Event "Fixture"]
    [Site "https://lichess.org/fix08"]
    [White "A"]
    [Black "B"]
    [Result "1/2-1/2"]
    [UTCDate "2017.05.03"]
    [ECO "C88"]
    [Opening "Ruy Lopez"]
    [WhiteElo "2450"]
    [BlackElo "2400"]
    [TimeControl "300+0"]

    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Be7 7. Re1 d6
    8. c3 O-O 9. d4 Bg4 10. h3 Bh5 1/2-1/2

    [Event "Fixture"]
    [Site "https://lichess.org/fix09"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.03"]
    [ECO "C88"]
    [Opening "Ruy Lopez"]
    [WhiteElo "2350"]
    [BlackElo "2300"]
    [TimeControl "300+0"]

    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Be7 7. Re1 d6
    8. c3 O-O 9. d4 Bg4 10. a4 b4 1-0

    [Event "Fixture"]
    [Site "https://lichess.org/fix10"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.03"]
    [ECO "C89"]
    [Opening "Ruy Lopez"]
    [WhiteElo "2500"]
    [BlackElo "2450"]
    [TimeControl "300+0"]

    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Be7 7. Re1 O-O
    8. c3 d5 9. exd5 Nxd5 10. d4 exd4 1-0

    [Event "Fixture"]
    [Site "https://lichess.org/fix11"]
    [White "A"]
    [Black "B"]
    [Result "0-1"]
    [UTCDate "2017.05.03"]
    [ECO "C89"]
    [Opening "Ruy Lopez"]
    [WhiteElo "2250"]
    [BlackElo "2300"]
    [TimeControl "600+0"]

    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O b5 6. Bb3 Be7 7. Re1 O-O
    8. c3 d5 9. exd5 Nxd5 10. d4 Bb7 0-1

    [Event "Fixture"]
    [Site "https://lichess.org/fix12"]
    [White "A"]
    [Black "B"]
    [Result "1-0"]
    [UTCDate "2017.05.04"]
    [ECO "E97"]
    [Opening "King's Indian"]
    [WhiteElo "2050"]
    [BlackElo "2000"]
    [TimeControl "600+0"]

    1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
    8. d5 Ne7 9. Ne1 Ne8 10. Nf3 Nf6 11. Bd2 g5 12. Rc1 Kh8 1-0
    """
  end

  @doc "The F1 tabiya key (white to move)."
  def tabiya_key, do: "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - -"

  @doc "The B1 tempo-twin key (same placement, black to move)."
  def b1_key, do: "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - -"

  @doc "The B3 sideline key (Qc2, black to move)."
  def b3_key, do: "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PPQ1BPPP/R1B2RK1 b - -"

  @doc "The B4 sideline key (Nd2, black to move)."
  def b4_key, do: "r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N5/PP1NBPPP/R1BQ1RK1 b - -"

  @doc "The A2 tabiya key (black to move)."
  def a2_key, do: "r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq -"

  @doc """
  Expected occurrence layout per case key, as `%{key => [{gid, ply}]}`.
  Derived from the fixture's routes; the fixture test asserts the corpus
  actually produces exactly this.
  """
  def expected_occurrences do
    %{
      tabiya_key() => [
        {1, 16},
        {2, 16},
        {3, 16},
        {4, 16},
        {6, 16},
        {7, 16},
        {12, 16},
        {12, 20}
      ],
      b1_key() => [{5, 17}],
      b3_key() => [{6, 17}],
      b4_key() => [{7, 17}],
      a2_key() => [{8, 13}, {9, 13}, {10, 13}, {11, 13}]
    }
  end

  @doc "Case ids of the F1 exact-occurrence games in fixture order."
  def tabiya_gids, do: [1, 2, 3, 4, 6, 7, 12]

  @doc "Case ids of the A2 exact-occurrence games in fixture order."
  def a2_gids, do: [8, 9, 10, 11]
end
