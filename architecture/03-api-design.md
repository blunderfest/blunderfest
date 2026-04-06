# API Design

## Overview

Blunderfest provides two API layers:

1. **Core Library API** - Pure Elixir library for embedding in applications
2. **REST API** - HTTP interface for remote access

## Core Library API

### Database Lifecycle

```elixir
# Initialize the shared database (deployment/admin only)
# This is typically done once during system setup
{:ok, db} = Blunderfest.Database.initialize("s3://blunderfest-db/main.bchess", options)

# Connect to the shared database (API nodes)
# All API nodes connect to the same database
{:ok, db} = Blunderfest.Database.connect("s3://blunderfest-db/main.bchess", 
  read_only: true,
  cache_size: 100_000,
  lazy_load: true
)

# Disconnect from the database
:ok = Blunderfest.Database.disconnect(db)

# Get database info (all nodes see the same database)
{:ok, info} = Blunderfest.Database.info(db)
# => %{
#   game_count: 1000000,
#   position_count: 50000000,
#   player_count: 100000,
#   file_size: 630000000,
#   version: "1.0",
#   created_at: ~U[2024-01-01 00:00:00Z],
#   modified_at: ~U[2024-01-15 12:30:00Z],
#   storage_backend: :s3,
#   replication_factor: 3,
#   active_nodes: 5
# }
```

### Database Architecture

**Single Shared Database Model:**

- **One primary database** stored on shared storage (S3/MinIO or network filesystem)
- **Multiple API nodes** connect to the same database
- **Read replicas** for scaling read operations
- **Write coordination** through distributed locking

```elixir
# Deployment configuration
config :blunderfest, :database,
  storage: :s3,
  bucket: "blunderfest-db",
  path: "main.bchess",
  region: "us-east-1",
  replication: [
    enabled: true,
    factor: 3,
    regions: ["us-east-1", "eu-west-1", "ap-southeast-1"]
  ]
```

### Game Operations

```elixir
# Add a game from PGN string
{:ok, game_id} = Blunderfest.Game.add(db, pgn_string)

# Add a game from structured data
game_data = %{
  white: "Carlsen, Magnus",
  black: "Caruana, Fabiano",
  event: "World Championship 2024",
  site: "London",
  date: "2024.11.15",
  round: "12",
  result: "1-0",
  eco: "C88",
  moves: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...",
  annotations: [...]
}
{:ok, game_id} = Blunderfest.Game.add(db, game_data)

# Get a game by ID
{:ok, game} = Blunderfest.Game.get(db, game_id)
# => %Blunderfest.Types.Game{
#   id: 12345,
#   white: %Player{id: 1, name: "Carlsen, Magnus"},
#   black: %Player{id: 2, name: "Caruana, Fabiano"},
#   event: "World Championship 2024",
#   site: "London",
#   date: ~D[2024-11-15],
#   round: "12",
#   result: :white_wins,
#   eco: "C88",
#   moves: [...],
#   positions: [...]
# }

# Update a game
:ok = Blunderfest.Game.update(db, game_id, annotations: new_annotations)

# Delete a game
:ok = Blunderfest.Game.delete(db, game_id)

# List games with pagination
{:ok, games} = Blunderfest.Game.list(db, limit: 20, offset: 0)

# Count games
{:ok, count} = Blunderfest.Game.count(db)
```

### Bulk Import/Export

```elixir
# Import PGN file
{:ok, count, errors} = Blunderfest.Game.import_pgn(db, "games.pgn", 
  on_progress: fn processed, total -> 
    IO.puts("Imported #{processed}/#{total}")
  end
)

# Export to PGN file
:ok = Blunderfest.Game.export_pgn(db, "export.pgn", 
  filters: [eco: ["A00", "A01", "A02"]],
  include_annotations: true
)

# Export to JSON
:ok = Blunderfest.Game.export_json(db, "export.json", options)
```

### Position Operations

