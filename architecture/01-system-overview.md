# System Overview

## Introduction

Blunderfest is a high-performance, distributed chess database engine. It provides fast game storage, position indexing, advanced search capabilities, and integrated analysis tools.

## System Architecture

```
+------------------------------------------------------------------+
|                         Client Layer                              |
|  +------------------+  +------------------+  +------------------+|
|  |   React 19 UI    |  |  Third-party     |  |  Mobile Apps     ||
|  |   (Web App)      |  |  API Clients     |  |  (Future)        ||
|  +--------+---------+  +--------+---------+  +--------+---------+|
|           |                     |                     |          |
+-----------|---------------------|---------------------|----------+
            | HTTP/REST           | WebSocket           |
            | JSON                | Binary              |
+-----------v---------------------v---------------------|----------+
|                         API Gateway                   |          |
|  +----------------------------------------------------|----------+
|  |  Load Balancer (nginx/HAProxy)                    |          |
|  |  - Request routing                                 |          |
|  |  - Rate limiting                                   |          |
|  |  - SSL termination                                 |          |
|  +----------------------------------------------------|----------+
|           |                     |                     |          |
+-----------|---------------------|---------------------|----------+
            |                     |                     |
+-----------v---------------------v---------------------v----------+
|                     Application Layer                            |
|  +------------------+  +------------------+  +------------------+|
|  |   API Nodes      |  |   API Nodes      |  |  Analysis Nodes  ||
|  |   (Phoenix)      |  |   (Phoenix)      |  |  (UCI Engines)   ||
|  +--------+---------+  +--------+---------+  +--------+---------+|
|           |                     |                     |          |
+-----------|---------------------|---------------------|----------+
            |                     |                     |
+-----------v---------------------v---------------------v----------+
|                      Storage Layer                               |
|  +------------------+  +------------------+  +------------------+|
|  |  Database Files  |  |  Position Index  |  |  Shared Storage  ||
|  |  (.bchess)       |  |  (.idx)          |  |  (S3/MinIO)      ||
|  +------------------+  +------------------+  +------------------+|
+------------------------------------------------------------------+
```

## Component Overview

### 1. Core Library (`blunderfest_core`)

The heart of the system - a pure Elixir library providing:

- **Binary Storage**: Custom file format optimized for chess data
- **Game Management**: Add, retrieve, delete, search games
- **Position Indexing**: Zobrist hashing for O(1) position lookup
- **PGN Support**: Import/export standard PGN files
- **Analysis Tools**: Statistics, opening classification, search

```
lib/blunderfest_core/
├── blunderfest.ex              # Main API entry point
├── database.ex                 # Database lifecycle management
├── game.ex                     # Game operations
├── position.ex                 # Position operations
├── player.ex                   # Player operations
├── storage/
│   ├── binary_format.ex        # Binary serialization
│   ├── file_manager.ex         # File I/O and memory mapping
│   ├── index.ex                # Index management
│   └── compression.ex          # Move compression
├── chess/
│   ├── board.ex                # Board representation
│   ├── move.ex                 # Move encoding/decoding
│   ├── fen.ex                  # FEN parsing/generation
│   ├── pgn.ex                  # PGN parser/generator
│   └── zobrist.ex              # Zobrist hashing
├── analysis/
│   ├── statistics.ex           # Position/game statistics
│   ├── opening.ex              # Opening classification
│   └── search.ex               # Advanced search
└── types/
    ├── game.ex                 # Game struct
    ├── position.ex             # Position struct
    └── player.ex               # Player struct
```

### 2. API Server (`blunderfest_api`)

Phoenix-based REST API with WebSocket support:

- **REST Endpoints**: CRUD operations for games, positions, players
- **WebSocket**: Real-time engine analysis, notifications
- **Authentication**: API key management (future)
- **Rate Limiting**: Protect against abuse
- **Telemetry**: Metrics and monitoring

```
lib/blunderfest_api/
├── router.ex                   # API routes
├── controllers/
│   ├── game_controller.ex
│   ├── position_controller.ex
│   ├── player_controller.ex
│   └── analysis_controller.ex
├── channels/
│   └── analysis_channel.ex     # WebSocket for engine analysis
├── telemetry.ex                # Metrics collection
└── middleware/
    ├── auth.ex                 # Authentication
    └── rate_limit.ex           # Rate limiting
```

### 3. React UI (`blunderfest_ui`)

Modern web interface built with React 19:

- **Board Viewer**: Interactive chessboard with move navigation
- **Game Browser**: Search and view games
- **Position Search**: Advanced position filtering
- **Opening Explorer**: Tree view with statistics
- **Analysis Board**: Engine integration with real-time updates

```
src/
├── components/
│   ├── Board/                  # Chessboard component
│   ├── GameViewer/             # Game playback
│   ├── MoveList/               # Move notation display
│   ├── PositionSearch/         # Search interface
│   ├── OpeningTree/            # Opening explorer
│   └── AnalysisBoard/          # Engine analysis
├── hooks/                      # Custom React hooks
├── services/                   # API client
├── stores/                     # State management
└── types/                      # TypeScript definitions
```

