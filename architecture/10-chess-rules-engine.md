# Chess Rules Engine Specification

## Overview

The chess rules engine handles all chess logic including move generation, legality checking, and game state management.

## Design Choices

### Board Representation

**Choice: 0x88 Square Mapping vs. 64-square Array**

We'll use a **64-square array** representation for simplicity and memory efficiency:

```elixir
# Square mapping (0-63)
# Rank 8: 56-63 (a8=56, b8=57, ..., h8=63)
# Rank 7: 48-55
# ...
# Rank 1: 0-7 (a1=0, b1=1, ..., h1=7)

defmodule Blunderfest.Chess.Board do
  @type square :: 0..63
  @type piece :: :pawn | :knight | :bishop | :rook | :queen | :king
  @type color :: :white | :black
  
  defstruct [
    :pieces,           # Map: square -> {color, piece}
    :side_to_move,     # :white | :black
    :castling_rights,  # Map: color -> [:king_side, :queen_side]
    :en_passant,       # square | nil
    :halfmove_clock,   # Moves since last capture/pawn move
    :fullmove_number   # Game move number
  ]
end
```

**Rationale**: 64-square array is simpler to implement and debug, with minimal performance impact for a database engine (vs. a real-time chess engine).

### Move Representation

```elixir
defmodule Blunderfest.Chess.Move do
  @type t :: %__MODULE__{
    from: square(),
    to: square(),
    piece: piece(),
    captured: piece() | nil,
    promotion: piece() | nil,
    flags: [:check | :double_check | :castling | :en_passant | :promotion],
    san: String.t()
  }
  
  defstruct [:from, :to, :piece, :captured, :promotion, :flags, :san]
end
```

## Move Generation

### Attack Tables

Pre-computed attack tables for sliding pieces:

```elixir
defmodule Blunderfest.Chess.Attacks do
  @moduledoc """
  Pre-computed attack tables for efficient move generation.
  """
  
  # Knight attacks from each square
  @knight_attacks generate_knight_attacks()
  
  # King attacks from each square
  @king_attacks generate_king_attacks()
  
  # Bishop attack masks (indexed by square and obstruction)
  @bishop_masks generate_bishop_masks()
  
  # Rook attack masks (indexed by square and obstruction)
  @rook_masks generate_rook_masks()
  
  # Pawn attack masks
  @pawn_attacks %{
    white: generate_pawn_attacks(:white),
    black: generate_pawn_attacks(:black)
  }
  
  def generate_knight_attacks do
    for square <- 0..63 do
      attacks = get_knight_attacks(square)
      Enum.reduce(attacks, 0, fn sq, acc -> acc ||| (1 <<< sq) end)
    end
  end
  
  defp get_knight_attacks(square) do
    rank = div(square, 8)
    file = rem(square, 8)
    
    [
      {rank - 2, file - 1}, {rank - 2, file + 1},
      {rank - 1, file - 2}, {rank - 1, file + 2},
      {rank + 1, file - 2}, {rank + 1, file + 2},
      {rank + 2, file - 1}, {rank + 2, file + 1}
    ]
    |> Enum.filter(fn {r, f} -> r in 0..7 and f in 0..7 end)
    |> Enum.map(fn {r, f} -> r * 8 + f end)
  end
  
  # Similar implementations for other pieces...
end
```

### Move Generator