```elixir
# Get position statistics
{:ok, stats} = Blunderfest.Position.stats(db, fen_string)
# => %{
#   fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3:0:0",
#   game_count: 15432,
#   white_wins: 6234,
#   black_wins: 4123,
#   draws: 5075,
#   white_win_rate: 0.404,
#   black_win_rate: 0.267,
#   draw_rate: 0.329,
#   common_continuations: [
#     %{move: "Nf3", count: 5432, white_win_rate: 0.42},
#     %{move: "d3", count: 3210, white_win_rate: 0.38},
#     ...
#   ]
# }

# Find all games with a position
{:ok, games} = Blunderfest.Position.search(db, fen_string, 
  limit: 100,
  include_stats: true
)

# Search positions by criteria
{:ok, positions} = Blunderfest.Position.find(db, 
  material: [white: [:queen, :rook], black: [:queen, :rook]],
  side_to_move: :white,
  has_bishop_pair: :white
)

# Find similar positions (fuzzy matching)
{:ok, similar} = Blunderfest.Position.find_similar(db, fen_string,
  threshold: 0.8,  # 80% similarity
  limit: 50
)

# Find position with colors reversed
{:ok, flipped} = Blunderfest.Position.search_flipped(db, fen_string)
# => %{
#   original_position: %{fen: "...", hash: 123},
#   flipped_position: %{fen: "...", hash: 456},
#   games_with_original: 1500,
#   games_with_flipped: 1200,
#   combined_stats: %{...}
# }

# Search with flipped positions included
{:ok, positions} = Blunderfest.Position.find(db,
  fen: fen_string,
  include_flipped: true
)

# Get transpositions (different move orders to same position)
{:ok, transpositions} = Blunderfest.Position.transpositions(db, fen_string)
# => [
#   %{move_order: ["e4", "e5", "Nf3", "Nc6", "Bb5"], game_count: 5000},
#   %{move_order: ["Nf3", "Nc6", "e4", "e5", "Bb5"], game_count: 3000},
#   ...
# ]
```

### Player Operations

```elixir
# Get player by ID
{:ok, player} = Blunderfest.Player.get(db, player_id)

# Search players by name
{:ok, players} = Blunderfest.Player.search(db, "Carlsen", limit: 10)

# Get player statistics
{:ok, stats} = Blunderfest.Player.stats(db, player_id)
# => %{
#   player: %Player{id: 1, name: "Carlsen, Magnus"},
#   total_games: 5432,
#   wins: 2345,
#   losses: 1234,
#   draws: 1853,
#   win_rate: 0.432,
#   performance_by_color: %{
#     white: %{wins: 1500, losses: 500, draws: 800, win_rate: 0.536},
#     black: %{wins: 845, losses: 734, draws: 1053, win_rate: 0.304}
#   },
#   performance_by_opening: [
#     %{eco: "C88", games: 234, win_rate: 0.52},
#     ...
#   ],
#   performance_by_year: [
#     %{year: 2024, games: 150, win_rate: 0.58},
#     ...
#   ]
# }

# Get player's games
{:ok, games} = Blunderfest.Player.games(db, player_id, limit: 50)

# Get head-to-head record
{:ok, h2h} = Blunderfest.Player.head_to_head(db, player1_id, player2_id)
# => %{
#   player1_wins: 15,
#   player2_wins: 12,
#   draws: 23,
#   total_games: 50
# }
```

### Analysis Operations

```elixir
# Classify opening
{:ok, classification} = Blunderfest.Analysis.classify_opening(db, moves)
# => %{
#   eco: "B90",
#   name: "Sicilian Defense: Najdorf Variation",
#   detailed_code: "B90.01.03",
#   moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
#   position_hash: 1234567890123456789
# }

# Get opening tree
{:ok, tree} = Blunderfest.Analysis.opening_tree(db, eco_code)
# => %{
#   eco: "B90",
#   name: "Sicilian Defense: Najdorf Variation",
#   position: %{fen: "...", stats: %{...}},
#   children: [
#     %{
#       move: "Be3",
#       count: 5432,
#       position: %{fen: "...", stats: %{...}},
#       children: [...]
#     },
#     ...
#   ]
# }

# Get opening statistics
{:ok, stats} = Blunderfest.Analysis.opening_stats(db, eco_code)
# => %{
#   eco: "B90",
#   total_games: 15432,
#   white_wins: 6234,
#   black_wins: 4123,
#   draws: 5075,
#   white_win_rate: 0.404,
#   popularity_rank: 5,
#   top_players: [
#     %{player: "Carlsen, Magnus", games: 234, win_rate: 0.52},
#     ...
#   ]
# }

# Analyze position with engine
{:ok, analysis} = Blunderfest.Analysis.analyze(db, fen_string, 
  depth: 20,
  time_limit: 5000,
  engine: "stockfish"
)
# => Returns analysis via callback/WebSocket (async operation)
```