## Data Flow

### Game Import Flow

```
PGN File
    |
    v
+-------+
|  API  | --validate--> +--------+
+-------+               | Parser |
    |                   +--------+
    v                        |
+--------+                   v
| Core   | <---encode---- +--------+
| DB     |               | Compress |
+--------+               +--------+
    |
    v
+--------+
| Binary |
| Format |
+--------+
    |
    v
+--------+
| Index  |
| Update |
+--------+
    |
    v
Storage (.bchess file)
```

### Position Search Flow

```
Search Query (FEN/Criteria)
    |
    v
+-------+
|  API  |
+-------+
    |
    v
+--------+
| Core   | --hash--> +--------+
| Search |           | Zobrist|
+--------+           +--------+
    |                     |
    v                     v
+--------+           +--------+
| Index  | <-------- | Lookup |
+--------+           +--------+
    |
    v
+--------+
| Filter |
+--------+
    |
    v
Results (Game IDs + Stats)
```

### Analysis Flow

```
Position (FEN) + Engine Settings
    |
    v
+-------+
|  API  | --WebSocket--> Client
+-------+
    |
    v
+--------+
| Engine |
| Pool   |
+--------+
    |
    v
+-----+
| UCI |
|Engine|
+-----+
    |
    v
Analysis Results (PV, Score, Depth)
    |
    v
+--------+
| Cache  | --store--> Storage
+--------+
    |
    v
WebSocket --> Client (real-time updates)
```

## Distributed Architecture

### Single Node Deployment

```
+----------------------------------+
|          Single Node             |
|  +----------------------------+  |
|  |    Phoenix API Server      |  |
|  |    (Port 8080)             |  |
|  +-------------+--------------+  |
|                |                 |
|  +-------------v--------------+  |
|  |   Blunderfest Core         |  |
|  |   - Database Engine        |  |
|  |   - Position Index         |  |
|  |   - Search Engine          |  |
|  +-------------+--------------+  |
|                |                 |
|  +-------------v--------------+  |
|  |   Storage Layer            |  |
|  |   - .bchess files          |  |
|  |   - .idx files             |  |
|  |   - ETS caches             |  |
|  +----------------------------+  |
+----------------------------------+
```

### Multi-Node Cluster

```
+--------------------------------------------------+
|                  Load Balancer                   |
|              (nginx/HAProxy)                     |
+-----------------------+--------------------------+
                        |
        +---------------+---------------+
        |               |               |
+-------v-------+ +-----v-------+ +-----v-------+
|   Node 1      | |   Node 2    | |   Node 3    |
|   (API+DB)    | |   (API+DB)  | |   (Analysis)|
|   Shard A-E   | |   Shard F-J | |   Engine    |
|               | |             | |   Pool      |
+-------+-------+ +-----+-------+ +-----+-------+
        |               |               |
        +---------------+---------------+
                        |
                +-------v-------+
                | Shared Storage|
                |   (S3/MinIO)  |
                +---------------+
```

### Sharding Strategy

Games are distributed across nodes based on:

1. **ECO Code Sharding**: Games grouped by opening classification
   - Node 1: A00-B99
   - Node 2: C00-D99
   - Node 3: E00-E99 + unclassified

2. **Date Sharding**: Games grouped by year
   - Node 1: Pre-2000
   - Node 2: 2000-2010
   - Node 3: 2011-present

3. **Hash-based Sharding**: Consistent hashing for even distribution

## Technology Choices

### Why Elixir?

- **Concurrency**: Lightweight processes handle thousands of simultaneous operations
- **Fault Tolerance**: OTP supervision trees for resilience
- **Performance**: BEAM VM optimized for I/O-bound operations
- **Distribution**: Built-in support for clustering

### Why Custom Binary Format?

- **Performance**: Optimized specifically for chess data
- **Size**: Better compression than generic formats
- **Speed**: Memory-mapped access for fast queries
- **Control**: Full control over optimization and evolution

### Why React (not LiveView)?

- **Rich UI**: Chessboard interactions require complex state management
- **Ecosystem**: Mature chess UI libraries
- **Performance**: Client-side rendering for responsive UI
- **Flexibility**: Easier to build complex interactive features

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Position lookup | < 1ms | Indexed positions |
| Game retrieval | < 5ms | By ID |
| Game search | < 100ms | Typical query |
| Import speed | > 1000 games/sec | Bulk import |
| Concurrent users | > 10,000 | Per node |
| Database size | > 100M games | Single file |

## Security Considerations

- **API Authentication**: API keys for write operations
- **Rate Limiting**: Prevent abuse of search/analysis
- **Input Validation**: Sanitize PGN/FEN input
- **Resource Limits**: Prevent memory exhaustion
- **File Permissions**: Restrict database file access

## Monitoring and Observability

- **Telemetry**: Built-in metrics for all operations
- **Logging**: Structured logging with metadata
- **Health Checks**: Database and API health endpoints
- **Metrics Export**: Prometheus-compatible metrics
- **Distributed Tracing**: Request tracking across nodes