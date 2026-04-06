# Opening Classification System

## Overview

Blunderfest implements a two-tier opening classification system:

1. **Standard ECO Codes** - The traditional Encyclopaedia Chess Opens system (A00-E99)
2. **Granular Classification** - Extended system for precise opening identification

## ECO Code System

### ECO Categories

```
A00-A99: Flank Openings
  A00-A09: Irregular openings (1. a3, 1. b3, 1. g3, etc.)
  A10-A39: English Opening (1. c4)
  A40-A44: Queen's Pawn Game (1. d4 without 1...d5)
  A45-A49: Queen's Pawn Game (1. d4 Nf6)
  A50-A79: Benoni and Benko systems
  A80-A99: Dutch Defense (1. d4 f5)

B00-B99: Semi-Open Games (1. e4 without 1...e5)
  B00-B19: King's Pawn openings (1. e4 non-e5)
  B20-B99: Sicilian Defense (1. e4 c5)

C00-C99: Open Games and French Defense
  C00-C19: French Defense (1. e4 e6)
  C20-C99: Open Games (1. e4 e5)

D00-D99: Closed Games and Indian Defenses
  D00-D09: Queen's Pawn Game (1. d4 d5)
  D10-D99: Queen's Gambit and Slav systems

E00-E99: Indian Defenses
  E00-E09: Catalan and Queen's Indian
  E10-E69: Queen's Pawn Indian systems
  E70-E99: King's Indian and Nimzo-Indian
```

### ECO Code Structure

```
Code Format: [Letter][Two Digits]

Examples:
- A00: Polish Opening (1. b4)
- B90: Sicilian Defense, Najdorf Variation
- C42: Petrov Defense
- D85: Grünfeld Defense, Exchange Variation
- E97: King's Indian Defense, Orthodox Variation
```

## Granular Classification System

### Extended Code Format

```
ECO.SubVariation.Line.Move

Example: B90.01.03.07
  B90     = Sicilian Defense, Najdorf Variation
  .01     = Main line after 6.Be3
  .03     = English Attack setup
  .07     = Specific continuation after 7.f3 b5 8.g4
```

### Classification Tree

```
Root: 1. e4
├── 1... e5 (Open Games, C20-C99)
│   ├── 2. Nf3 Nc6 (C44-C99)
│   │   ├── 3. Bb5 (C60-C99) - Ruy Lopez
│   │   │   ├── 3... a6 (C70-C99) - Morphy Defense
│   │   │   │   ├── 4. Ba4 Nf6 5. O-O (C80-C99)
│   │   │   │   │   ├── 5... Nxe4 (C80-C83) - Open Defense
│   │   │   │   │   └── 5... Be7 (C84-C99) - Closed Defense
│   │   │   │   │       ├── 6. c3 O-O 7. d4 (C90-C99)
│   │   │   │   │       │   ├── 7... Re8 8. d5 (C92-C93)
│   │   │   │   │       │   └── 7... Bf8 (C94-C99)
│   │   │   │   └── 4. Bxc6 (C60-C69) - Exchange Variation
│   │   ├── 3. d4 exd4 4. Nxd4 (C44-C49) - Scotch Game
│   │   └── 3. Bc4 (C50-C59) - Italian Game
│   └── 2. f4 (C30-C39) - King's Gambit
├── 1... c5 (Sicilian Defense, B20-B99)
│   ├── 2. Nf3 (B20-B99)
│   │   ├── 2... d6 (B50-B99)
│   │   │   ├── 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 (B80-B99)
│   │   │   │   ├── 5... a6 (B90-B99) - Najdorf
│   │   │   │   │   ├── 6. Bg5 (B91-B92)
│   │   │   │   │   ├── 6. Be3 (B90) - Main line
│   │   │   │   │   └── 6. f3 (B90) - Prins Attack
│   │   │   │   └── 5... Nc6 (B80-B89) - Classical
│   │   │   └── 3. Bb5+ (B50-B59) - Moscow Variation
│   │   └── 2... Nc6 (B30-B39) - Old Sicilian
│   └── 2. c3 (B20-B29) - Alapin Variation
└── 1... e6 (French Defense, C00-C19)
    ├── 2. d4 d5 (C00-C19)
    │   ├── 3. Nc3 (C10-C14) - Classical
    │   ├── 3. Nd2 (C00-C09) - Tarrasch
    │   └── 3. exd5 (C00-C09) - Exchange
    └── 2. d3 (C00-C09) - King's Indian Attack
```

