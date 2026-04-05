# Blunderfest - Chess Analysis Platform

## Project Overview

A collaborative chess analysis platform where users can analyze chess games alone or with others. The application supports flexible, unstructured analysis without enforcing strict chess rules.

**Stack:**

- Backend: Elixir + Phoenix (WebSocket for real-time)
- Frontend: React + TypeScript
- Database: PostgreSQL + Apache AGE (graph extension)
- Deployment: Docker + Fly.io

---

## Core Decisions

### 1. Architecture

```
React Frontend (TypeScript)
        │
   Phoenix Channels (WebSocket)
        │
Elixir/Phoenix Backend
        │
   PostgreSQL + Apache AGE (Graph)
```

### 2. No Standard Chess Libraries

The core analysis is built from scratch using custom Elixir modules:

- Custom piece movement logic
- Custom position representation
- Bitboard-based operations
- Flexible "unstructured" analysis mode

This allows:

- Free-form position exploration
- Custom annotations (text, arrows, highlights)
- Non-standard positions for discussion

### 3. Bitboards

Bitboards are used for:

- **Position storage**: 64-bit integers representing piece locations
- **Pawn analysis**: Doubled, isolated, passed pawn detection
- **Similarity search**: Fast comparison between positions
- **Attack maps**: Piece mobility calculations

```elixir
%{
  white_pawns:   0x000000000000FF00,
  white_knights: 0x0000000000000042,
  ...
}
```

### 4. Apache AGE (Graph Database)

**PostgreSQL with Apache AGE extension** provides graph capabilities without extra infrastructure:

- Vertices store positions with all metadata
- Edges connect positions via moves (MOVE edges)
- Pre-computed similarity edges (SIMILAR_TO, COLOR_REVERSED)
- Cypher query language (same as Neo4j)
- Full ACID guarantees from PostgreSQL

**Graph Schema:**

```cypher
(:Position {
  fen: string,
  fingerprint_exact: string,
  fingerprint_pawn: string,
  evaluation: integer,
  best_move: string,
  created_at: datetime
})

(:Position)-[:MOVE {san, uci, move_number, comment}]->(:Position)
(:Position)-[:SIMILAR_TO {weight, similarity_type}]->(:Position)
(:Position)-[:COLOR_REVERSED {weight}]->(:Position)
```

### 5. Similarity Search

Multiple search modes using graph edges:

| Mode               | Edge Type         | Description                      |
| ------------------ | ----------------- | -------------------------------- |
| **Exact**          | (exact match)     | Traditional FEN matching         |
| **Color Reversed** | COLOR_REVERSED    | White ↔ Black swapped            |
| **Pawn Structure** | SIMILAR_TO (pawn) | Only pawn positions compared     |
| **Fuzzy Match**    | SIMILAR_TO        | Piece displacement tolerance     |
| **Pattern**        | SIMILAR_TO        | Abstract patterns (e.g., K+Q vs) |

**Similarity Metrics:**

- Hamming distance for piece placement
- Jaccard index for pawn structure intersection
- Cosine similarity for material counts
- Weighted scoring (pawns: 30%, pieces: 30%, position: 40%)

**Query Example:**

```cypher
MATCH (p:Position {fen: $fen})-[s:SIMILAR_TO]-(related)
WHERE s.weight > 0.7
RETURN related.fen, s.weight
ORDER BY s.weight DESC
LIMIT 20
```

### 6. Stockfish Integration

Stockfish WASM is **optional**, not core:

- Only loads when user explicitly requests analysis
- Runs client-side (no server cost)
- Provides evaluation in centipawns
- Shows best move suggestions

Users can still:

- Explore moves manually
- Add annotations
- Search similar positions (via AGE graph)
- Collaborate in real-time

### 7. Collaboration Features

**Room System:**

- Create/join analysis rooms with unique codes
- Real-time board synchronization
- Cursor/selection presence indicators
- In-room chat
- Spectator mode

**Technology:** Phoenix Channels + Presence

### 8. User Access

- **Anonymous access**: Full functionality without login
- **Optional Google OAuth**: Via Ueberauth
- **Guest identifier**: Random or user-provided name

