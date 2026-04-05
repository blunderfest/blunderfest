# Blunderfest - Chess Analysis Platform

## Project Overview

A collaborative chess analysis platform where users can analyze chess games alone or with others. The application supports flexible, unstructured analysis without enforcing strict chess rules.

### Stack

- Backend: Elixir + Phoenix
- Frontend: React + TypeScript
- Database: PostgreSQL + Apache AGE
- Deployment: Docker + Fly.io

---

## Core Decisions

### 1. Architecture

```
React Frontend (TypeScript)
        |
   Phoenix Channels (WebSocket)
        |
Elixir/Phoenix Backend
        |
   PostgreSQL + Apache AGE (Graph)
```

### 2. REST API + WebSockets

Both REST API and Phoenix Channels are used:

- **REST API**: CRUD operations for users, rooms, positions, annotations
- **WebSockets**: Real-time collaboration in analysis rooms
- Rationale: Clean separation of concerns, better caching, SEO-friendly

### 3. No Standard Chess Libraries

The core analysis is built from scratch using custom Elixir modules:

- Custom piece movement logic
- Custom position representation
- Bitboard-based operations
- Flexible "unstructured" analysis mode

This allows:

- Free-form position exploration
- Custom annotations (text, arrows, highlights)
- Non-standard positions for discussion

### 4. Bitboards

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

### 5. Apache AGE (Graph Database)

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

### 6. Similarity Search

Multiple search modes using graph edges:

| Mode               | Edge Type      | Description                      |
| ------------------ | -------------- | -------------------------------- |
| **Exact**          | (exact match)  | Traditional FEN matching         |
| **Color Reversed** | COLOR_REVERSED | White ↔ Black swapped            |
| **Pawn Structure** | SIMILAR_TO     | Only pawn positions compared     |
| **Fuzzy Match**    | SIMILAR_TO     | Piece displacement tolerance     |
| **Pattern**        | SIMILAR_TO     | Abstract patterns (e.g., K+Q vs) |

**Similarity Metrics:**

- Hamming distance for piece placement
- Jaccard index for pawn structure intersection
- Cosine similarity for material counts
- Weighted scoring (pawns: 30%, pieces: 30%, position: 40%)

### 7. Stockfish Integration

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

### 8. Collaboration Features

**Room System:**

- Create/join analysis rooms with unique codes
- Real-time board synchronization via WebSockets
- Cursor/selection presence indicators
- In-room chat
- Spectator mode

**Technology:** Phoenix Channels + Presence

### 9. User Access

- **Anonymous access**: Full functionality without login
- **Optional Google OAuth**: Via Ueberauth
- **Guest identifier**: Random or user-provided name
- **No sensitive data**: No email stored; OAuth tokens handled server-side only

---

## Technology Stack

### Backend

| Component     | Technology | Version | Notes               |
| ------------- | ---------- | ------- | ------------------- |
| Language      | Elixir     | latest  | Verify on implement |
| Web Framework | Phoenix    | latest  | Verify on implement |
| Database      | PostgreSQL | latest  | With AGE extension  |
| Graph DB      | Apache AGE | latest  | Verify on implement |
| ORM           | Ecto       | latest  | Ships with Phoenix  |
| REST API      | Phoenix    | latest  | Built into Phoenix  |
| Real-time     | Phoenix    | latest  | Channels, built-in  |
| Auth          | Ueberauth  | latest  | OAuth strategy      |

### Frontend

| Component        | Technology      | Version | Notes               |
| ---------------- | --------------- | ------- | ------------------- |
| Language         | TypeScript      | latest  | Verify on implement |
| UI Framework     | React           | latest  | Verify on implement |
| Build Tool       | Vite            | latest  | Verify on implement |
| Package Manager  | pnpm            | latest  | Verify on implement |
| State Management | Zustand         | latest  | Verify on implement |
| HTTP Client      | Fetch API       | native  | No library needed   |
| Chess Display    | Custom SVG      | -       | Built from scratch  |
| Stockfish        | stockfish.js    | latest  | WASM chess engine   |
| Styling          | Vanilla Extract | latest  | Type-safe CSS       |

### Development Tools

| Component        | Technology   | Version              | Notes             |
| ---------------- | ------------ | -------------------- | ----------------- |
| Container        | Docker       | Latest, devcontainer |
| Dev Environment  | devcontainer | -                    | Config exists     |
| Linting (Elixir) | Credo        | latest               | Elixir standard   |
| Formatting       | Elixir fmt   | Built-in             | -                 |
| Linting (JS/TS)  | Biome        | latest               | All-in-one        |
| Formatting       | Biome        | latest               | Built-in Biome    |
| Testing (JS/TS)  | Vitest       | latest               | Fast, Vite-native |