## Implementation

### Opening Classifier

```elixir
defmodule Blunderfest.Analysis.Opening do
  @moduledoc """
  Opening classification based on move sequences.
  """
  
  alias Blunderfest.Chess.Board
  alias Blunderfest.Chess.Move
  
  @eco_database build_eco_database()
  
  @type eco_code :: <<_::24>>  # 3 bytes: letter + 2 digits
  @type classification :: %{
    eco: eco_code(),
    name: String.t(),
    detailed_code: String.t() | nil,
    moves: [String.t()],
    position_hash: integer()
  }
  
  @doc """
  Classify a game's opening based on move sequence.
  """
  @spec classify([String.t()]) :: classification()
  def classify(moves) do
    moves
    |> build_position_tree()
    |> find_best_match()
    |> build_classification()
  end
  
  @doc """
  Classify position by Zobrist hash.
  """
  @spec classify_by_hash(integer()) :: classification() | nil
  def classify_by_hash(hash) do
    case :ets.lookup(:opening_index, hash) do
      [{^hash, classification}] -> classification
      [] -> nil
    end
  end
  
  defp build_position_tree(moves) do
    board = Board.initial()
    
    Enum.reduce_while(moves, %{board: board, moves: []}, fn move_san, acc ->
      case Move.from_san(move_san, acc.board) do
        {:ok, move} ->
          new_board = Board.apply_move(acc.board, move)
          {:cont, %{board: new_board, moves: [move_san | acc.moves]}}
          
        {:error, _} ->
          {:halt, acc}
      end
    end)
  end
  
  defp find_best_match(tree) do
    # Walk the ECO tree to find the most specific match
    do_find_match(tree.moves, @eco_database, nil)
  end
  
  defp do_find_match([], _node, best_match) do
    best_match
  end
  
  defp do_find_match([move | rest], node, best_match) do
    case Map.get(node, move) do
      nil -> best_match
      child_node ->
        new_best = case Map.get(child_node, :eco) do
          nil -> best_match
          eco -> %{eco: eco, name: Map.get(child_node, :name, ""), moves: Enum.reverse([move | rest])}
        end
        do_find_match(rest, child_node, new_best)
    end
  end
  
  defp build_eco_database do
    # Build from ECO data file
    "priv/eco_codes.json"
    |> File.read!()
    |> Jason.decode!()
    |> build_tree()
  end
  
  defp build_tree(eco_data) do
    Enum.reduce(eco_data, %{}, fn entry, acc ->
      moves = entry["moves"]
      eco = entry["code"]
      name = entry["name"]
      
      put_in(acc, Enum.map(moves, &String.to_atom/1) ++ [:eco], eco)
      put_in(acc, Enum.map(moves, &String.to_atom/1) ++ [:name], name)
    end)
  end
end
```

### ECO Database Format

```json
[
  {
    "code": "B90",
    "name": "Sicilian Defense: Najdorf Variation",
    "moves": ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
    "parent": "B20",
    "variations": ["B91", "B92", "B93", "B94", "B95", "B96", "B97", "B98", "B99"]
  },
  {
    "code": "C42",
    "name": "Petrov Defense",
    "moves": ["e4", "e5", "Nf3", "Nf6"],
    "parent": "C40",
    "variations": ["C43", "C44"]
  }
]
```

### Granular Classification

