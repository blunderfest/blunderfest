# PGN Specification and Parsing

## Overview

PGN (Portable Game Notation) is the standard text format for chess games. Blunderfest supports full PGN parsing and generation with support for all standard and extended features.

## PGN File Structure

```
+------------------+
|  PGN File        |
|  +-----------+   |
|  |  Game 1   |   |
|  |  - Tags   |   |
|  |  - Moves  |   |
|  +-----------+   |
|  |  Game 2   |   |
|  |  ...      |   |
|  +-----------+   |
+------------------+
```

## Seven Tag Roster (STR)

Every PGN game should include these seven required tags:

```
[Event "F/S Return Match"]
[Site "Belgrade, Serbia JUG"]
[Date "1992.11.04"]
[Round "29"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1-0"]
```

### Tag Descriptions

| Tag | Description | Format |
|-----|-------------|--------|
| Event | Tournament or match name | String |
| Site | Location of event | City, Country |
| Date | Game date | YYYY.MM.DD or ????.??.?? |
| Round | Round number | Integer or M.N (match game) |
| White | White player name | Surname, Firstname |
| Black | Black player name | Surname, Firstname |
| Result | Game result | 1-0, 0-1, 1/2-1/2, * |

## Supplementary Tags

### Player Information

```
[WhiteElo "2785"]
[BlackElo "2750"]
[WhiteTitle "GM"]
[BlackTitle "GM"]
[WhiteFideId "123456"]
[BlackFideId "234567"]
[WhiteEco "B90"]
[BlackEco "B90"]
```

### Time Control

```
[TimeControl "40/7200:3600"]  # 40 moves in 2 hours, then 1 hour sudden death
[TimeControl "180+30"]         # 3 minutes + 30 second increment
[TimeControl "600"]            # 10 minutes sudden death
[TimeControl "-"]              # No time control
```

### Game Information

```
[ECO "B90"]                    # Encyclopaedia Chess Opens code
[Opening "Sicilian Defense"]
[Variation "Najdorf Variation"]
[SubVariation "English Attack"]
[PlyCount "87"]                # Total half-moves
[WhiteTeam "USA"]
[BlackTeam "Russia"]
[WhiteTeamDiscipline "Open"]
[BlackTeamDiscipline "Open"]
[Section "Open"]
[Board "1"]
[Annotator "Kasparov, Garry"]
[Mode "OTB"]                   # Over the board
[Termination "normal"]         # or "abandoned", "adjudication", etc.
```

## Move Text Format

### Standard Algebraic Notation (SAN)

```
1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 1-0
```

### Move Components

| Component | Example | Description |
|-----------|---------|-------------|
| Piece | N, B, R, Q, K | Knight, Bishop, Rook, Queen, King (pawn omitted) |
| Disambiguation | Nbd2, Rab1 | File or rank to disambiguate |
| Capture | exd5, Bxc6 | x indicates capture |
| Destination | e4, f3 | Target square |
| Promotion | a8=Q, e1=Q+ | =Piece for promotion |
| Check | Qh5+, Qh5# | + for check, # for checkmate |
| Castling | O-O, O-O-O | Kingside or queenside |

### Move Number Format

```
# Standard format
1. e4 c5 2. Nf3

# When black's move is first (continuation)
... c5 2. Nf3

# When only one side's moves shown
1. e4 2. Nf3 3. d4

# Comment after move number
1. e4 {best move} c5
```

## Annotations

### Numeric Annotation Glyphs (NAG)

```
$1  !    Good move
$2  ?    Mistake
$3  !!   Brilliant move
$4  ??   Blunder
$5  !?   Interesting move
$6  ?!   Dubious move
$7  □    Forced move
$8  Singular move
$9  Worst move
$10 =    Drawish position
$11 =    Equal chances
$13 ⊙    Unclear
$14 +=   White slightly better
$16 +−   White winning
$17 −+   Black winning
```

### Symbolic Annotations

```
{!}     Good move
{?}     Mistake
{!!}    Brilliant move
{??}    Blunder
{!?}    Interesting
{?!}    Dubious
{□}     Forced
```

### Comments

```
# Inline comments
1. e4 {This is the best opening move} c5

# Multi-line comments
1. e4 {
  This is a very important move that controls the center.
  It has been played in thousands of grandmaster games.
} c5

# Comments after moves
1. e4 c5 2. Nf3 (2. c3 is the c3 Sicilian) 2... d6
```