---

## Technology Stack

### Backend

| Component      | Technology       | Version | Notes                |
| -------------- | ---------------- | ------- | -------------------- |
| Language       | Elixir           | 1.16+   | Latest stable        |
| Web Framework  | Phoenix          | 1.7+    | Latest stable        |
| Database       | PostgreSQL       | 15+     | With AGE extension   |
| Graph DB       | Apache AGE       | 1.5+    | PostgreSQL extension |
| ORM            | Ecto             | 3.10+   | Ships with Phoenix   |
| Real-time      | Phoenix Channels | 1.7+    | Built into Phoenix   |
| Authentication | Ueberauth        | 0.10+   | OAuth strategy       |

### Frontend

| Component        | Technology   | Version | Notes                  |
| ---------------- | ------------ | ------- | ---------------------- |
| Language         | TypeScript   | 5.3+    | Latest stable          |
| UI Framework     | React        | 18+     | Latest stable          |
| Build Tool       | Vite         | 5+      | Fast builds            |
| State Management | Zustand      | 4+      | Simple, React-friendly |
| HTTP Client      | Fetch API    | Native  | No library needed      |
| Chess Display    | Custom SVG   | -       | Built from scratch     |
| Stockfish        | stockfish.js | Latest  | WASM chess engine      |
| Styling          | Tailwind CSS | 3+      | Already configured     |

### Development Tools

| Component           | Technology | Version  | Notes             |
| ------------------- | ---------- | -------- | ----------------- |
| Container           | Docker     | Latest   | For deployment    |
| Hosting             | Fly.io     | -        | Config exists     |
| Linting (Elixir)    | Credo      | 1.7+     | Elixir standard   |
| Formatting (Elixir) | Elixir fmt | Built-in | -                 |
| Linting (JS/TS)     | ESLint     | 8+       | -                 |
| Formatting (JS/TS)  | Prettier   | 3+       | Already in VSCode |
| Testing (Elixir)    | ExUnit     | Built-in | -                 |
| Testing (JS/TS)     | Vitest     | Latest   | Fast, Vite-native |

---

## Developer Experience

### Local Development

```bash
# Start dev environment (existing)
docker-compose up -d

# Start Phoenix backend
mix deps.get
mix phx.server

# Start React frontend (in separate terminal)
cd assets
npm install
npm run dev
```

**Hot Reloading:** Both Phoenix (Elixir) and Vite (React) support hot reloading for rapid development.

### Code Generation

| Command                | Description               |
| ---------------------- | ------------------------- |
| `mix phx.gen.json`     | Generate JSON API context |
| `mix phx.gen.channels` | Generate Channels         |
| `npx create-react-app` | Not needed (use Vite)     |
| `npx vitest`           | Run tests                 |

### Debugging

- **Elixir:** `IEx.pry`, :debugger, :observer
- **React:** Browser DevTools, React Developer Tools
- **Phoenix:** `mix phx.routes`, Phoenix Inspector

### Code Quality

```bash
# Elixir
mix credo --strict    # Linting
mix format           # Formatting

# JavaScript/TypeScript
npm run lint         # ESLint
npm run format       # Prettier

# Tests
mix test             # Elixir
npm run test         # Vitest
```

### Pre-commit Hooks

Recommend configuring:

- `mix format` on save (Elixir)
- Prettier on save (TypeScript)
- ESLint before commit (TypeScript)

---

## Alternative Database Approach (Future Consideration)

_This section documents a potential future alternative to the PostgreSQL + AGE approach._

### Custom In-Memory Database with Persistence

For scenarios requiring maximum performance and custom indexing:

**Requirements:**

- Millions of positions
- Multi-node cluster
- Data persistence required (no data loss acceptable)

**Architecture:**

