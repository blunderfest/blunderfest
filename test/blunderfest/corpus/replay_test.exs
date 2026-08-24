defmodule Blunderfest.Corpus.ReplayTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Corpus.Replay

  describe "scan_sans/1" do
    test "extracts the mainline SAN list, skipping numbers, comments, NAGs and results" do
      movetext = """
      1. e4 {[%clk 0:00:58]} e5 2. Nf3 Nc6 3. Bb5 $1 a6 4. Ba4 Nf6 5. O-O 1/2-1/2
      """

      assert Replay.scan_sans(movetext) == [
               "e4",
               "e5",
               "Nf3",
               "Nc6",
               "Bb5",
               "a6",
               "Ba4",
               "Nf6",
               "O-O"
             ]
    end

    test "skips recursive annotation variations" do
      movetext = "1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 (2. f4 exf4) Nc6 1-0"

      assert Replay.scan_sans(movetext) == ["e4", "e5", "Nf3", "Nc6"]
    end

    test "skips semicolon comments to end of line" do
      assert Replay.scan_sans("1. e4 ; a comment\n e5 1-0") == ["e4", "e5"]
    end

    test "stops at the result token, tolerating trailing garbage" do
      assert Replay.scan_sans("1. d4 d5 1-0 some trailing garbage") == ["d4", "d5"]
    end
  end

  describe "replay/2" do
    test "returns states in play order" do
      assert {:ok, states} = Replay.replay(Echecs.new_game(), "1. e4 c5 2. Nf3")
      assert length(states) == 3
      assert Echecs.FEN.to_string(states |> List.last()) =~ "2p5/4P3/5N2"
    end

    test "resolves castling" do
      movetext = "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O Nf6 1-0"
      assert {:ok, states} = Replay.replay(Echecs.new_game(), movetext)
      assert length(states) == 8
    end

    test "reports the failing SAN" do
      assert {:error, _reason, "Qz9"} = Replay.replay(Echecs.new_game(), "1. e4 Qz9 0-1")
    end
  end
end