### Search Operations

```elixir
# Search games by criteria
{:ok, games} = Blunderfest.Search.games(db, 
  white: "Carlsen",
  black: "Caruana", 
  eco: ["C88", "C89"],
  year_from: 2020,
  year_to: 2024,
  result: [:white_wins, :draw],
  limit: 100
)

# Search by position pattern
{:ok, games} = Blunderfest.Search.position_pattern(db,
  board_pattern: "R..K....r...k...",  # Simplified pattern
  material_balance: 0,  # Equal material
  side_to_move: :white
)

# Search by material configuration
{:ok, games} = Blunderfest.Search.material(db,
  white_pieces: [:king, :queen, :rook, :bishop, :knight],
  black_pieces: [:king, :queen, :rook, :knight, :knight],
  exact: false  # At least these pieces
)

# Complex search with filters
{:ok, games} = Blunderfest.Search.advanced(db,
  players: ["Carlsen", "Caruana"],
  events: ["World Championship", "Tata Steel"],
  openings: ["C88", "C89", "C90"],
  date_range: {~D[2020-01-01], ~D[2024-12-31]},
  position_after_move: 15,  # Filter by position after move 15
  min_accuracy: 0.85  # Only games with high accuracy
)
```

## REST API

### Base URL

```
https://api.blunderfest.com/v1
```

### Authentication

```http
Authorization: Bearer <api_key>
```

### Endpoints

#### Games

```
GET    /games                  # List/search games
POST   /games                  # Add new game
GET    /games/:id              # Get game details
PUT    /games/:id              # Update game
DELETE /games/:id              # Delete game
GET    /games/:id/pgn          # Get game as PGN
GET    /games/:id/positions    # Get all positions in game
```

#### Positions

```
GET    /positions/:fen         # Get position statistics
POST   /positions/search       # Search positions
GET    /positions/:fen/similar # Find similar positions
GET    /positions/:fen/flipped # Find position with colors reversed
GET    /positions/:fen/games   # Get games with this position
GET    /positions/:fen/transpositions # Get transpositions
```

#### Players

```
GET    /players                # List/search players
GET    /players/:id            # Get player details
GET    /players/:id/games      # Get player's games
GET    /players/:id/stats      # Get player statistics
GET    /players/:id1/vs/:id2   # Head-to-head record
```

#### Openings

```
GET    /openings               # List openings
GET    /openings/:eco          # Get opening details
GET    /openings/:eco/tree     # Get opening tree
GET    /openings/:eco/games    # Get games in opening
GET    /openings/:eco/stats    # Get opening statistics
```

#### Analysis

```
POST   /analysis               # Request engine analysis
GET    /analysis/:id           # Get analysis results
DELETE /analysis/:id           # Cancel analysis
```

#### Import/Export

```
POST   /import/pgn             # Import PGN file
POST   /export/pgn             # Export to PGN
POST   /export/json            # Export to JSON
GET    /import/status/:id      # Check import progress
```

### WebSocket

```
ws://api.blunderfest.com/v1/ws
```

#### Messages

**Request Analysis:**
```json
{
  "type": "analyze",
  "fen": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3:0:0",
  "depth": 20,
  "time_limit": 5000
}
```

**Analysis Progress:**
```json
{
  "type": "analysis_progress",
  "depth": 15,
  "score": 0.35,
  "pv": ["Nc6", "d3", "Be7"],
  "nodes": 1234567,
  "nps": 5000000
}
```