### Variations

```
# Main line with variation
1. e4 c5 2. Nf3 (2. c3 d5 3. exd5 Qxd5) 2... d6

# Nested variations
1. e4 c5 2. Nf3 d6 (2... Nc6 3. Bb5 (3. Nc3 g6) 3... Nd4) 3. d4

# Multiple variations
1. e4 (1. d4 Nf6 2. c4) (1. c4) 1... c5
```

## PGN Parser Implementation

### Lexer

```elixir
defmodule Blunderfest.Chess.PGN.Lexer do
  @moduledoc """
  PGN lexical analyzer - converts text to tokens.
  """
  
  @type token :: {atom(), any()}
  
  @spec tokenize(String.t()) :: [token()]
  def tokenize(pgn) do
    pgn
    |> String.graphemes()
    |> do_tokenize([], nil)
  end
  
  defp do_tokenize([], tokens, _state) do
    Enum.reverse([{:eof, nil} | tokens])
  end
  
  # Skip whitespace
  defp do_tokenize([char | rest], tokens, _state) when char in [" ", "\t", "\n", "\r"] do
    do_tokenize(rest, tokens, :normal)
  end
  
  # Tag
  defp do_tokenize(["[", char | rest], tokens, _state) when char >= "A", char <= "Z" do
    {tag_name, rest} = collect_until(rest, ~c"]")
    {tag_value, rest} = skip_whitespace(rest) |> collect_quoted_string()
    
    token = {:tag, {String.to_atom(tag_name), tag_value}}
    do_tokenize(rest, [token | tokens], :tag)
  end
  
  # Comment
  defp do_tokenize(["{", char | rest], tokens, _state) do
    {comment, rest} = collect_until(rest, ~c"}")
    token = {:comment, comment}
    do_tokenize(rest, [token | tokens], :comment)
  end
  
  # Variation start
  defp do_tokenize(["(", char | rest], tokens, _state) do
    do_tokenize(rest, [{:var_start, nil} | tokens], :variation)
  end
  
  # Variation end
  defp do_tokenize([")", char | rest], tokens, _state) do
    do_tokenize(rest, [{:var_end, nil} | tokens], :variation)
  end
  
  # Move number
  defp do_tokenize([digit | rest], tokens, _state) when digit >= "0", digit <= "9" do
    {number_str, rest} = collect_while(rest, fn c -> c in ~c"0123456789." end, digit)
    
    cond do
      String.ends_with?(number_str, ".") ->
        token = {:move_number, String.to_integer(String.trim_trailing(number_str, "."))}
        do_tokenize(rest, [token | tokens], :move)
        
      String.contains?(number_str, "-") ->
        token = {:result, number_str}
        do_tokenize(rest, [token | tokens], :result)
        
      true ->
        token = {:move_number, String.to_integer(number_str)}
        do_tokenize(rest, [token | tokens], :move)
    end
  end
  
  # Result
  defp do_tokenize(["1", "-", "0" | rest], tokens, _state) do
    do_tokenize(rest, [{:result, "1-0"} | tokens], :result)
  end
  
  defp do_tokenize(["0", "-", "1" | rest], tokens, _state) do
    do_tokenize(rest, [{:result, "0-1"} | tokens], :result)
  end
  
  defp do_tokenize(["1", "/", "2", "-", "1", "/", "2" | rest], tokens, _state) do
    do_tokenize(rest, [{:result, "1/2-1/2"} | tokens], :result)
  end
  
  defp do_tokenize(["*", char | rest], tokens, _state) do
    do_tokenize(rest, [{:result, "*"} | tokens], :result)
  end
  
  # NAG
  defp do_tokenize(["$", digit | rest], tokens, _state) when digit >= "0", digit <= "9" do
    {number_str, rest} = collect_while(rest, fn c -> c in ~c"0123456789" end, digit)
    token = {:nag, String.to_integer(number_str)}
    do_tokenize(rest, [token | tokens], :nag)
  end
  
  # Move (SAN)
  defp do_tokenize([char | rest], tokens, _state) when char in "KQRBNabcdefghOx+#=" do
    {move_str, rest} = collect_while(rest, fn c -> c in ~c"KQRBNabcdefghOx+#=0123456789" end, char)
    token = {:move, move_str}
    do_tokenize(rest, [token | tokens], :move)
  end
  
  # Catch-all for unknown characters
  defp do_tokenize([_char | rest], tokens, state) do
    do_tokenize(rest, tokens, state)
  end
  
  # Helper functions
  defp collect_until(chars, stop_char, acc \\ "")
  defp collect_until([char | rest], stop_char, acc) when char == stop_char do
    {acc, rest}
  end
  defp collect_until([char | rest], stop_char, acc) do
    collect_until(rest, stop_char, acc <> char)
  end
  defp collect_until([], _stop_char, acc), do: {acc, []}
  
  defp collect_while(chars, predicate, acc) do
    chars
    |> Enum.take_while(&(predicate.(&1)))
    |> then(fn collected ->
      remaining = Enum.drop(chars, length(collected))
      {acc <> Enum.join(collected), remaining}
    end)
  end
  
  defp collect_quoted_string(chars) do
    chars
    |> Enum.drop_while(&(&1 != "\""))
    |> Enum.drop(1)
    |> Enum.take_while(&(&1 != "\""))
    |> Enum.join()
    |> then(fn str ->
      remaining = chars |> Enum.drop(length(String.graphemes(str)) + 2)
      {str, remaining}
    end)
  end
  
  defp skip_whitespace(chars) do
    Enum.drop_while(chars, &(&1 in ~c" \t\n\r"))
  end
end
```