```elixir
defmodule Blunderfest.Analysis.Opening.Granular do
  @moduledoc """
  Extended opening classification beyond ECO codes.
  """
  
  @doc """
  Generate granular classification code.
  """
  def generate_granular_code(eco, moves, db) do
    base_code = eco
    
    # Find variation number
    variation = find_variation(eco, moves, db)
    
    # Find line number within variation
    line = find_line(eco, variation, moves, db)
    
    # Find move number within line
    move_num = find_move_number(eco, variation, line, moves, db)
    
    case {variation, line, move_num} do
      {nil, nil, nil} -> base_code
      {v, nil, nil} -> "#{base_code}.#{pad(v)}"
      {v, l, nil} -> "#{base_code}.#{pad(v)}.#{pad(l)}"
      {v, l, m} -> "#{base_code}.#{pad(v)}.#{pad(l)}.#{pad(m)}"
    end
  end
  
  defp pad(nil), do: nil
  defp pad(n) when n < 10, do: "0#{n}"
  defp pad(n), do: "#{n}"
  
  defp find_variation(eco, moves, db) do
    # Query database for variation statistics
    case db do
      %{variations: variations} ->
        variations
        |> Enum.filter(fn v -> v.parent_eco == eco end)
        |> Enum.find_index(fn v -> matches_variation?(v, moves) end)
        |> then(fn idx -> if idx, do: idx + 1, else: nil end)
        
      _ -> nil
    end
  end
  
  defp matches_variation?(variation, moves) do
    variation_moves = variation.key_moves
    Enum.take(moves, length(variation_moves)) == variation_moves
  end
end
```

### Opening Statistics

```elixir
defmodule Blunderfest.Analysis.Opening.Stats do
  @moduledoc """
  Statistics for openings.
  """
  
  @type opening_stats :: %{
    eco: String.t(),
    name: String.t(),
    total_games: non_neg_integer(),
    white_wins: non_neg_integer(),
    black_wins: non_neg_integer(),
    draws: non_neg_integer(),
    white_win_rate: float(),
    black_win_rate: float(),
    draw_rate: float(),
    avg_elo: float() | nil,
    popularity_rank: non_neg_integer() | nil,
    top_players: [player_stat()],
    recent_trend: trend()
  }
  
  @type player_stat :: %{
    player: String.t(),
    games: non_neg_integer(),
    wins: non_neg_integer(),
    win_rate: float()
  }
  
  @type trend :: %{
    direction: :rising | :falling | :stable,
    change_percent: float()
  }
  
  @spec calculate_stats(String.t(), Blunderfest.Database.t()) :: opening_stats()
  def calculate_stats(eco, db) do
    games = Blunderfest.Search.games(db, eco: [eco])
    
    total = length(games)
    white_wins = Enum.count(games, &(&1.result == :white_wins))
    black_wins = Enum.count(games, &(&1.result == :black_wins))
    draws = total - white_wins - black_wins
    
    %{
      eco: eco,
      name: get_opening_name(eco),
      total_games: total,
      white_wins: white_wins,
      black_wins: black_wins,
      draws: draws,
      white_win_rate: safe_div(white_wins, total),
      black_win_rate: safe_div(black_wins, total),
      draw_rate: safe_div(draws, total),
      avg_elo: calculate_avg_elo(games),
      popularity_rank: calculate_popularity_rank(eco, db),
      top_players: get_top_players(eco, games),
      recent_trend: calculate_trend(eco, games)
    }
  end
  
  defp safe_div(_num, 0), do: 0.0
  defp safe_div(num, denom), do: num / denom
  
  defp calculate_avg_elo(games) do
    elos = games
    |> Enum.flat_map(&[&1.white_elo, &1.black_elo])
    |> Enum.reject(&is_nil/1)
    
    case elos do
      [] -> nil
      _ -> Enum.sum(elos) / length(elos)
    end
  end
  
  defp calculate_trend(eco, games) do
    # Compare recent 6 months vs previous 6 months
    now = Date.utc_today()
    six_months_ago = Date.add(now, -180)
    year_ago = Date.add(now, -365)
    
    recent = Enum.count(games, &(Date.compare(&1.date, six_months_ago) == :gt))
    previous = Enum.count(games, fn g -> 
      Date.compare(g.date, six_months_ago) != :gt and 
      Date.compare(g.date, year_ago) != :lt
    end)
    
    change = if previous > 0, do: (recent - previous) / previous * 100, else: 0
    
    direction = cond do
      change > 10 -> :rising
      change < -10 -> :falling
      true -> :stable
    end
    
    %{direction: direction, change_percent: change}
  end
end
```