```
┌─────────────────────────────────────────────────────┐
│           Blunderfest Position Cluster              │
│                                                     │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐         │
│  │ Node 1  │   │ Node 2  │   │ Node 3  │   ...   │
│  │ (ETS)   │   │ (ETS)   │   │ (ETS)   │         │
│  └────┬────┘   └────┬────┘   └────┬────┘         │
│       │             │             │                │
│       └─────────────┼─────────────┘               │
│                     │                             │
│            ┌────────┴────────┐                    │
│            │  gossip protcol │                    │
│            │  (libcluster)   │                    │
│            └─────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

**Components:**

| Component            | Implementation      | Purpose                 |
| -------------------- | ------------------- | ----------------------- |
| **Position Store**   | ETS (in-memory)     | O(1) lookup by FEN      |
| **Similarity Index** | VP-Tree             | O(log n) fuzzy search   |
| **Move Graph**       | ETS with edges      | From → to connections   |
| **Persistence**      | WAL + Snapshots     | Durability without DB   |
| **Clustering**       | libcluster (gossip) | Multi-node coordination |

**Persistence Strategy:**

```
┌───────────────────────────────────────┐
│         Custom In-Memory Store        │
│                                        │
│  ┌─────────┐    ┌─────────────────┐  │
│  │  ETS    │───▶│  Write-Ahead    │  │
│  │ (fast)  │    │  Log (durable)  │  │
│  └─────────┘    └─────────────────┘  │
│       │                 │            │
│       │        ┌────────┴────────┐    │
│       │        ▼                 │    │
│       │  Periodic Snapshot      │    │
│       │        │                 │    │
│       └────────┴─────────────────┘    │
│              (recover from log)        │
└───────────────────────────────────────┘
```

**Pros:**

- In-memory speed (orders of magnitude faster)
- Custom similarity indexing built-in
- Full control over data structures
- Horizontal scaling via more nodes

**Cons:**

- No standard query language
- Requires significant development effort
- More complex than PostgreSQL

**Status:** Deferred - to be revisited when ready

---

## Implementation Roadmap

### Phase 1: Foundation

1. Set up React frontend with Vite + TypeScript
2. Create custom chess board component (SVG-based)
3. Implement Elixir chess core (position, bitboards)
4. Add FEN serialization/deserialization
5. Configure PostgreSQL + Apache AGE

### Phase 2: Analysis Features

6. Custom move generation (with optional validation)
7. Pawn structure analysis (bitboard functions)
8. Fingerprint generation for positions
9. AGE vertex creation for positions

### Phase 3: Graph Search

10. Create MOVE edges between positions
11. Build SIMILARITY edge generation (background job)
12. Cypher query API for position search
13. Color reversal and fuzzy matching via edges

### Phase 4: Collaboration

14. Phoenix Channels for rooms
15. Real-time board sync
16. Presence indicators
17. Chat and spectator mode

### Phase 5: Enhancements

18. Stockfish WASM integration (optional)
19. Google OAuth authentication
20. UI polish and responsive design

---

## Modules Structure

### Backend (Elixir)

```
lib/blunderfest/
├── chess/
│   ├── position.ex        # Position struct and representation
│   ├── bitboards.ex       # Bitboard operations
│   ├── moves.ex           # Move generation
│   ├── validation.ex      # Optional move validation
│   ├── fen.ex             # FEN serialization
│   ├── fingerprint.ex     # Position fingerprints for search
│   ├── similarity.ex      # Similarity scoring algorithms
│   └── pawns.ex           # Pawn structure analysis
├── graph/
│   ├── age.ex             # AGE Cypher query wrapper
│   ├── position.ex        # Graph vertex operations
│   ├── edge_builder.ex   # Similarity edge generation
│   └── queries.ex        # Common Cypher queries
├── accounts/
│   ├── user.ex            # User schema
│   └── auth.ex            # Authentication (OAuth)
├── analysis/
│   ├── room.ex            # Analysis room
│   └── annotation.ex      # Position annotations
└── web/
    ├── channels/         # Phoenix Channels
    └── controllers/      # HTTP controllers
```

### Frontend (React)

```
assets/src/
├── components/
│   ├── ChessBoard/       # Custom SVG board
│   ├── AnalysisPanel/    # Move list, annotations
│   └── Room/             # Collaboration UI
├── hooks/
│   ├── useChess/         # Chess logic hook
│   └── useStockfish.ts  # Optional engine hook
├── lib/
│   ├── chess.ts          # Frontend position logic
│   └── similarity.ts     # Similarity calculations
└── stores/
    └── gameStore.ts      # State management (Zustand)
