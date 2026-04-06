# Data Migration Guide

## Overview

This guide covers migrating chess databases from existing formats (ChessBase, SCID, PGN) to the Blunderfest binary format.

## Supported Source Formats

| Format | Read Support | Write Support | Notes |
|--------|--------------|---------------|-------|
| PGN | Full | Full | Universal format |
| ChessBase (.cbv) | Partial | No | Read-only via export |
| SCID (.si4) | Full | No | Open source format |
| ChessBase (.cbh) | Partial | No | Header files only |
| EPD | Full | Full | Position notation |
| FEN | Full | Full | Single position |

## Migration from PGN

### Basic PGN Import

```elixir
defmodule Blunderfest.Migration.PGN do
  @moduledoc """
  Migrate PGN files to Blunderfest format.
  """
  
  @type import_result :: %{
    total: non_neg_integer(),
    imported: non_neg_integer(),
    errors: non_neg_integer(),
    duplicates: non_neg_integer()
  }
  
  @spec import_file(String.t(), String.t(), keyword()) :: import_result()
  def import_file(pgn_path, db_path, opts \\ []) do
    on_progress = Keyword.get(opts, :on_progress, fn _ -> :ok end)
    batch_size = Keyword.get(opts, :batch_size, 1000)
    skip_duplicates = Keyword.get(opts, :skip_duplicates, true)
    
    # Create new database
    {:ok, db} = Blunderfest.Database.create(db_path)
    
    # Stream and import
    pgn_path
    |> File.stream!([:read_ahead: 1024 * 1024])
    |> Stream.chunk_every(batch_size)
    |> Enum.reduce_while(%{total: 0, imported: 0, errors: 0, duplicates: 0}, 
      fn chunk, acc ->
        results = process_chunk(chunk, db, skip_duplicates)
        new_acc = merge_results(acc, results)
        
        on_progress.(new_acc)
        
        {:cont, new_acc}
      end)
    |> then(fn results ->
      Blunderfest.Database.close(db)
      results
    end)
  end
  
  defp process_chunk(lines, db, skip_duplicates) do
    pgn_text = Enum.join(lines, "\n")
    
    pgn_text
    |> Blunderfest.Chess.PGN.parse()
    |> Enum.reduce(%{imported: 0, errors: 0, duplicates: 0}, fn game, acc ->
      case import_game(db, game, skip_duplicates) do
        {:ok, _id} -> %{acc | imported: acc.imported + 1}
        {:error, :duplicate} -> %{acc | duplicates: acc.duplicates + 1}
        {:error, _} -> %{acc | errors: acc.errors + 1}
      end
    end)
    |> Map.put(:total, length(lines))
  end
  
  defp import_game(db, game, skip_duplicates) do
    # Check for duplicates
    if skip_duplicates and duplicate?(db, game) do
      {:error, :duplicate}
    else
      Blunderfest.Game.add(db, game)
    end
  end
  
  defp duplicate?(db, game) do
    # Check by position hash of starting position
    case game.moves do
      [] -> false
      [first_move | _] ->
        # Simple duplicate detection based on first few moves
        hash = compute_partial_hash(game.moves |> Enum.take(10))
        Blunderfest.Position.exists?(db, hash)
    end
  end
  
  defp merge_results(acc, results) do
    %{
      total: acc.total + results.total,
      imported: acc.imported + results.imported,
      errors: acc.errors + results.errors,
      duplicates: acc.duplicates + results.duplicates
    }
  end
end
```

### Progress Tracking

```elixir
# Example usage with progress
:ok = Blunderfest.Migration.PGN.import_file(
  "games.pgn",
  "blunderfest.bchess",
  on_progress: fn results ->
    IO.puts("Imported: #{results.imported}, Errors: #{results.errors}, Duplicates: #{results.duplicates}")
  end,
  batch_size: 5000
)
```

## Migration from ChessBase

### Export from ChessBase

ChessBase databases cannot be read directly. Export to PGN first:

1. Open ChessBase database
2. Select games to export (Ctrl+A for all)
3. File → Export → Games
4. Choose PGN format
5. Select export options:
   - Include annotations: Yes
   - Include variations: Yes
   - Include analysis: Yes
   - Encoding: UTF-8

### Command Line Export (ChessBase)