## Opening Tree Explorer

### Tree Structure

```elixir
defmodule Blunderfest.Analysis.Opening.Tree do
  @moduledoc """
  Opening tree for exploration.
  """
  
  defstruct [:eco, :name, :position, :children, :stats]
  
  @type t :: %__MODULE__{
    eco: String.t(),
    name: String.t(),
    position: position_node(),
    children: [move_node()],
    stats: map()
  }
  
  @type position_node :: %{
    fen: String.t(),
    hash: integer(),
    stats: position_stats()
  }
  
  @type move_node :: %{
    move: String.t(),
    count: non_neg_integer(),
    position: position_node(),
    children: [move_node()] | nil
  }
  
  @type position_stats :: %{
    game_count: non_neg_integer(),
    white_wins: non_neg_integer(),
    black_wins: non_neg_integer(),
    draws: non_neg_integer()
  }
  
  @spec build_tree(String.t(), Blunderfest.Database.t(), keyword()) :: t()
  def build_tree(eco, db, opts \\ []) do
    max_depth = Keyword.get(opts, :max_depth, 10)
    min_count = Keyword.get(opts, :min_count, 10)
    
    # Get key position for this ECO
    key_position = get_eco_key_position(eco)
    
    # Build tree from database
    root = %__MODULE__{
      eco: eco,
      name: get_eco_name(eco),
      position: build_position_node(key_position, db),
      children: build_children(key_position, db, max_depth, min_count),
      stats: calculate_tree_stats(eco, db)
    }
    
    root
  end
  
  defp build_position_node(position, db) do
    stats = Blunderfest.Position.stats(db, position.fen)
    
    %{
      fen: position.fen,
      hash: position.hash,
      stats: stats
    }
  end
  
  defp build_children(position, db, max_depth, min_count) do
    if max_depth <= 0 do
      []
    else
      position
      |> get_legal_moves()
      |> Enum.map(fn move ->
        new_position = apply_move(position, move)
        count = count_games_with_position(db, new_position)
        
        if count >= min_count do
          %{
            move: move,
            count: count,
            position: build_position_node(new_position, db),
            children: build_children(new_position, db, max_depth - 1, min_count)
          }
        end
      end)
      |> Enum.reject(&is_nil/1)
      |> Enum.sort_by(& &1.count, :desc)
      |> Enum.take(20)  # Limit branching factor
    end
  end
end
```

## Testing

```elixir
defmodule Blunderfest.Analysis.OpeningTest do
  use ExUnit.Case
  
  test "classify Sicilian Najdorf" do
    moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]
    
    result = Opening.classify(moves)
    
    assert result.eco == "B90"
    assert result.name == "Sicilian Defense: Najdorf Variation"
  end
  
  test "classify Ruy Lopez" do
    moves = ["e4", "e5", "Nf3", "Nc6", "Bb5"]
    
    result = Opening.classify(moves)
    
    assert result.eco == "C60"
    assert result.name == "Ruy Lopez"
  end
  
  test "granular classification" do
    moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", 
             "Be3", "e5", "NB3", "Be7", "f3", "b5", "g4"]
    
    result = Granular.generate_granular_code("B90", moves, db)
    
    # Should produce something like B90.01.03.07
    assert String.starts_with?(result, "B90.")
    assert String.contains?(result, ".")
  end
  
  test "opening statistics" do
    stats = Stats.calculate_stats("B90", db)
    
    assert stats.eco == "B90"
    assert stats.total_games > 0
    assert stats.white_win_rate >= 0 and stats.white_win_rate <= 1
  end
end
```

## ECO Code Reference

### Complete ECO List (Sample)