```

---

## Database Schema

### PostgreSQL Tables (Relational)

#### users

| Column     | Type      | Description         |
| ---------- | --------- | ------------------- |
| id         | UUID      | Primary key         |
| email      | string    | For OAuth           |
| guest_name | string    | For anonymous users |
| created_at | timestamp |                     |

#### rooms

| Column       | Type      | Description           |
| ------------ | --------- | --------------------- |
| id           | UUID      | Primary key           |
| code         | string    | Join code             |
| position     | jsonb     | Current room position |
| participants | jsonb     | User list             |
| created_at   | timestamp |                       |

#### annotations

| Column      | Type   | Description            |
| ----------- | ------ | ---------------------- |
| id          | UUID   | Primary key            |
| position_id | UUID   | Graph vertex ID        |
| type        | enum   | text, arrow, highlight |
| content     | string | Annotation data        |
| user_id     | UUID   | Author                 |

### Apache AGE Graph

#### Vertices: :Position

| Property          | Type     | Description                |
| ----------------- | -------- | -------------------------- |
| fen               | string   | Full FEN                   |
| fingerprint_exact | string   | Piece placement only       |
| fingerprint_pawn  | string   | Pawn structure             |
| piece_bitboards   | map      | Individual piece bitboards |
| evaluation        | integer  | Centipawns (if analyzed)   |
| best_move         | string   | UCI format                 |
| created_at        | datetime |                            |

#### Edges

| Edge Type       | From → To  | Properties                            |
| --------------- | ---------- | ------------------------------------- |
| :MOVE           | Pos → Pos  | san, uci, move_number, comment        |
| :SIMILAR_TO     | Pos → Pos  | weight (0.0-1.0), similarity_type     |
| :COLOR_REVERSED | Pos → Pos  | weight                                |
| :ANNOTATED_BY   | Pos → User | text, arrow_from, arrow_to, highlight |

---

## Data Flow

```
User Analysis
       │
       ▼
┌──────────────────┐
│   React Frontend │
└────────┬─────────┘
         │ HTTP/WebSocket
         ▼
┌────────────────────────────┐
│    Phoenix Backend         │
│  ┌──────────┐ ┌──────────┐ │
│  │  Ecto    │ │  AGE     │ │
│  │  Tables  │ │  Graph   │ │
│  └──────────┘ └──────────┘ │
└────────┬───────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
PostgreSQL + AGE
(One database!)
```

---

## Open Questions / Topics Not Yet Discussed

1. **Database Population**: How to seed with master games for position search?
2. **Import/Export**: PGN import, game sharing, export formats?
3. **Performance**: Caching strategies, background workers for similarity edge building?
4. **Mobile**: Responsive design priorities, touch interactions?
5. **Rate Limiting**: Anonymous user limits, resource management?
6. **Analytics**: Usage tracking, popular positions?
7. **AI Features**: Beyond Stockfish - LLM-powered analysis notes?
8. **Tournaments**: Live analysis sessions with multiple participants?
9. **Version History**: Undo/redo for annotations?
10. **Accessibility**: Screen reader support, keyboard navigation?
11. **Moderation**: Content moderation for shared rooms?
12. **Data Retention**: How long to keep anonymous sessions?
13. **Cost**: Fly.io resource estimation and budget?
14. **Testing**: Chess logic test suite strategy?
15. **Security**: Input sanitization, room access controls?

---

## References

- Apache AGE: https://age.apache.org/
- FEN Notation: https://www.chess.com/terms/fen-chess
- Bitboards: https://www.chessprogramming.org/Bitboards
- Phoenix Channels: https://hexdocs.pm/phoenix/Phoenix.Channel.html
- Stockfish WASM: https://github.com/nmrugg/stockfish.js/
- ETS: https://www.erlang.org/doc/man/ets.html
- libcluster: https://hex.pm/packages/libcluster

---

_Last updated: 2026-04-05_