```bash
# Using chessbase-cli (if available)
chessbase-cli export --input database.cbv --output games.pgn --format pgn

# Or use the built-in export
cbexport database.cbv games.pgn --all --annotations --variations
```

### Import Exported PGN

```elixir
# After exporting from ChessBase
:ok = Blunderfest.Migration.PGN.import_file(
  "chessbase_export.pgn",
  "blunderfest.bchess",
  on_progress: &log_progress/1
)
```

## Migration from SCID

### SCID Format Support

SCID uses the .si4 format which can be read directly:

```elixir
defmodule Blunderfest.Migration.SCID do
  @moduledoc """
  Migrate SCID databases to Blunderfest format.
  """
  
  @spec import_si4(String.t(), String.t(), keyword()) :: import_result()
  def import_si4(si4_path, db_path, opts \\ []) do
    # SCID files are SQLite-based
    {:ok, conn} = SQLite3.open(si4_path)
    
    # Read metadata
    metadata = read_scid_metadata(conn)
    
    # Create Blunderfest database
    {:ok, db} = Blunderfest.Database.create(db_path, 
      metadata: metadata
    )
    
    # Import games
    results = stream_scid_games(conn)
    |> Enum.reduce(%{total: 0, imported: 0, errors: 0}, fn game, acc ->
      case Blunderfest.Game.add(db, game) do
        {:ok, _id} -> %{acc | imported: acc.imported + 1}
        {:error, _} -> %{acc | errors: acc.errors + 1}
      end
      |> Map.update!(:total, &(&1 + 1))
    end)
    
    SQLite3.close(conn)
    Blunderfest.Database.close(db)
    
    results
  end
  
  defp read_scid_metadata(conn) do
    # SCID stores metadata in SQLite tables
    query = "SELECT * FROM metadata"
    case SQLite3.query(conn, query) do
      {:ok, rows} ->
        rows
        |> Enum.into(%{})
        |> Map.take([:name, :description, :created_date])
        
      {:error, _} ->
        %{}
    end
  end
  
  defp stream_scid_games(conn) do
    # SCID stores games in the 'games' table
    Stream.resource(
      fn -> SQLite3.query(conn, "SELECT * FROM games") end,
      fn
        {:ok, []} ->
          {:halt, nil}
          
        {:ok, rows} ->
          games = Enum.map(rows, &scid_game_to_struct/1)
          {games, nil}
          
        {:error, _} ->
          {:halt, nil}
      end,
      fn _ -> :ok end
    )
  end
  
  defp scid_game_to_struct(row) do
    # Convert SCID game format to Blunderfest game struct
    %Blunderfest.Types.Game{
      white: row["white"],
      black: row["black"],
      result: parse_result(row["result"]),
      date: parse_date(row["date"]),
      eco: row["eco"],
      event: row["event"],
      site: row["site"],
      round: row["round"],
      moves: parse_moves(row["moves"]),
      annotations: parse_annotations(row["annotations"])
    }
  end
end
```

### SCID Export to PGN

If direct SCID import is not available:

```bash
# Export SCID to PGN
scid export database.si4 games.pgn

# Then import to Blunderfest
:ok = Blunderfest.Migration.PGN.import_file("games.pgn", "blunderfest.bchess")
```

## Migration from Other Formats

### EPD (Extended Position Description)

```elixir
defmodule Blunderfest.Migration.EPD do
  @moduledoc """
  Import EPD files (position collections).
  """
  
  @spec import_epd(String.t(), String.t()) :: {:ok, non_neg_integer()} | {:error, String.t()}
  def import_epd(epd_path, db_path) do
    {:ok, db} = Blunderfest.Database.create(db_path)
    
    count = epd_path
    |> File.stream!()
    |> Enum.reduce(0, fn line, acc ->
      case parse_epd_line(line) do
        {:ok, position} ->
          # Create a dummy game for the position
          game = position_to_game(position)
          case Blunderfest.Game.add(db, game) do
            {:ok, _} -> acc + 1
            {:error, _} -> acc
          end
          
        {:error, _} ->
          acc
      end
    end)
    
    Blunderfest.Database.close(db)
    {:ok, count}
  end
  
  defp parse_epd_line(line) do
    # EPD format: FEN operations
    # Example: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1 id "test";
    
    case String.split(line, ";") do
      [fen_part | operations] ->
        fen = String.trim(fen_part)
        ops = parse_operations(operations)
        
        {:ok, %{fen: fen, operations: ops}}
        
      _ ->
        {:error, :invalid_format}
    end
  end
  
  defp position_to_game(position) do
    %Blunderfest.Types.Game{
      tags: %{
        "FEN" => position.fen,
        "Event" => "EPD Import",
        "Result" => "*"
      },
      moves: [],
      annotations: position.operations
    }
  end
end
```

