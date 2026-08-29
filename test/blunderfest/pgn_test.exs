defmodule Blunderfest.PGNTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Game.{Node, Tree}
  alias Blunderfest.PGN

  defp parse!(pgn) do
    assert {:ok, tree} = PGN.parse(pgn)
    tree
  end

  defp mainline(tree), do: mainline_chain(tree.root)

  defp mainline_chain(%Node{children: [mainline | _]} = node),
    do: [node | mainline_chain(mainline)]

  defp mainline_chain(node), do: [node]

  describe "headers" do
    test "parses headers, result and mainline" do
      tree =
        parse!("""
        [Event "Test Game"]
        [Site "Amsterdam"]
        [White "Alice"]
        [Black "Bob"]
        [Result "1-0"]

        1. e4 e5 2. Nf3 Nc6 1-0
        """)

      assert tree.headers["White"] == "Alice"
      assert tree.headers["Result"] == "1-0"
      assert tree.result == "1-0"

      sans = mainline(tree) |> Enum.map(& &1.san) |> Enum.reject(&is_nil/1)
      assert sans == ["e4", "e5", "Nf3", "Nc6"]

      [_, e4, e5, nf3, _] = mainline(tree)
      assert e4.ply == 1 and e4.from == "e2" and e4.to == "e4"
      assert e5.ply == 2 and e5.from == "e7" and e5.to == "e5"
      assert nf3.ply == 3 and nf3.from == "g1" and nf3.to == "f3"
    end

    test "result falls back to the Result header when absent from movetext" do
      tree = parse!("[Result \"0-1\"]\n\n1. e4 e5 *\n")
      assert tree.result == "*"

      tree = parse!("[Result \"0-1\"]\n\n1. e4 e5\n")
      assert tree.result == "0-1"
    end

    test "handles escaped quotes in header values" do
      tree = parse!("[Event \"The \\\"Best\\\" Game\"]\n\n1. e4 0-1\n")
      assert tree.headers["Event"] == "The \"Best\" Game"
    end
  end

  describe "SAN resolution" do
    test "castling (both sides)" do
      tree =
        parse!("""
        [FEN "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"]

        1. O-O O-O-O 1-0
        """)

      sans = mainline(tree) |> Enum.map(& &1.san)
      assert "O-O" in sans
      assert "O-O-O" in sans

      castle = mainline(tree) |> Enum.find(&(&1.san == "O-O"))
      assert castle.from == "e1" and castle.to == "g1"
      qcastle = mainline(tree) |> Enum.find(&(&1.san == "O-O-O"))
      assert qcastle.from == "e8" and qcastle.to == "c8"
    end

    test "en passant capture" do
      tree =
        parse!("1. e4 a6 2. e5 d5 3. exd6 *\n")

      ep = mainline(tree) |> Enum.find(&(&1.san == "exd6"))
      assert ep.from == "e5" and ep.to == "d6"
    end

    test "promotion with disambiguation" do
      tree =
        parse!("""
        [FEN "4k1n1/5P1P/8/8/8/8/8/4K3 w - - 0 1"]

        1. fxg8=Q+ Kd7 2. h8=Q *
        """)

      promo = mainline(tree) |> Enum.find(&(&1.san == "fxg8=Q+"))
      assert promo.from == "f7" and promo.to == "g8" and promo.promotion == "Q"
      promo2 = mainline(tree) |> Enum.find(&(&1.san == "h8=Q"))
      assert promo2.from == "h7" and promo2.to == "h8" and promo2.promotion == "Q"
    end

    test "file and rank disambiguation" do
      tree =
        parse!(
          "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *\n"
        )

      nbd7 = mainline(tree) |> Enum.find(&(&1.san == "Nbd7"))
      assert nbd7.from == "b8"

      tree =
        parse!("""
        [FEN "4k3/8/4N3/8/4N3/8/8/4K3 w - - 0 1"]

        1. N6c5 Ke7 2. Kd1 *
        """)

      n6c5 = mainline(tree) |> Enum.find(&(&1.san == "N6c5"))
      assert n6c5.from == "e6" and n6c5.to == "c5"
    end

    test "check and mate suffixes are stripped" do
      tree = parse!("1. f3 e5 2. g4 Qh4# 0-1\n")
      [_, _, _, _, mate] = mainline(tree)
      assert mate.san == "Qh4#"
      assert mate.status == :checkmate
      assert mate.from == "d8" and mate.to == "h4"
    end

    test "annotations and NAGs attach to the previous move" do
      tree = parse!("1. e4!? e5 $1 2. Nf3 {developing} Nc6 *\n")
      [_, e4, e5, _, _] = mainline(tree)
      assert e4.san == "e4!?"
      assert e5.nags == [1]
      nf3 = mainline(tree) |> Enum.find(&(&1.san == "Nf3"))
      assert nf3.comment == "developing"
    end
  end

  describe "comments" do
    test "brace comments, semicolon and percent comments" do
      tree =
        parse!("1. e4 {white starts} e5 ; semicolon comment\n2. Nf3 % percent comment\nNc6 *\n")

      e4 = mainline(tree) |> Enum.find(&(&1.san == "e4"))
      assert e4.comment == "white starts"
      e5 = mainline(tree) |> Enum.find(&(&1.san == "e5"))
      assert e5.comment == " semicolon comment"
      nf3 = mainline(tree) |> Enum.find(&(&1.san == "Nf3"))
      assert nf3.comment == " percent comment"
    end

    test "lichess clock comments extract into node.clock, not the comment" do
      tree = parse!("1. e4 { [%clk 0:05:00] } e5 { [%clk 0:04:56] } *\n")
      e4 = mainline(tree) |> Enum.find(&(&1.san == "e4"))
      assert e4.clock == 300
      assert e4.comment == nil
      e5 = mainline(tree) |> Enum.find(&(&1.san == "e5"))
      assert e5.clock == 296
      assert e5.comment == nil
    end

    test "clock extraction keeps the human text around the marker" do
      tree = parse!("1. e4 {[%clk 0:04:58] Sharp!} e5 {[%clk 0:04:55]} *\n")
      e4 = mainline(tree) |> Enum.find(&(&1.san == "e4"))
      assert e4.clock == 298
      assert e4.comment == "Sharp!"
    end

    test "fractional clock seconds survive extraction" do
      tree = parse!("1. e4 {[%clk 0:00:07.64]} e5 {[%clk 1:02:03]} *\n")
      e4 = mainline(tree) |> Enum.find(&(&1.san == "e4"))
      assert e4.clock == 7.64
      e5 = mainline(tree) |> Enum.find(&(&1.san == "e5"))
      assert e5.clock == 3723
    end

    test "a clock comment before its move token extracts too" do
      tree = parse!("1. {[%clk 0:05:12]} e4 e5 *\n")
      e4 = mainline(tree) |> Enum.find(&(&1.san == "e4"))
      assert e4.clock == 312
      assert e4.comment == nil
    end

    test "comments without clock markers are untouched" do
      tree = parse!("1. e4 {[%eval 0.3] plain text} e5 *\n")
      e4 = mainline(tree) |> Enum.find(&(&1.san == "e4"))
      assert e4.clock == nil
      assert e4.comment == "[%eval 0.3] plain text"
    end
  end

  describe "variations" do
    test "RAV as alternative to the continuation" do
      tree =
        parse!("""
        1. e4 (1... c5 2. Nf3) 1... e5 2. Nf3 *
        """)

      root_children = tree.root.children
      assert Enum.map(root_children, & &1.san) == ["e4"]
      [e4] = root_children
      assert Enum.map(e4.children, & &1.san) == ["e5", "c5"]
      [e5, c5] = e4.children
      assert Enum.map(c5.children, & &1.san) == ["Nf3"]
      assert e5.ply == 2
      assert c5.ply == 2
      assert c5.children |> hd() |> Map.get(:ply) == 3
    end

    test "RAV as alternative to the move itself" do
      tree = parse!("1. e4 (1. d4 d5) 1... e5 2. Nf3 *\n")
      assert Enum.map(tree.root.children, & &1.san) == ["e4", "d4"]
      [e4, d4] = tree.root.children
      assert Enum.map(d4.children, & &1.san) == ["d5"]
      assert Enum.map(e4.children, & &1.san) == ["e5"]
    end

    test "nested RAVs" do
      tree =
        parse!("""
        1. e4 (1... c5 (1... e5 2. Nf3) 2. Nf3) 1... e5 2. Nf3 Nc6 *
        """)

      [e4] = tree.root.children
      [e5, c5, e5_alt] = e4.children
      assert Enum.map(c5.children, & &1.san) == ["Nf3"]
      assert Enum.map(e5_alt.children, & &1.san) == ["Nf3"]
      assert e5.ply == 2
      assert c5.ply == 2
      assert e5_alt.ply == 2
      assert hd(c5.children).ply == 3
    end

    test "empty RAV is skipped" do
      tree = parse!("1. e4 () e5 *\n")
      assert Enum.map(tree.root.children, & &1.san) == ["e4"]
      assert Enum.map(hd(tree.root.children).children, & &1.san) == ["e5"]
    end

    test "multiple RAVs in a row" do
      tree = parse!("1. e4 (1... c5) (1... e6) 1... e5 *\n")
      [e4] = tree.root.children
      assert Enum.map(e4.children, & &1.san) == ["e5", "c5", "e6"]
    end
  end

  describe "null moves" do
    test "a pass is a real mainline node with null squares and flipped STM" do
      tree = parse!("1. e4 c5 -- a6 *\n")

      [e4] = tree.root.children
      [c5] = e4.children
      [pass] = c5.children
      [a6] = pass.children

      assert pass.san == "--"
      assert pass.from == nil and pass.to == nil
      assert pass.ply == 3
      # The pass flips white-to-black, so 3... a6 lands on ply 4 with the
      # same board as c5.
      assert a6.ply == 4
      assert a6.from == "a7" and a6.to == "a6"
      [board_before, _] = String.split(c5.fen, " ", parts: 2)
      [board_after, _] = String.split(pass.fen, " ", parts: 2)
      assert board_before == board_after
      assert String.contains?(pass.fen, " b ")
      assert String.contains?(a6.fen, " w ")
    end

    test "a black pass advances the fullmove only across itself" do
      tree = parse!("1. e4 e5 2... -- a6 *\n")

      [e4] = tree.root.children
      [e5] = e4.children
      [pass] = e5.children
      [a6] = pass.children
      assert a6.ply == 4
      assert String.contains?(a6.fen, " w ")
    end

    test "passes stack: -- Nc6 lets BLACK play immediately after the pass" do
      tree = parse!("1. e4 e5 -- Nc6 *\n")
      [e4] = tree.root.children
      [e5] = e4.children
      [p1] = e5.children
      [nc6] = p1.children
      assert nc6.san == "Nc6" and nc6.from == "b8" and nc6.to == "c6"
      # white passed, so the flipped pass-parent is black-to-move.
      assert String.contains?(p1.fen, " b ")
    end

    test "a pass inside a RAV resolves against the flipped parent game" do
      tree = parse!("1. e4 (1... c5 -- e6) 1... e5 *\n")
      [e4] = tree.root.children
      c5 = Enum.find(e4.children, &(&1.san == "c5"))
      assert c5
      [pass] = c5.children
      assert pass.san == "--"
      [e6] = pass.children
      assert e6.san == "e6" and e6.from == "e7" and e6.to == "e6"
    end
  end

  describe "setup" do
    test "starts from the FEN header" do
      tree =
        parse!("""
        [Setup "1"]
        [FEN "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1"]

        1. Ra8# 1-0
        """)

      assert tree.setup.fen =~ "6k1"
      [_, move] = mainline(tree)
      assert move.san == "Ra8#"
      assert move.status == :checkmate
    end

    test "missing FEN with Setup=1 is an error" do
      assert {:error, %{reason: :missing_fen}} = PGN.parse("[Setup \"1\"]\n\n1. e4 *\n")
    end

    test "garbage FEN is an error" do
      assert {:error, %{reason: :invalid_fen}} =
               PGN.parse("[Setup \"1\"]\n[FEN \"garbage\"]\n\n1. e4 *\n")
    end
  end

  describe "errors" do
    test "empty input" do
      assert {:error, %{reason: :no_moves}} = PGN.parse("")
      assert {:error, %{reason: :no_moves}} = PGN.parse("[Event \"x\"]\n")
    end

    test "unresolvable move reports san and ply" do
      assert {:error, %{reason: :no_move_found, san: "Qh4", ply: 1}} =
               PGN.parse("1. Qh4 e5 *\n")
    end

    test "illegal castling is reported" do
      assert {:error, %{reason: :illegal_castling, san: "O-O", ply: 1}} =
               PGN.parse("1. O-O *\n")
    end

    test "a bad SAN after valid moves is an error, never a crash" do
      assert {:error, %{reason: :invalid_san_format, san: "garbage", ply: 2}} =
               PGN.parse("1. e4 garbage\n")
    end

    test "a bad SAN deep in the game is an error, never a crash" do
      assert {:error, %{reason: :invalid_san_format, san: "garbage", ply: 6}} =
               PGN.parse("1. e4 e5 2. Nf3 Nc6 3. Bb5 garbage\n")
    end

    test "a bad SAN inside a variation is an error, never a crash" do
      assert {:error, %{reason: :invalid_san_format, san: "garbage"}} =
               PGN.parse("1. e4 e5 (2. garbage) 2. Nf3 *\n")
    end

    test "move count helpers" do
      tree =
        parse!("""
        1. e4 (1... c5 2. Nf3) 1... e5 2. Nf3 Nc6 3. Bb5 a6 *
        """)

      assert Tree.mainline_ply_count(tree) == 6
      assert Tree.node_count(tree) == 9
    end
  end

  describe "multi-game PGN" do
    test "two concatenated games parse into two trees" do
      assert {:ok, [g1, g2], []} =
               PGN.parse_many("""
               [Event "G1"]
               [Result "1-0"]

               1. e4 e5 2. Nf3 1-0

               [Event "G2"]
               [Result "0-1"]

               1. d4 d5 2. c4 0-1
               """)

      assert g1.headers["Event"] == "G1"
      assert g2.headers["Event"] == "G2"
      assert g1.result == "1-0"
      assert g2.result == "0-1"
    end

    test "a single game yields a one-element list" do
      assert {:ok, [_], []} = PGN.parse_many("1. e4 e5 2. Nf3 *\n")
    end

    test "a bracket inside a multiline comment does not start a game" do
      assert {:ok, [_, _], []} =
               PGN.parse_many("""
               1. e4 e5 {a comment
               [still the comment] 2. Nf3 Nc6 }

               [Event "Second"]

               1. d4 d5 *
               """)
    end

    test "a failing game is reported, the good games still parse" do
      assert {:ok, [g1], [%{index: 2, detail: %{reason: :invalid_san_format}}]} =
               PGN.parse_many("1. e4 e5 *\n\n[Event \"G2\"]\n\n1. d4 garbage *\n")

      assert g1.result == "*"
    end

    test "every failure is collected, in order" do
      assert {:ok, [], [%{index: 1}, %{index: 2}]} =
               PGN.parse_many("1. e4 garbage *\n\n[Event \"G2\"]\n\n1. d4 nonsense *\n")
    end

    test "a clean batch reports no failures" do
      assert {:ok, [_, _], []} =
               PGN.parse_many("""
               1. e4 e5 *

               [Event "G2"]

               1. d4 d5 *
               """)
    end
  end
end