```elixir
defmodule Blunderfest.Chess.MoveGenerator do
  @moduledoc """
  Generate all legal moves for a position.
  """
  
  @spec generate_moves(Board.t()) :: [Move.t()]
  def generate_moves(%Board{} = board) do
    board
    |> generate_pseudo_legal_moves()
    |> Enum.filter(&is_legal?(&1, board))
  end
  
  @spec generate_pseudo_legal_moves(Board.t()) :: [Move.t()]
  def generate_pseudo_legal_moves(board) do
    moves = for {square, {color, piece}} <- board.pieces,
                color == board.side_to_move,
                move <- generate_piece_moves(board, square, piece),
                do: move
    
    # Add castling moves
    castling_moves = generate_castling_moves(board)
    
    moves ++ castling_moves
  end
  
  defp generate_piece_moves(board, square, {color, piece}) do
    case piece do
      :pawn -> generate_pawn_moves(board, square, color)
      :knight -> generate_knight_moves(board, square, color)
      :bishop -> generate_bishop_moves(board, square, color)
      :rook -> generate_rook_moves(board, square, color)
      :queen -> generate_queen_moves(board, square, color)
      :king -> generate_king_moves(board, square, color)
    end
  end
  
  defp generate_pawn_moves(board, square, color) do
    rank = div(square, 8)
    file = rem(square, 8)
    
    direction = if color == :white, do: 1, else: -1
    start_rank = if color == :white, do: 1, else: 6
    promo_rank = if color == :white, do: 7, else: 0
    
    moves = []
    
    # Single push
    forward = square + direction * 8
    if valid_square?(forward) and not Map.has_key?(board.pieces, forward) do
      if div(forward, 8) == promo_rank do
        moves = moves ++ generate_promotions(board, square, forward, color)
      else
        moves = moves ++ [create_move(board, square, forward, color, :pawn)]
        
        # Double push from starting rank
        if rank == start_rank do
          double_forward = forward + direction * 8
          if not Map.has_key?(board.pieces, double_forward) do
            moves = moves ++ [create_move(board, square, double_forward, color, :pawn)]
          end
        end
      end
    end
    
    # Captures
    for capture_file <- [file - 1, file + 1],
        capture_file in 0..7 do
      capture_square = square + direction * 8 + (capture_file - file)
      
      cond do
        Map.has_key?(board.pieces, capture_square) and 
        elem(board.pieces[capture_square], 0) != color ->
          [create_move(board, square, capture_square, color, :pawn, 
            promotion: div(capture_square, 8) == promo_rank)]
          
        capture_square == board.en_passant ->
          [create_move(board, square, capture_square, color, :pawn, 
            flags: [:en_passant])]
          
        true -> []
      end
    end
    |> List.flatten()
    
    moves
  end
  
  defp is_legal?(move, board) do
    # Apply move temporarily
    new_board = apply_move(board, move)
    
    # Check if our king is in check
    not is_in_check?(new_board, board.side_to_move)
  end
  
  defp is_in_check?(board, color) do
    king_square = find_king(board, color)
    opponent = if color == :white, do: :black, else: :white
    
    # Check if any opponent piece attacks the king
    Enum.any?(board.pieces, fn {square, {piece_color, piece}} ->
      piece_color == opponent and
      attacks_square?(board, square, piece, king_square)
    end)
  end
end
```

## Game State Management

### Position Repetition Detection

```elixir
defmodule Blunderfest.Chess.Repetition do
  @moduledoc """
  Track position repetitions for threefold repetition rule.
  """
  
  defstruct [:positions, :current_key]
  
  @type t :: %__MODULE__{
    positions: %{integer() => non_neg_integer()},
    current_key: integer()
  }
  
  def new do
    %__MODULE__{
      positions: %{},
      current_key: 0
    }
  end
  
  def update(repetition, board) do
    key = Blunderfest.Chess.Zobrist.hash(board)
    count = Map.get(repetition.positions, key, 0) + 1
    
    %__MODULE__{
      positions: Map.put(repetition.positions, key, count),
      current_key: key
    }
  end
  
  def is_repeated?(repetition) do
    Map.get(repetition.positions, repetition.current_key, 0) >= 3
  end
end
```

### Fifty-Move Rule

```elixir
defmodule Blunderfest.Chess.FiftyMoveRule do
  @moduledoc """
  Track fifty-move rule counter.
  """
  
  def check(board) do
    if board.halfmove_clock >= 100 do  # 100 half-moves = 50 full moves
      :draw
    else
      :continue
    end
  end
end
```

### Insufficient Material Detection