### ChessBase .cbh Header Files

```elixir
defmodule Blunderfest.Migration.CBH do
  @moduledoc """
  Read ChessBase header files for metadata.
  """
  
  @spec read_cbh(String.t()) :: {:ok, [map()]} | {:error, String.t()}
  def read_cbh(cbh_path) do
    # .cbh files contain game headers/metadata
    with {:ok, content} <- File.read(cbh_path) do
      games = parse_cbh_content(content)
      {:ok, games}
    end
  end
  
  defp parse_cbh_content(content) do
    # Binary format parsing for .cbh
    # This is a simplified version - actual format is more complex
    
    content
    |> :binary.decode_unsigned()
    |> extract_game_headers()
  end
end
```

## Bulk Migration

### Parallel Import

```elixir
defmodule Blunderfest.Migration.Parallel do
  @moduledoc """
  High-performance parallel import.
  """
  
  @spec parallel_import([String.t()], String.t(), keyword()) :: import_result()
  def parallel_import(pgn_files, db_path, opts \\ []) do
    # Create database
    {:ok, db} = Blunderfest.Database.create(db_path)
    
    # Process files in parallel
    results = pgn_files
    |> Task.async_stream(
      fn file ->
        import_single_file(file, db)
      end,
      max_concurrency: Keyword.get(opts, :concurrency, 4)
    )
    |> Enum.reduce(%{total: 0, imported: 0, errors: 0, duplicates: 0}, 
      fn {:ok, result}, acc ->
        merge_results(acc, result)
      end)
    
    Blunderfest.Database.close(db)
    results
  end
  
  defp import_single_file(file, db) do
    file
    |> File.stream!()
    |> Stream.chunk_every(1000)
    |> Enum.reduce(%{total: 0, imported: 0, errors: 0, duplicates: 0}, fn chunk, acc ->
      results = process_chunk(chunk, db)
      merge_results(acc, results)
    end)
  end
end

# Usage
:ok = Blunderfest.Migration.Parallel.parallel_import(
  ["volume1.pgn", "volume2.pgn", "volume3.pgn"],
  "complete_database.bchess",
  concurrency: 8
)
```

### Incremental Import

```elixir
defmodule Blunderfest.Migration.Incremental do
  @moduledoc """
  Incremental import with checkpoint/resume.
  """
  
  @checkpoint_file "import_checkpoint.json"
  
  @spec incremental_import(String.t(), String.t()) :: import_result()
  def incremental_import(pgn_path, db_path) do
    # Load checkpoint if exists
    checkpoint = load_checkpoint()
    
    # Open or create database
    db = if checkpoint do
      {:ok, db} = Blunderfest.Database.open(db_path)
      db
    else
      {:ok, db} = Blunderfest.Database.create(db_path)
      db
    end
    
    # Resume from checkpoint
    results = pgn_path
    |> File.stream!()
    |> Stream.drop(checkpoint.lines_processed)
    |> Stream.chunk_every(1000)
    |> Enum.reduce(checkpoint.results, fn chunk, acc ->
      results = process_chunk(chunk, db)
      new_results = merge_results(acc, results)
      
      # Save checkpoint
      save_checkpoint(%{
        lines_processed: checkpoint.lines_processed + length(chunk),
        results: new_results
      })
      
      new_results
    end)
    
    Blunderfest.Database.close(db)
    File.rm(@checkpoint_file)
    
    results
  end
  
  defp load_checkpoint do
    case File.read(@checkpoint_file) do
      {:ok, content} -> Jason.decode!(content)
      {:error, _} -> nil
    end
  end
  
  defp save_checkpoint(checkpoint) do
    @checkpoint_file
    |> Jason.encode!(checkpoint)
    |> then(&File.write(@checkpoint_file, &1))
  end
end
```

## Validation and Verification

### Post-Import Validation

