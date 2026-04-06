# Zobrist Hashing Specification

## Overview

Zobrist hashing is a cryptographic technique used to generate unique hash values for chess positions. It enables O(1) position lookup and efficient transposition detection.

## Hash Generation Algorithm

### 1. Random Number Generation

First, generate a table of random 64-bit numbers for each possible piece-square combination and game state:

```elixir
defmodule Blunderfest.Chess.Zobrist.Table do
  @moduledoc """
  Zobrist hashing lookup table generation.
  """
  
  # Board: 64 squares × 12 piece types × 2 colors = 1536 entries
  # Plus: 4 castling rights × 2 sides = 8 entries
  # Plus: 64 en passant files × 2 sides = 128 entries
  # Plus: 2 sides to move = 2 entries
  # Total: 1674 entries
  
  @piece_types [:pawn, :knight, :bishop, :rook, :queen, :king]
  @colors [:white, :black]
  @castling_rights [:king_side, :queen_side]
  
  def generate_table do
    :crypto.strong_rand_bytes(1674 * 8)
    |> :binary.decode_unsigned()
    |> split_into_chunks(8)
    |> Enum.take(1674)
  end
  
  defp split_into_chunks(data, chunk_size) do
    data
    |> Integer.digits(256)
    |> Enum.chunk_every(chunk_size)
    |> Enum.map(fn chunk ->
      chunk
      |> Enum.reverse()
      |> Integer.undigits(256)
    end)
  end
end
```

### 2. Table Structure

```
Index Range        Purpose
-----------        -------
0-767              White pieces on squares (64 squares × 6 piece types)
768-1535           Black pieces on squares (64 squares × 6 piece types)
1536-1539          White castling rights (K-side, Q-side)
1540-1543          Black castling rights (K-side, Q-side)
1544-1607          White en passant files (a-h)
1608-1671          Black en passant files (a-h)
1672               White to move
1673               Black to move (usually 0, XOR with 1672 for side change)
```

### 3. Index Calculation

```elixir
defmodule Blunderfest.Chess.Zobrist do
  @moduledoc """
  Zobrist hashing for chess positions.
  """
  
  alias Blunderfest.Chess.Board
  
  @table generate_table()
  
  # Piece type to index offset
  @piece_offsets %{
    {:white, :pawn}   => 0,
    {:white, :knight} => 64,
    {:white, :bishop} => 128,
    {:white, :rook}   => 192,
    {:white, :queen}  => 256,
    {:white, :king}   => 320,
    {:black, :pawn}   => 384,
    {:black, :knight} => 448,
    {:black, :bishop} => 512,
    {:black, :rook}   => 576,
    {:black, :queen}  => 640,
    {:black, :king}   => 704
  }
  
  @doc """
  Calculate Zobrist hash for a board position.
  """
  def hash(%Board{} = board) do
    initial = if board.side_to_move == :white, do: @table[1672], else: 0
    
    board
    |> piece_hash(initial)
    |> castling_hash(board)
    |> en_passant_hash(board)
  end
  
  @doc """
  Incrementally update hash for a move.
  """
  def update_hash(hash, %Board{} = old_board, %Board{} = new_board, move) do
    hash
    |> remove_piece(old_board, move.from)
    |> add_piece(new_board, move.to, move.piece)
    |> handle_capture(old_board, move)
    |> handle_castling(old_board, new_board)
    |> handle_en_passant(old_board, new_board, move)
    |> handle_promotion(move)
    |> toggle_side_to_move()
  end
  
  defp piece_hash(board, initial) do
    Enum.reduce(board.pieces, initial, fn {square, {color, piece}}, acc ->
      index = Map.get(@piece_offsets, {color, piece}) + square
      :erlang.bxor(acc, Enum.at(@table, index))
    end)
  end
  
  defp castling_hash(hash, board) do
    Enum.reduce(board.castling_rights, hash, fn {color, side}, acc ->
      index = case {color, side} do
        {:white, :king_side}  => 1536
        {:white, :queen_side} => 1537
        {:black, :king_side}  => 1538
        {:black, :queen_side} => 1539
      end
      :erlang.bxor(acc, Enum.at(@table, index))
    end)
  end
  
  defp en_passant_hash(hash, board) do
    case board.en_passant do
      nil -> hash
      square ->
        file = rem(square, 8)
        index = case board.side_to_move do
          :white -> 1544 + file
          :black -> 1608 + file
        end
        :erlang.bxor(hash, Enum.at(@table, index))
    end
  end
  
  defp toggle_side_to_move(hash) do
    :erlang.bxor(hash, Enum.at(@table, 1672))
  end
end
```

