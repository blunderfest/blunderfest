defmodule Blunderfest.Corpus.PositionKeyTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.PositionKey

  @startpos "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  defp play(sans) when is_binary(sans), do: play(String.split(sans))

  defp play(sans) when is_list(sans) do
    Enum.reduce(sans, Echecs.new_game(), fn san, game ->
      case Echecs.PGN.move_from_san(game, san) do
        {:ok, move} ->
          Echecs.Game.make_move(game, move)

        {:error, _} ->
          # Castling is the one SAN shape echecs resolves only pseudo-legally;
          # resolve it from the legal move list like Blunderfest.PGN does.
          special = if san == "O-O", do: :kingside_castle, else: :queenside_castle
          move = Enum.find(Echecs.legal_moves(game), &(&1.special == special))
          Echecs.Game.make_move(game, move)
      end
    end)
  end

  describe "canonical key" do
    test "start position" do
      assert {:ok, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"} =
               PositionKey.from_fen(@startpos)
    end

    test "move counters are not part of the key" do
      assert {:ok, key1} = PositionKey.from_fen(@startpos)

      assert {:ok, ^key1} =
               PositionKey.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 17 42")
    end

    test "invalid FEN is rejected" do
      assert {:error, _} = PositionKey.from_fen("not a fen")
    end

    test "transposition via move repetition reaches the same key" do
      game = play("Nf3 Nf6 Ng1 Ng8")
      assert PositionKey.from_game(game) == elem(PositionKey.from_fen(@startpos), 1)
    end
  end

  describe "en passant convention" do
    test "1.e4: the EP square is NOT in the key (no black pawn can capture)" do
      game = play("e4")

      assert PositionKey.from_game(game) ==
               "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"

      # ...while the raw FEN convention would record `e3`:
      assert PositionKey.raw_from_game(game) ==
               "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3"
    end

    test "EP noise: replayed double push and constructed FEN agree" do
      # 1.e4 sets the raw FEN EP flag (e3); the same position written without
      # it must produce the same canonical key — the flag is history-dependent
      # noise when no pawn can capture.
      assert PositionKey.from_game(play("e4")) ==
               elem(
                 PositionKey.from_fen(
                   "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
                 ),
                 1
               )
    end

    test "a capturable EP square IS part of the key" do
      # After 1.e4 a6 2.e5 d5, white pawn e5 can capture exd6 e.p.
      game = play("e4 a6 e5 d5")

      assert PositionKey.from_game(game) ==
               "rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6"
    end

    test "same placement without the EP capture available is a different key" do
      # Same placement as the previous test, but no EP capture available
      # (constructed directly): genuinely different position (different legal
      # move sets), so the keys must differ.
      {:ok, no_ep} =
        PositionKey.from_fen("rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3")

      with_ep = PositionKey.from_game(play("e4 a6 e5 d5"))
      assert no_ep != with_ep
    end

    test "a pinned EP capture (pseudo-legal but illegal) is NOT in the key" do
      # White pawn d5, black pawn e5 just double-pushed (EP e6), white king
      # a5, black rook h5: dxe6 would clear the 5th rank and expose the king.
      # The capture is pseudo-legal but illegal, so the EP field must drop.
      fen = "8/8/8/K2Pp2r/8/8/8/4k3 w - e6 0 1"
      game = Echecs.new_game(fen)

      # Sanity: echecs agrees the EP capture is not among the legal moves.
      refute Echecs.legal_moves(game) |> Enum.any?(&(&1.special == :en_passant))

      assert PositionKey.from_game(game) == "8/8/8/K2Pp2r/8/8/8/4k3 w - -"
    end
  end

  describe "hash128" do
    test "deterministic, 16 bytes" do
      {:ok, key} = PositionKey.from_fen(@startpos)
      h = PositionKey.to_hash128(key)
      assert byte_size(h) == 16
      assert h == PositionKey.to_hash128(key)
      assert h != PositionKey.to_hash128(key <> "x")
    end
  end

  describe "color_flip" do
    test "start position flips to itself with black to move" do
      assert PositionKey.color_flip("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -") ==
               "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq -"
    end

    test "is self-inverse" do
      key = PositionKey.from_game(play("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6"))
      assert key |> PositionKey.color_flip() |> PositionKey.color_flip() == key
    end

    test "mirrors ranks and swaps case, keeps files (Sicilian = reversed English)" do
      # 1.e4 c5 with colors reversed is 1.c4 e5 with black to move.
      key = PositionKey.from_game(play("e4 c5"))

      assert PositionKey.color_flip(key) ==
               "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR b KQkq -"
    end

    test "mirrors the EP square rank" do
      assert PositionKey.color_flip("rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6") ==
               "rnbqkbnr/pppp1ppp/8/8/3Pp3/P7/1PP1PPPP/RNBQKBNR b KQkq d3"
    end

    test "keeps castling rights in canonical order" do
      assert PositionKey.color_flip("8/8/8/8/8/8/8/8 w Qk -") ==
               "8/8/8/8/8/8/8/8 b Kq -"
    end
  end

  describe "pawn_key" do
    test "start position keeps only pawns" do
      {:ok, key} = PositionKey.from_fen(@startpos)
      assert PositionKey.pawn_key(key) == "8/pppppppp/8/8/8/8/PPPPPPPP/8"
    end

    test "an empty row collapses to 8" do
      assert PositionKey.pawn_key("rnbqkbnr/8/8/8/8/8/8/RNBQKBNR w - -") == "8/8/8/8/8/8/8/8"
    end

    test "removed pieces merge with adjacent empties" do
      assert PositionKey.pawn_key("r1b1kb1r/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq -") ==
               "8/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/8"
    end
  end
end