```elixir
defmodule Blunderfest.Chess.InsufficientMaterial do
  @moduledoc """
  Detect insufficient material for checkmate.
  """
  
  def check(board) do
    pieces = get_all_pieces(board)
    
    cond do
      # K vs K
      pieces == [:king, :king] -> :draw
      
      # K+B vs K or K+N vs K
      Enum.sort(pieces) in [[:bishop, :king, :king], [:knight, :king, :king]] -> :draw
      
      # K+B vs K+B (same color bishops)
      has_same_color_bishops?(board) -> :draw
      
      true -> :continue
    end
  end
  
  defp get_all_pieces(board) do
    board.pieces
    |> Map.values()
    |> Enum.map(&elem(&1, 1))
  end
  
  defp has_same_color_bishops?(board) do
    bishops = board.pieces
    |> Enum.filter(fn {_sq, {_, piece}} -> piece == :bishop end)
    |> Enum.map(fn {sq, _} -> 
      color = if rem(div(sq, 8) + rem(sq, 8), 2) == 0, do: :light, else: :dark
      color
    end)
    |> Enum.uniq()
    
    length(bishops) == 2 and length(Enum.uniq(bishops)) == 1
  end
end
```

## FEN and PGN Integration

### FEN Parser/Generator

```elixir
defmodule Blunderfest.Chess.FEN do
  @moduledoc """
  FEN (Forsyth-Edwards Notation) parsing and generation.
  """
  
  @spec parse(String.t()) :: {:ok, Board.t()} | {:error, String.t()}
  def parse(fen) do
    parts = String.split(fen, " ")
    
    with {:ok, pieces} <- parse_piece_placement(parts[0]),
         {:ok, side_to_move} <- parse_side_to_move(parts[1]),
         {:ok, castling} <- parse_castling(parts[2]),
         {:ok, en_passant} <- parse_en_passant(parts[3]),
         halfmove_clock <- parse_number(parts[4]),
         fullmove_number <- parse_number(parts[5]) do
      {:ok, %Board{
        pieces: pieces,
        side_to_move: side_to_move,
        castling_rights: castling,
        en_passant: en_passant,
        halfmove_clock: halfmove_clock,
        fullmove_number: fullmove_number
      }}
    end
  end
  
  @spec generate(Board.t()) :: String.t()
  def generate(board) do
    piece_placement = generate_piece_placement(board)
    side_to_move = if board.side_to_move == :white, do: "w", else: "b"
    castling = generate_castling(board)
    en_passant = case board.en_passant do
      nil -> "-"
      sq -> square_to_algebraic(sq)
    end
    
    "#{piece_placement} #{side_to_move} #{castling} #{en_passant} #{board.halfmove_clock} #{board.fullmove_number}"
  end
  
  defp parse_piece_placement(part) do
    ranks = String.split(part, "/")
    
    if length(ranks) != 8 do
      {:error, "Invalid piece placement: expected 8 ranks"}
    else
      pieces = ranks
      |> Enum.with_index()
      |> Enum.flat_map(fn {rank_str, rank_idx} ->
        parse_rank(rank_str, rank_idx)
      end)
      |> Enum.into(%{})
      
      {:ok, pieces}
    end
  end
  
  defp parse_rank(rank_str, rank_idx) do
    rank_idx = 7 - rank_idx  # FEN starts from rank 8
    
    rank_str
    |> String.graphemes()
    |> Enum.reduce({[], 0}, fn char, {pieces, file} ->
      case char do
        n when n in ~w(1 2 3 4 5 6 7 8) ->
          {pieces, file + String.to_integer(n)}
        piece_char ->
          {color, piece} = parse_piece_char(piece_char)
          square = rank_idx * 8 + file
          {[{square, {color, piece}} | pieces], file + 1}
      end
    end)
    |> elem(0)
  end
  
  defp parse_piece_char(char) do
    case char do
      "K" -> {:white, :king}
      "Q" -> {:white, :queen}
      "R" -> {:white, :rook}
      "B" -> {:white, :bishop}
      "N" -> {:white, :knight}
      "P" -> {:white, :pawn}
      "k" -> {:black, :king}
      "q" -> {:black, :queen}
      "r" -> {:black, :rook}
      "b" -> {:black, :bishop}
      "n" -> {:black, :knight}
      "p" -> {:black, :pawn}
    end
  end
end
```