## Hash Properties

### Collision Probability

For a 64-bit hash with N positions:

```
P(collision) ≈ 1 - e^(-N² / 2^65)

For N = 10^9 (1 billion positions):
P(collision) ≈ 0.000000027 (essentially zero)

For N = 10^12 (1 trillion positions):
P(collision) ≈ 0.027 (2.7% chance)
```

### Hash Distribution

The hash values should be uniformly distributed across the 64-bit space:

```elixir
def verify_distribution(hashes) do
  # Chi-squared test for uniformity
  buckets = 1000
  bucket_size = div(2^64, buckets)
  
  observed = hashes
    |> Enum.map(fn h -> div(h, bucket_size) end)
    |> Enum.frequencies()
  
  expected = length(hashes) / buckets
  
  chi_squared = Enum.reduce(observed, 0, fn {_bucket, count}, acc ->
    acc + (count - expected)^2 / expected
  end)
  
  # Should be close to (buckets - 1) for uniform distribution
  chi_squared
end
```

## Incremental Hashing

### Move Application

```elixir
def apply_move(hash, board, move) do
  hash
  # Remove piece from source square
  |> remove_piece(board, move.from)
  # Add piece to destination square
  |> add_piece(board, move.to, move.piece)
  # Handle capture
  |> handle_capture(board, move)
  # Handle special moves
  |> handle_castling(board, move)
  |> handle_en_passant(board, move)
  |> handle_promotion(move)
  # Toggle side to move
  |> toggle_side_to_move()
  # Update castling rights
  |> update_castling(board, move)
end
```

### Performance Optimization

```elixir
# Pre-compute common patterns
@castle_hash_cache :ets.new(:castle_hash_cache, [:set, :public])

def precompute_castling_hashes do
  # All 16 possible castling right combinations
  for mask <- 0..15 do
    hash = compute_castling_hash(mask)
    :ets.insert(@castle_hash_cache, {mask, hash})
  end
end

def get_castling_hash(mask) do
  case :ets.lookup(@castle_hash_cache, mask) do
    [{^mask, hash}] -> hash
    [] -> compute_castling_hash(mask)
  end
end
```

## Hash Table Implementation

### Position Index

```elixir
defmodule Blunderfest.Storage.PositionIndex do
  @moduledoc """
  Position index using Zobrist hashing.
  """
  
  defstruct [:entries, :count]
  
  @type entry :: %{
    hash: integer(),
    offset: non_neg_integer(),
    count: pos_integer(),
    stats: position_stats(),
    game_ids: [integer()]
  }
  
  @type position_stats :: %{
    white_wins: non_neg_integer(),
    black_wins: non_neg_integer(),
    draws: non_neg_integer()
  }
  
  def new do
    %__MODULE__{
      entries: :ets.new(:position_index, [:set, :public, 
        {:read_concurrency, true}, 
        {:write_concurrency, true}]),
      count: 0
    }
  end
  
  def insert(index, hash, game_id, offset, stats) do
    case :ets.lookup(index.entries, hash) do
      [{^hash, entry}] ->
        updated = %{
          entry | 
          count: entry.count + 1,
          stats: merge_stats(entry.stats, stats),
          game_ids: [game_id | entry.game_ids]
        }
        :ets.insert(index.entries, {hash, updated})
        
      [] ->
        entry = %{
          hash: hash,
          offset: offset,
          count: 1,
          stats: stats,
          game_ids: [game_id]
        }
        :ets.insert(index.entries, {hash, entry})
    end
    
    update_count(index)
  end
  
  def lookup(index, hash) do
    case :ets.lookup(index.entries, hash) do
      [{^hash, entry}] -> {:ok, entry}
      [] -> :error
    end
  end
  
  defp merge_stats(stats1, stats2) do
    %{
      white_wins: stats1.white_wins + stats2.white_wins,
      black_wins: stats1.black_wins + stats2.black_wins,
      draws: stats1.draws + stats2.draws
    }
  end
end
```

