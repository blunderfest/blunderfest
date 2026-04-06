# AGENTS.md - AI Agent Guidelines for Blunderfest

## Project Overview

Blunderfest is a high-performance, distributed chess database engine built with Elixir/Phoenix backend and React/TypeScript frontend.

## Technology Stack

### Backend
- **Language**: Elixir 1.17+
- **Framework**: Phoenix 1.7+
- **Database**: Custom binary format with hot/cold storage architecture
- **Architecture**: Hot storage (local SSD) + Cold storage (S3/MinIO) + PostgreSQL (metadata)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Package Manager**: PNPM
- **Styling**: Vanilla Extract (type-safe CSS-in-JS)
- **State Management**: Zustand
- **Data Fetching**: TanStack Query with ky HTTP client
- **Linting/Formatting**: Biome (with minimal ESLint for import path rules)
- **Import Aliases**: `~/` path alias (no relative imports)

## Project Structure (Umbrella)

```
blunderfest/
├── apps/
│   ├── blunderfest_core/     # Pure Elixir library
│   ├── blunderfest_api/      # Phoenix server (serves built React app)
│   └── blunderfest_ui/       # React app (built output goes to blunderfest_api/priv/static)
├── mix.exs
├── package.json              # Root package.json for PNPM workspace
└── pnpm-workspace.yaml       # PNPM workspace configuration
```

### Development Workflow

```bash
# Start Phoenix API server
cd apps/blunderfest_api && mix phx.server

# Start React dev server (in another terminal)
cd apps/blunderfest_ui && pnpm run dev
```

### Build Process

```bash
# Build React app (outputs to blunderfest_api/priv/static)
cd apps/blunderfest_ui && pnpm run build
```

## Development Guidelines

### Git Workflow

When making changes, provide the commit command for the user to execute:

```bash
# Example commit command to provide
git add . && git commit -m "type: description of changes"
```

**Commit message types:**
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### Vite Configuration

The Vite config must handle Phoenix integration properly:

```typescript
// apps/blunderfest_ui/vite.config.ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

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
		resolve: {
			alias: {
				"~": path.resolve(__dirname, "./src")
			}
		},
		build: {
			outDir: "../blunderfest_api/priv/static",
			sourcemap: true
		},
		server: {
			proxy: {
				"/api": "http://localhost:8080"
			}
		}
	};
});
```

### TypeScript Import Rules

**Always use absolute imports with `~/` alias:**

```typescript
// ✅ Good - using ~ prefix
import { useGameStore } from '~/stores/game-store';
import { Move, Position } from '~/types/chess';
import ChessBoard from '~/components/chess/board/chess-board';

// ❌ Bad - no relative imports
import { useGameStore } from '../../../stores/gameStore';
import { Move, Position } from '../../../types/chess';
```

### File Naming Convention

All files use **kebab-case**:

```
src/
├── components/
│   ├── chess/
│   │   ├── board/
│   │   │   ├── chess-board.tsx
│   │   │   └── index.ts
│   │   └── piece/
│   │       └── piece.tsx
│   └── features/
│       └── game-viewer/
│           └── game-viewer.tsx
├── stores/
│   └── game-store.ts
└── types/
    └── chess.ts
```

### Linting and Formatting

We use **Biome** for linting and formatting, with a minimal ESLint configuration for import path enforcement.

```json
// biome.json
{
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedImports": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    }
  }
}
```

```json
// .eslintrc.json (minimal - import path enforcement only)
{
  "plugins": ["no-relative-import-paths"],
  "rules": {
    "no-relative-import-paths/no-relative-import-paths": [
      "error",
      { "dirs": ["src"], "allowSameFolder": false }
    ]
  }
}
```

### Storage Architecture

**Hot/Cold Storage Separation:**

- **Hot Storage (Local SSD)**: Position index, player index, opening index, query cache, bloom filter
- **Cold Storage (S3/MinIO)**: Game data segments, backups, exports
- **Metadata Store (PostgreSQL)**: Shard map, node registry, WAL, API keys

### Database Architecture

**Single Shared Database Model:**
- One primary database with hot/cold storage separation
- Multiple API nodes connect to the same distributed system
- Use `Database.initialize()` for initial setup (admin only)
- Use `Database.connect()` for API nodes to connect

```elixir
# Admin/setup - initialize database once
{:ok, db} = Blunderfest.Database.initialize("s3://blunderfest-db/main")

# API nodes - connect to existing database
{:ok, db} = Blunderfest.Database.connect("s3://blunderfest-db/main")
```

### API Client (Frontend)

Use `ky` + `TanStack Query` (no axios):

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import ky from 'ky';

const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Use with TanStack Query
const { data } = useQuery({
  queryKey: ['game', id],
  queryFn: () => api.get(`games/${id}`).json()
});
```

## Architecture Documentation

All architecture documentation is in the `architecture/` directory:

### Core Architecture
- `01-system-overview.md` - System architecture with hot/cold storage
- `02-binary-format-specification.md` - .bchess segment format
- `03-api-design.md` - API specifications
- `04-scalability-performance.md` - Performance targets and NIF integration
- `05-deployment-guide.md` - Deployment instructions

### Technical Specifications
- `06-zobrist-hashing.md` - Position hashing
- `07-pgn-specification.md` - PGN parsing
- `08-opening-classification.md` - Opening codes
- `09-data-migration-guide.md` - Data migration
- `10-chess-rules-engine.md` - Chess logic
- `11-uci-integration.md` - Engine integration
- `12-react-ui-architecture.md` - Frontend architecture
- `13-security-testing.md` - Security and testing
- `99-implementation-plan.md` - Implementation timeline

### Advanced Topics
- `15-storage-architecture.md` - Hot/cold storage separation
- `16-distributed-system-design.md` - Consistent hashing, WAL, sharding
- `17-binary-format-evolution.md` - Versioning and migration

## Key Decisions

1. **No relative imports** - Using `~/` path alias
2. **Hot/Cold storage separation** - Local SSD for indexes, S3 for data
3. **Consistent hashing** - Primary sharding strategy
4. **Append-only segments** - Crash-safe writes via WAL
5. **Biome for linting** - Fast formatting with minimal ESLint

## Testing

- **Backend**: ExUnit with property-based testing
- **Frontend**: Jest + React Testing Library
- **E2E**: Playwright for critical user flows

## Performance Targets

| Operation | Target |
|-----------|--------|
| Position lookup (hot) | < 1ms |
| Game retrieval | < 5ms |
| Game search | < 100ms |
| Import speed | > 1000 games/sec |
| Concurrent users | > 10,000 |

## Questions?

Refer to the architecture documentation or ask for clarification before making significant changes.