---

## Developer Experience

### Local Development

All development takes place inside a **devcontainer**. This ensures consistency across team members.

```bash
# Open in VS Code
# Press F1 → "Reopen in Container"
# Wait for container to build

# Start Phoenix backend
mix deps.get
mix phx.server

# Start React frontend (in separate terminal)
cd assets
pnpm install
pnpm dev
```

**Hot Reloading:** Both Phoenix (Elixir) and Vite (React) support hot reloading for rapid development.

### Vite Configuration

Vite is started automatically by Phoenix when using the dev.exs watcher config. To ensure Vite exits when Phoenix exits, use this `vite.config.ts`:

```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
	const isDev = command !== "build";
	if (isDev) {
		// Terminate the watcher when Phoenix quits
		process.stdin.on("close", () => {
			process.exit(0);
		});

		process.stdin.resume();
	}

	return {
		plugins: [react()],
		build: {
			outDir: "../priv/static",
			emptyOutDir: true,
		},
	};
});
```

Add to `config/dev.exs` watchers:

```elixir
watchers: [
  node: [
    "node_modules/.bin/vite",
    "--host",
    cd: Path.expand("../assets", __DIR__)
  ]
]
```

### Code Generation

| Command               | Description               |
| --------------------- | ------------------------- |
| `mix phx.gen.json`    | Generate JSON API context |
| `mix phx.gen.html`    | Generate HTML controller  |
| `mix phx.gen.channel` | Generate Channel          |
| `pnpm create vite`    | Create Vite project       |

### Debugging

- **Elixir:** `IEx.pry`, :debugger, :observer
- **React:** Browser DevTools, React Developer Tools
- **Phoenix:** `mix phx.routes`, Phoenix Inspector

### Code Quality

```bash
# Elixir
mix credo --strict
mix format

# JavaScript/TypeScript
biome check --write    # Lint + format
biome check          # Check only
```

### Pre-commit Hooks

Configure in `.vscode/settings.json`:

- Biome format on save (TypeScript)
- `mix format` on save (Elixir)

---

## MVP Decisions

### Database Seeding

**Decision:** Start empty. No pre-seeding.

- Users create positions as they analyze
- Later, we can import PGN files from Lichess or similar
- Pre-seeding adds complexity and storage costs before we have users

### Import/Export

**Decision:** Minimal MVP support.

- **Export**: Copy FEN to clipboard (simple)
- **Import**: Paste PGN/FEN into room
- Full PGN parsing deferred - users can use lichess.org for now

### Testing

**Decision:** Standard tools.

- **Elixir**: ExUnit + doctests for chess core functions
- **React**: Vitest for components + hooks
- Manual testing is acceptable during MVP phase

### Cost

**Decision:** Free tier to start.

- Start with Fly.io free tier (includes)
- Scale up only when needed
- PostgreSQL: Neon free tier or cheap Postgres host

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
+=====================================================+
|           Blunderfest Position Cluster              |
|                                                     |
|  +---------+   +---------+   +---------+         |
|  | Node 1 |   | Node 2 |   | Node 3 |   ...   |
|  | (ETS)  |   | (ETS)  |   | (ETS)  |         |
|  +----+----+   +----+----+   +----+----+         |
|       |             |             |                |
|       +-------------+-------------+               |
|                     |                             |
|            +--------+--------+                    |
|            |  gossip protocol |                    |
|            |  (libcluster)   |                    |
|            +-----------------+                    |
+=====================================================+
```

**Components:**

| Component            | Implementation  | Purpose                 |
| -------------------- | --------------- | ----------------------- |
| **Position Store**   | ETS (in-memory) | O(1) lookup by FEN      |
| **Similarity Index** | VP-Tree         | O(log n) fuzzy search   |
| **Move Graph**       | ETS with edges  | From → to connections   |
| **Persistence**      | WAL + Snapshots | Durability without DB   |
| **Clustering**       | libcluster      | Multi-node coordination |

**Persistence Strategy:**

```
+---------------------------------------+
|         Custom In-Memory Store        |
|                                        |
|  +---------+    +-----------------+    |
|  |  ETS   |--> |  Write-Ahead    |    |
|  |(fast) |    |  Log (durable) |    |
|  +-------+    +-----------------+    |
|       |                 |            |
|       |        +--------+--------+    |
|       |        ▼                 |    |
|       |  Periodic Snapshot      |    |
|       |        │                 |    |
|       +--------+-----------------+    |
|              (recover from log)        |
+---------------------------------------+
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