**Analysis Complete:**
```json
{
  "type": "analysis_complete",
  "best_move": "Nc6",
  "score": 0.42,
  "depth": 20,
  "pv": ["Nc6", "d3", "Be7", "O-O", "h6"],
  "alternatives": [
    {"move": "d6", "score": 0.28},
    {"move": "Be7", "score": 0.15}
  ]
}
```

### Response Format

#### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 1000,
    "total_pages": 50
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Game not found",
    "details": {
      "game_id": 12345
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_INPUT` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `NOT_SUPPORTED` | 501 | Feature not implemented |

### Rate Limits

| Tier | Requests/minute | Requests/day | Analysis requests/hour |
|------|-----------------|--------------|------------------------|
| Free | 60 | 1000 | 10 |
| Basic | 300 | 10000 | 100 |
| Pro | 1000 | 100000 | 500 |
| Enterprise | 5000 | Unlimited | Unlimited |

### Query Parameters

#### Pagination

```
?limit=20&offset=0
?limit=50&page=2
```

#### Sorting

```
?sort=date&order=desc
?sort=elo&order=asc
```

#### Filtering

```
?white=Carlsen&black=Caruana&eco=C88&year_from=2020&year_to=2024
```

#### Field Selection

```
?fields=id,white,black,date,result
```

## Type Definitions

### Game

```elixir
defmodule Blunderfest.Types.Game do
  @type t :: %__MODULE__{
    id: integer(),
    white: Player.t(),
    black: Player.t(),
    event: String.t(),
    site: String.t(),
    date: Date.t() | nil,
    round: String.t() | nil,
    result: :white_wins | :black_wins | :draw | :in_progress,
    eco: String.t() | nil,
    moves: [Move.t()],
    positions: [Position.t()],
    annotations: [Annotation.t()] | nil,
    time_control: String.t() | nil,
    termination: String.t() | nil,
    white_elo: integer() | nil,
    black_elo: integer() | nil,
    white_title: String.t() | nil,
    black_title: String.t() | nil
  }
end
```

### Position

```elixir
defmodule Blunderfest.Types.Position do
  @type t :: %__MODULE__{
    fen: String.t(),
    hash: integer(),
    game_id: integer(),
    move_number: integer(),
    ply: integer(),
    stats: stats() | nil
  }

  @type stats :: %{
    game_count: integer(),
    white_wins: integer(),
    black_wins: integer(),
    draws: integer(),
    white_win_rate: float(),
    black_win_rate: float(),
    draw_rate: float()
  }
end
```

### Player

```elixir
defmodule Blunderfest.Types.Player do
  @type t :: %__MODULE__{
    id: integer(),
    name: String.t(),
    elo: integer() | nil,
    title: String.t() | nil,
    country: String.t() | nil,
    birth_year: integer() | nil,
    stats: stats() | nil
  }

  @type stats :: %{
    total_games: integer(),
    wins: integer(),
    losses: integer(),
    draws: integer(),
    win_rate: float()
  }
end
```

### Move

```elixir
defmodule Blunderfest.Types.Move do
  @type t :: %__MODULE__{
    from: square(),
    to: square(),
    piece: piece(),
    captured: piece() | nil,
    promotion: piece() | nil,
    flags: flags(),
    san: String.t(),
    annotations: [Annotation.t()] | nil
  }

  @type square :: 0..63
  @type piece :: :king | :queen | :rook | :bishop | :knight | :pawn
  @type flags :: [:check, :double_check, :castling, :en_passant, :promotion]
end
```

### Opening

```elixir
defmodule Blunderfest.Types.Opening do
  @type t :: %__MODULE__{
    eco: String.t(),
    name: String.t(),
    detailed_code: String.t() | nil,
    position_hash: integer(),
    moves: [String.t()],
    stats: stats() | nil
  }

  @type stats :: %{
    game_count: integer(),
    white_wins: integer(),
    black_wins: integer(),
    draws: integer(),
    white_win_rate: float(),
    black_win_rate: float(),
    draw_rate: float(),
    popularity_rank: integer()
  }
end