### SAN Parser/Generator

```elixir
defmodule Blunderfest.Chess.SAN do
  @moduledoc """
  Standard Algebraic Notation parsing and generation.
  """
  
  @spec parse(String.t(), Board.t()) :: {:ok, Move.t()} | {:error, String.t()}
  def parse(san, board) do
    cond do
      # Castling
      san in ["O-O", "0-0"] -> parse_castling(san, board, :king_side)
      san in ["O-O-O", "0-0-0"] -> parse_castling(san, board, :queen_side)
      
      # Normal moves
      true -> parse_normal_move(san, board)
    end
  end
  
  @spec generate(Move.t()) :: String.t()
  def generate(%Move{} = move) do
    cond do
      move.flags[:castling] and move.to > move.from -> "O-O"
      move.flags[:castling] -> "O-O-O"
      
      true ->
        piece_prefix = if move.piece == :pawn, do: "", else: piece_to_char(move.piece)
        disambiguation = get_disambiguation(move)
        capture = if move.captured, do: "x", else: ""
        promotion = if move.promotion, do: "=#{piece_to_char(move.promotion)}", else: ""
        check = cond do
          move.flags[:double_check] -> "++"
          move.flags[:check] -> "+"
          true -> ""
        end
        
        "#{piece_prefix}#{disambiguation}#{capture}#{square_to_algebraic(move.to)}#{promotion}#{check}"
    end
  end
  
  defp get_disambiguation(move) do
    # Find other pieces that can make the same move
    same_moves = find_ambiguous_moves(move)
    
    cond do
      Enum.empty?(same_moves) -> ""
      Enum.all?(same_moves, &different_file?(&1, move)) -> file_to_char(rem(move.from, 8))
      Enum.all?(same_moves, &different_rank?(&1, move)) -> rank_to_char(div(move.from, 8))
      true -> square_to_algebraic(move.from)
    end
  end
end
```

## Testing

### Test Positions

```elixir
defmodule Blunderfest.Chess.TestPositions do
  @moduledoc """
  Standard chess test positions for validation.
  """
  
  # Perft (Performance Test) positions
  @perft_positions [
    # Initial position
    %{
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      depth_results: %{
        1 => 20,
        2 => 400,
        3 => 8902,
        4 => 197281,
        5 => 4865609
      }
    },
    # Kiwipete position
    %{
      fen: "3k4/3p4/8/K1P4r/8/8/8/3b4 b - - 0 1",
      depth_results: %{
        1 => 24,
        2 => 251,
        3 => 2962
      }
    }
  ]
  
  # Mate in N positions
  @mate_positions [
    # Mate in 1
    %{
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1",
      side: :white,
      mate_in: 1
    },
    # Mate in 2
    %{
      fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
      side: :white,
      mate_in: 2
    }
  ]
  
  def perft(board, depth) when depth == 0, do: 1
  
  def perft(board, depth) do
    board
    |> MoveGenerator.generate_moves()
    |> Enum.map(fn move ->
      new_board = Board.apply_move(board, move)
      perft(new_board, depth - 1)
    end)
    |> Enum.sum()
  end
end
```

## Performance Considerations

### Optimizations

1. **Bitboard representation** for faster attack calculations (optional, for advanced version)
2. **Move ordering** for better alpha-beta pruning in analysis
3. **Transposition tables** using Zobrist hashing
4. **Incremental position updates** for faster move generation

### Benchmarks

Target performance:
- Move generation: < 1ms for typical positions
- Position validation: < 0.1ms
- FEN parsing: < 0.5ms
- SAN parsing: < 0.1ms per move