1. Set up React frontend with Vite + TypeScript + pnpm + Vanilla Extract
2. Set up devcontainer for consistent dev experience
3. Create custom chess board component (SVG-based)
4. Implement Elixir chess core (position, bitboards)
5. Add FEN serialization/deserialization
6. Configure PostgreSQL + Apache AGE

### Phase 2: Analysis Features

7. Custom move generation (with optional validation)
8. Pawn structure analysis (bitboard functions)
9. Fingerprint generation for positions
10. AGE vertex creation for positions

### Phase 3: Graph Search

11. Create MOVE edges between positions
12. Build SIMILARITY edge generation (background job)
13. Cypher query API for position search
14. Color reversal and fuzzy matching via edges

### Phase 4: Collaboration

15. Phoenix Channels for rooms
16. Real-time board sync
17. Presence indicators
18. Chat and spectator mode

### Phase 5: Enhancements

19. Stockfish WASM integration (optional)
20. Google OAuth authentication (no email storage)
21. UI polish and responsive design

---

## Modules Structure

### Backend (Elixir)

```
lib/blunderfest/
├── chess/
│   ├── position.ex          # Position struct and representation
│   ├── bitboards.ex        # Bitboard operations
│   ├── moves.ex            # Move generation
│   ├── validation.ex     # Optional move validation
│   ├── fen.ex             # FEN serialization
│   ├── fingerprint.ex    # Position fingerprints for search
│   ├── similarity.ex     # Similarity scoring algorithms
│   └── pawns.ex          # Pawn structure analysis
├── graph/
│   ├── age.ex             # AGE Cypher query wrapper
│   ├── position.ex        # Graph vertex operations
│   ├── edge_builder.ex   # Similarity edge generation
│   └── queries.ex        # Common Cypher queries
├── accounts/
│   ├── user.ex           # User schema (no email)
│   └── auth.ex           # Authentication (OAuth)
├── analysis/
│   ├── room.ex           # Analysis room
│   └── annotation.ex     # Position annotations
└── web/
    ├── channels/        # Phoenix Channels
    ├─ controllers/   # REST API controllers
    └── routers/      # Router
```

### Frontend (React)

```
assets/src/
├── components/
│   ├── ChessBoard/      # Custom SVG board
│   ├── AnalysisPanel/    # Move list, annotations
│   └── Room/           # Collaboration UI
├── hooks/
│   ├── useChess/       # Chess logic hook
│   └── useStockfish.ts# Optional engine hook
├── lib/
│   ├── chess.ts        # Frontend position logic
│   └── similarity.ts   # Similarity calculations
├── styles/
│   └── *.css.ts       # Vanilla Extract styles
└── stores/
    └── gameStore.ts    # Zustand store
```

---

## Database Schema

### PostgreSQL Tables (Relational)

#### users

| Column       | Type      | Description             |
| ------------ | --------- | ----------------------- |
| id           | UUID      | Primary key             |
| guest_name   | string    | For anonymous users     |
| provider     | string    | "anonymous" or "google" |
| provider_uid | string    | OAuth provider ID       |
| created_at   | timestamp |                         |

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

#### Vertices: Position

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
       |
       v
+--------------+
| React Frontend|
+--------------+
       | HTTP/WebSocket
       v
+----------------------------+
|    Phoenix Backend         |
|  +----------+ +----------+ |
|  |  Ecto    | |  AGE     | |
|  |  Tables | |  Graph  | |
|  +----------+ +----------+ |
+----------------------------+
       |
   +---+---+
   |       |
PostgreSQL + AGE
(One database!)
```

---

## Future Topics (Deferred)

These topics are not required for MVP and can be revisited later:

- **Mobile**: Responsive design, touch interactions
- **Rate Limiting**: Anonymous user limits
- **Analytics**: Usage tracking, popular positions
- **AI Features**: LLM-powered analysis notes
- **Tournaments**: Live analysis sessions
- **Version History**: Undo/redo for annotations
- **Accessibility**: Screen reader support, keyboard navigation
- **Moderation**: Content moderation for shared rooms
- **Data Retention**: How long to keep anonymous sessions
- **Performance**: Caching, background workers

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