### Parser

```elixir
defmodule Blunderfest.Chess.PGN.Parser do
  @moduledoc """
  PGN parser - converts tokens to game structures.
  """
  
  alias Blunderfest.Chess.PGN.Lexer
  alias Blunderfest.Types.Game
  
  @spec parse(String.t()) :: [Game.t()]
  def parse(pgn_text) do
    pgn_text
    |> Lexer.tokenize()
    |> parse_games([])
  end
  
  defp parse_games([], games) do
    Enum.reverse(games)
  end
  
  defp parse_games([{:eof, _} | _], games) do
    Enum.reverse(games)
  end
  
  defp parse_games(tokens, games) do
    case parse_game(tokens) do
      {:ok, game, remaining} ->
        parse_games(remaining, [game | games])
        
      {:error, reason} ->
        # Skip to next game
        remaining = skip_to_next_game(tokens)
        parse_games(remaining, games)
    end
  end
  
  defp parse_game(tokens) do
    with {:ok, tags, remaining} <- parse_tags(tokens),
         {:ok, moves, remaining} <- parse_movetext(remaining) do
      game = %Game{
        tags: tags,
        moves: moves
      }
      {:ok, game, remaining}
    end
  end
  
  defp parse_tags(tokens, tags \\ %{})
  defp parse_tags([{:tag, {name, value}} | rest], tags) do
    parse_tags(rest, Map.put(tags, name, value))
  end
  defp parse_tags(tokens, tags) do
    {:ok, tags, tokens}
  end
  
  defp parse_movetext(tokens, moves \\ [], current_variation \\ [], variations \\ [])
  defp parse_movetext([{:result, result} | rest], moves, current_variation, variations) do
    all_moves = Enum.reverse(moves)
    all_variations = Enum.reverse(variations)
    {:ok, %{moves: all_moves, variations: all_variations, result: result}, rest}
  end
  
  defp parse_movetext([{:move_number, _} | rest], moves, current_variation, variations) do
    parse_movetext(rest, moves, current_variation, variations)
  end
  
  defp parse_movetext([{:move, move_san} | rest], moves, current_variation, variations) do
    parse_movetext(rest, [move_san | moves], current_variation, variations)
  end
  
  defp parse_movetext([{:var_start, _} | rest], moves, current_variation, variations) do
    case parse_variation(rest) do
      {:ok, variation, remaining} ->
        parse_movetext(remaining, moves, current_variation, [variation | variations])
        
      {:error, reason} ->
        {:error, reason}
    end
  end
  
  defp parse_movetext([{:comment, comment} | rest], moves, current_variation, variations) do
    # Attach comment to last move
    updated_moves = case moves do
      [] -> [{:comment, comment}]
      [last | rest_moves] -> [{:move, last, comment} | rest_moves]
    end
    parse_movetext(rest, updated_moves, current_variation, variations)
  end
  
  defp parse_movetext([{:nag, nag} | rest], moves, current_variation, variations) do
    # Attach NAG to last move
    updated_moves = case moves do
      [] -> [{:nag, nag}]
      [last | rest_moves] -> [{:move, last, nag} | rest_moves]
    end
    parse_movetext(rest, updated_moves, current_variation, variations)
  end
  
  defp parse_movetext([_token | rest], moves, current_variation, variations) do
    parse_movetext(rest, moves, current_variation, variations)
  end
  
  defp parse_movetext([], moves, _current_variation, variations) do
    {:ok, %{moves: Enum.reverse(moves), variations: Enum.reverse(variations)}, []}
  end
  
  defp parse_variation(tokens, moves \\ [])
  defp parse_variation([{:var_end, _} | rest], moves) do
    {:ok, Enum.reverse(moves), rest}
  end
  
  defp parse_variation([{:move, move_san} | rest], moves) do
    parse_variation(rest, [move_san | moves])
  end
  
  defp parse_variation([{:var_start, _} | rest], moves) do
    case parse_variation(rest) do
      {:ok, nested_variation, remaining} ->
        parse_variation(remaining, [%{moves: Enum.reverse(moves), nested: nested_variation}])
        
      {:error, reason} ->
        {:error, reason}
    end
  end
  
  defp parse_variation([_token | rest], moves) do
    parse_variation(rest, moves)
  end
  
  defp skip_to_next_game([{:tag, _} | _] = tokens) do
    tokens
  end
  defp skip_to_next_game([_ | rest]) do
    skip_to_next_game(rest)
  end
  defp skip_to_next_game([]) do
    []
  end
end
```