```
A00 - Polish Opening (1. b4)
A01 - Nimzo-Larsen Attack (1. b3)
A02 - Bird's Opening (1. f4)
A03 - Bird's Opening (1. f4 d5)
A04 - Reti Opening (1. Nf3)
A05 - Reti Opening (1. Nf3 Nf6)
A06 - Reti Opening (1. Nf3 d5)
A07 - King's Indian Attack (1. Nf3 d5 2. g3)
A08 - King's Indian Attack (1. Nf3 d5 2. g3 Nc6 3. Bg2 e5)
A09 - Reti Opening (1. Nf3 d5 2. c4)
...
B20 - Sicilian Defense (1. e4 c5)
B21 - Sicilian Defense (1. e4 c5 2. f4)
B22 - Sicilian Defense (1. e4 c5 2. c3) - Alapin
...
B90 - Sicilian Defense: Najdorf (1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6)
B91 - Sicilian Defense: Najdorf, Zagreb (Fianchetto) Variation (6. g3)
B92 - Sicilian Defense: Najdorf, Opocensky Variation (6. Be2)
B93 - Sicilian Defense: Najdorf, 6.f4 Variation
B94 - Sicilian Defense: Najdorf, 6.Bg5 Variation
B95 - Sicilian Defense: Najdorf, 6.Bg5 e6
B96 - Sicilian Defense: Najdorf, 6.Bg5 e6 7. f4
B97 - Sicilian Defense: Najdorf, 7... Qb6 Variation
B98 - Sicilian Defense: Najdorf, 7... Be7 Variation
B99 - Sicilian Defense: Najdorf, 6.Bg5 e6 7. f4 Be7 Main line
...
C00 - French Defense (1. e4 e6)
C01 - French Defense: Exchange Variation (2. d4 d5 3. exd5)
...
C40 - King's Pawn Opening (1. e4 e5 2. Nf3)
C41 - Philidor Defense (1. e4 e5 2. Nf3 d6)
C42 - Petrov Defense (1. e4 e5 2. Nf3 Nf6)
...
C50 - Italian Game (1. e4 e5 2. Nf3 Nc6 3. Bc4)
C51 - Italian Game: Evans Gambit (4. b4)
...
C60 - Ruy Lopez (1. e4 e5 2. Nf3 Nc6 3. Bb5)
C61 - Ruy Lopez: Bird's Defense (3... Nd4)
C62 - Ruy Lopez: Steinitz Defense (3... d6)
...
C80 - Ruy Lopez: Open Defense (5... Nxe4)
C84 - Ruy Lopez: Closed Defense (5... Be7 6. c3)
C90 - Ruy Lopez: Closed, 6... Re8 7. d4 (Main line)
C92 - Ruy Lopez: Closed, 7... Re8 8. d5
C95 - Ruy Lopez: Closed, Breyer Variation (9... Nb8)
...
D00 - Queen's Pawn Game (1. d4 d5)
D01 - Richter-Veresov Attack (1. d4 d5 2. Nc3 Nf6 3. Bg5)
D02 - Queen's Pawn Game (1. d4 d5 2. Nf3)
...
D30 - Queen's Gambit Declined (1. d4 d5 2. c4 e6)
D31 - Queen's Gambit Declined, Semi-Tarrasch (3. Nc3 c6)
D32 - Queen's Gambit Declined, Tarrasch (3. Nc3 c5)
...
D85 - Grünfeld Defense (1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5)
D86 - Grünfeld Defense, Exchange, 5. e4
D87 - Grünfeld Defense, Exchange, 6. Be3
...
E00 - Indian Game (1. d4 Nf6 2. c4 e6)
E01 - Catalan Opening (1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2)
...
E60 - King's Indian Defense (1. d4 Nf6 2. c4 g6)
E61 - King's Indian Defense, 3. Nc3 Bg7
E62 - King's Indian Defense, Fianchetto Variation (3. Nf3 Bg7 4. g3)
...
E70 - King's Indian Defense, Normal Variation (4. e4)
E71 - King's Indian Defense, Makogonov Variation (5. h3)
E72 - King's Indian Defense with e4 and g3
...
E97 - King's Indian Defense, Orthodox, Aronin-Taimanov (6... O-O 7. Be2 e5 8. O-O Nc6)
E99 - King's Indian Defense, Orthodox, Gligoric System (9. d5 Ne8)