### Bloom Filter Integration

```elixir
defmodule Blunderfest.Storage.PositionBloomFilter do
  @moduledoc """
  Bloom filter for quick position existence checks.
  """
  
  defstruct [:bits, :hash_count, :capacity]
  
  @default_capacity 100_000_000
  @default_fp_rate 0.01
  
  def new(capacity \\ @default_capacity, fp_rate \\ @default_fp_rate) do
    size = calculate_size(capacity, fp_rate)
    hash_count = calculate_hash_count(fp_rate)
    
    %__MODULE__{
      bits: :array.new(size, fixed: true, default: 0),
      hash_count: hash_count,
      capacity: capacity
    }
  end
  
  def add(filter, hash) do
    indices = get_hash_indices(hash, filter.hash_count)
    
    updated_bits = Enum.reduce(indices, filter.bits, fn idx, bits ->
      :array.set(idx, 1, bits)
    end)
    
    %{filter | bits: updated_bits}
  end
  
  def might_contain?(filter, hash) do
    indices = get_hash_indices(hash, filter.hash_count)
    
    Enum.all?(indices, fn idx ->
      :array.get(idx, filter.bits) == 1
    end)
  end
  
  defp get_hash_indices(hash, count) do
    Enum.map(0..(count-1), fn i ->
      # Use different hash functions by XORing with different constants
      mixed = :erlang.bxor(hash, i * 0x9E3779B97F4A7C15)
      rem(mixed, :array.size(filter.bits))
    end)
  end
  
  defp calculate_size(n, p) do
    trunc(-n * :math.log(p) / (:math.log(2) ** 2))
  end
  
  defp calculate_hash_count(p) do
    trunc(:math.log(2) * 8 / :math.log(2))
  end
end
```

## Testing and Validation

### Hash Correctness Tests

```elixir
defmodule Blunderfest.Chess.ZobristTest do
  use ExUnit.Case
  
  test "same position produces same hash" do
    board1 = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    board2 = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    
    assert Zobrist.hash(board1) == Zobrist.hash(board2)
  end
  
  test "different positions produce different hashes" do
    board1 = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    board2 = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")
    
    assert Zobrist.hash(board1) != Zobrist.hash(board2)
  end
  
  test "incremental hashing matches full hashing" do
    board = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    move = %Move{from: 52, to: 36, piece: :pawn}  # e2-e4
    
    full_hash = board
    |> Board.apply_move(move)
    |> Zobrist.hash()
    
    incremental_hash = board
    |> Zobrist.hash()
    |> Zobrist.update_hash(board, board |> Board.apply_move(move), move)
    
    assert full_hash == incremental_hash
  end
  
  test "transposition detection" do
    # 1. e4 e5 2. Nf3
    board1 = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    |> Board.apply_move(e2e4)
    |> Board.apply_move(e7e5)
    |> Board.apply_move(g1f3)
    
    # 1. Nf3 e5 2. e4
    board2 = Board.from_fen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    |> Board.apply_move(g1f3)
    |> Board.apply_move(e7e5)
    |> Board.apply_move(e2e4)
    
    assert Zobrist.hash(board1) == Zobrist.hash(board2)
  end
end
```

### Performance Benchmarks

```elixir
defmodule Blunderfest.Chess.Zobrist.Bench do
  use Benchfella
  
  setup_all do
    board = Board.from_fen("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3:0:0")
    {:ok, board: board}
  end
  
  bench "full hash calculation" do
    Zobrist.hash(board)
  end
  
  bench "incremental hash update" do
    move = %Move{from: 27, to: 20, piece: :bishop}  # Bc4-b3
    Zobrist.update_hash(Zobrist.hash(board), board, board |> Board.apply_move(move), move)
  end
  
  bench "hash table lookup" do
    hash = Zobrist.hash(board)
    PositionIndex.lookup(index, hash)
  end
end
```

## Implementation Notes

1. **Thread Safety**: The hash table is read-concurrent, write-concurrent
2. **Memory Usage**: ~13KB for the random number table
3. **Collision Handling**: Use secondary hash for collision resolution
4. **Persistence**: Store hash table offsets in the binary format
5. **Validation**: Verify hash consistency on database open