### PGN Generator

```elixir
defmodule Blunderfest.Chess.PGN.Generator do
  @moduledoc """
  Generate PGN text from game structures.
  """
  
  alias Blunderfest.Types.Game
  
  @spec generate(Game.t()) :: String.t()
  def generate(%Game{} = game) do
    tags_section = generate_tags(game.tags)
    moves_section = generate_movetext(game.moves, game.annotations)
    
    tags_section <> "\n" <> moves_section <> "\n\n"
  end
  
  defp generate_tags(tags) do
    # Seven Tag Roster first
    str_tags = ["Event", "Site", "Date", "Round", "White", "Black", "Result"]
    
    str_tags_section = Enum.reduce(str_tags, "", fn tag, acc ->
      case Map.get(tags, tag) do
        nil -> acc
        value -> acc <> "[#{tag} \"#{escape_string(value)}\"]\n"
      end
    end)
    
    # Other tags
    other_tags_section = tags
    |> Map.drop(str_tags)
    |> Enum.reduce("", fn {tag, value}, acc ->
      acc <> "[#{tag} \"#{escape_string(value)}\"]\n"
    end)
    
    str_tags_section <> other_tags_section
  end
  
  defp generate_movetext(moves, annotations) do
    move_strings = Enum.with_index(moves)
    |> Enum.map(fn {move, index} ->
      move_num = div(index, 2) + 1
      is_white = rem(index, 2) == 0
      
      prefix = if is_white do
        "#{move_num}. "
      else
        if index == 0, do: "#{move_num}... ", else: " "
      end
      
      annotation_str = case Map.get(annotations, index) do
        nil -> ""
        ann -> " {" <> ann <> "}"
      end
      
      prefix <> move <> annotation_str
    end)
    
    Enum.join(move_strings, " ")
  end
  
  defp escape_string(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end
end
```

## Edge Cases and Error Handling

### Malformed PGN

```elixir
defmodule Blunderfest.Chess.PGN.Validator do
  @moduledoc """
  Validate PGN structure and content.
  """
  
  @spec validate(String.t()) :: {:ok, [Game.t()]} | {:error, String.t()}
  def validate(pgn_text) do
    case Blunderfest.Chess.PGN.Parser.parse(pgn_text) do
      [] -> {:error, "No valid games found"}
      games -> {:ok, games}
    end
  end
  
  @spec validate_move(String.t(), Board.t()) :: :ok | {:error, String.t()}
  def validate_move(move_san, board) do
    case Blunderfest.Chess.Move.from_san(move_san, board) do
      {:ok, _move} -> :ok
      {:error, :illegal_move} -> {:error, "Illegal move: #{move_san}"}
      {:error, :ambiguous} -> {:error, "Ambiguous move: #{move_san}"}
      {:error, reason} -> {:error, "Invalid move #{move_san}: #{reason}"}
    end
  end
end
```

### Common PGN Issues