```elixir
defmodule Blunderfest.Migration.Validation do
  @moduledoc """
  Validate imported database integrity.
  """
  
  @spec validate(String.t()) :: validation_result()
  def validate(db_path) do
    {:ok, db} = Blunderfest.Database.open(db_path)
    
    results = %{
      game_count: Blunderfest.Game.count(db),
      position_count: Blunderfest.Position.count(db),
      player_count: Blunderfest.Player.count(db),
      index_integrity: check_index_integrity(db),
      sample_validation: validate_sample_games(db)
    }
    
    Blunderfest.Database.close(db)
    results
  end
  
  defp check_index_integrity(db) do
    # Verify all indices are consistent
    game_count = Blunderfest.Game.count(db)
    position_count = Blunderfest.Position.count(db)
    
    # Check that position count is reasonable
    avg_positions_per_game = position_count / max(game_count, 1)
    
    if avg_positions_per_game > 10 and avg_positions_per_game < 200 do
      :ok
    else
      {:warning, "Unexpected position count ratio: #{avg_positions_per_game}"}
    end
  end
  
  defp validate_sample_games(db) do
    # Validate a sample of games
    sample = Blunderfest.Game.list(db, limit: 100)
    
    results = Enum.map(sample, fn game ->
      case validate_game(game) do
        :ok -> :ok
        {:error, reason} -> {:error, {game.id, reason}}
      end
    end)
    
    errors = Enum.reject(results, &(&1 == :ok))
    
    if Enum.empty?(errors) do
      :ok
    else
      {:warning, "#{length(errors)} games with issues"}
    end
  end
end
```

### Comparison with Source

```elixir
defmodule Blunderfest.Migration.Compare do
  @moduledoc """
  Compare source and imported databases.
  """
  
  @spec compare(String.t(), String.t()) :: comparison_result()
  def compare(source_pgn, blunderfest_db) do
    source_count = count_pgn_games(source_pgn)
    {:ok, db} = Blunderfest.Database.open(blunderfest_db)
    target_count = Blunderfest.Game.count(db)
    
    comparison = %{
      source_games: source_count,
      imported_games: target_count,
      difference: source_count - target_count,
      match_rate: if source_count > 0, do: target_count / source_count * 100, else: 0
    }
    
    Blunderfest.Database.close(db)
    comparison
  end
  
  defp count_pgn_games(path) do
    path
    |> File.stream!()
    |> Enum.count(&String.starts_with?(&1, "["))
    |> div(7)  # Approximately 7 tags per game
  end
end
```

## Performance Tips

### Optimizing Large Imports

1. **Use batch imports**: Process 1000-5000 games at a time
2. **Disable indexing during import**: Build index after all games loaded
3. **Use parallel processing**: Import multiple files simultaneously
4. **Increase memory**: Set larger cache size for import
5. **Use SSD storage**: Critical for I/O performance

```elixir
# Optimized import configuration
config :blunderfest, :import,
  batch_size: 5000,
  parallel_files: 8,
  cache_size: 4_000_000_000,  # 4 GB for import
  build_index_after: true,
  skip_duplicates: true
```

### Memory Management

```elixir
defmodule Blunderfest.Migration.Memory do
  @moduledoc """
  Memory management for large imports.
  """
  
  def monitor_memory during_import do
    spawn(fn ->
      while import_running?() do
        memory = :erlang.memory()
        rss = memory[:resident_set_size]
        
        if rss > max_memory() do
          # Trigger garbage collection
          :erlang.garbage_collect()
          Process.sleep(1000)
        end
        
        Process.sleep(5000)  # Check every 5 seconds
      end
    end)
  end
end
```

## Troubleshooting

### Common Issues

1. **Encoding problems**: Ensure PGN files are UTF-8 encoded
2. **Malformed PGN**: Use PGN validator before import
3. **Memory exhaustion**: Reduce batch size or increase memory
4. **Slow import**: Use SSD, increase batch size, enable parallel processing
5. **Duplicate games**: Enable duplicate detection or clean source first

### Recovery from Failed Import

```bash
# If import fails, resume from checkpoint
:ok = Blunderfest.Migration.Incremental.incremental_import("large.pgn", "db.bchess")

# Or restart with fresh database
File.rm("db.bchess")
:ok = Blunderfest.Migration.PGN.import_file("large.pgn", "db.bchess")