1. **Missing tags**: Use defaults or mark as unknown
2. **Invalid moves**: Skip or mark as error
3. **Incomplete games**: Mark result as "*"
4. **Encoding issues**: Handle UTF-8 and Latin-1
5. **Line endings**: Handle CRLF and LF

## Performance Considerations

### Streaming Parser

For large PGN files, use a streaming approach:

```elixir
defmodule Blunderfest.Chess.PGN.StreamParser do
  @moduledoc """
  Stream-based PGN parser for large files.
  """
  
  @spec parse_stream(File.io_device()) :: Enumerable.t()
  def parse_stream(io_device) do
    Stream.transform(
      fn -> :ok end,
      fn
        :ok, _acc ->
          case read_game(io_device) do
            {:ok, game} -> {[game], :ok}
            :eof -> {:halt, :eof}
            {:error, reason} -> {[{:error, reason}], :ok}
          end
      end,
      fn _acc -> :ok end
    )
  end
  
  defp read_game(io_device) do
    with {:ok, tags} <- read_tags(io_device),
         {:ok, moves} <- read_movetext(io_device) do
      {:ok, %Game{tags: tags, moves: moves}}
    end
  end
end
```

### Bulk Import

```elixir
defmodule Blunderfest.Chess.PGN.Importer do
  @moduledoc """
  High-performance PGN import with progress tracking.
  """
  
  @spec import_file(String.t(), Blunderfest.Database.t(), keyword()) :: 
    {:ok, imported :: non_neg_integer(), errors :: non_neg_integer()}
  def import_file(filename, db, opts \\ []) do
    on_progress = Keyword.get(opts, :on_progress, fn _, _ -> :ok end)
    batch_size = Keyword.get(opts, :batch_size, 1000)
    
    filename
    |> File.stream!([:read_ahead: 1024 * 1024])
    |> Stream.chunk_every(batch_size)
    |> Stream.with_index()
    |> Enum.reduce_while({0, 0}, fn {lines, idx}, {imported, errors} ->
      batch = lines |> Enum.join("\n") |> Parser.parse()
      
      {batch_imported, batch_errors} = Enum.reduce(batch, {0, 0}, fn game, {ok, err} ->
        case Blunderfest.Game.add(db, game) do
          {:ok, _id} -> {ok + 1, err}
          {:error, _reason} -> {ok, err + 1}
        end
      end)
      
      total_imported = imported + batch_imported
      total_errors = errors + batch_errors
      
      on_progress.(total_imported, total_errors)
      
      {:cont, {total_imported, total_errors}}
    end)
    |> then(fn {imported, errors} ->
      {:ok, imported, errors}
    end)
  end
end
```

## Testing

### Test Cases

```elixir
defmodule Blunderfest.Chess.PGNTest do
  use ExUnit.Case
  
  test "parse simple game" do
    pgn = """
    [Event "Test"]
    [White "Player1"]
    [Black "Player2"]
    [Result "1-0"]
    
    1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0
    """
    
    games = PGN.parse(pgn)
    assert length(games) == 1
    
    game = hd(games)
    assert game.tags["Event"] == "Test"
    assert game.tags["White"] == "Player1"
    assert game.tags["Result"] == "1-0"
    assert length(game.moves) == 6
  end
  
  test "parse game with variations" do
    pgn = """
    [Event "Test"]
    [White "Player1"]
    [Black "Player2"]
    [Result "*"]
    
    1. e4 (1. d4 d5) 1... e5 (1... c5) 2. Nf3 *
    """
    
    games = PGN.parse(pgn)
    game = hd(games)
    assert length(game.variations) == 2
  end
  
  test "parse game with annotations" do
    pgn = """
    [Event "Test"]
    
    1. e4 {Best move} c5 2. Nf3 $1 d6 1-0
    """
    
    games = PGN.parse(pgn)
    game = hd(games)
    assert game.annotations[0] == "Best move"
    assert game.nags[1] == 1
  end
  
  test "generate PGN" do
    game = %Game{
      tags: %{"Event" => "Test", "White" => "A", "Black" => "B", "Result" => "1-0"},
      moves: ["e4", "e5", "Nf3", "Nc6"]
    }
    
    pgn = PGN.generate(game)
    assert String.contains?(pgn, "[Event \"Test\"]")
    assert String.contains?(pgn, "1. e4 e5 2. Nf3 Nc6 1-0")
  end
end