# Blunderfest Architecture Documentation

This directory contains the architectural decisions and technical specifications for the Blunderfest chess database engine.

## Quick Start

```bash
# Install dependencies
mix deps.get
cd assets && pnpm install && cd ..

# Start development server
mix phx.server
```

## Project Structure

```
blunderfest/
├── mix.exs                    # Single Phoenix application (non-umbrella)
├── config/
│   ├── config.exs              # Base configuration
│   ├── dev.exs                # Development config
│   ├── test.exs               # Test config
│   └── prod.exs               # Production config
├── lib/
│   ├── blunderfest.ex          # Main application module
│   └── blunderfest/           # Application code
│       ├── application.ex      # OTP application
│       ├── endpoint.ex        # Phoenix endpoint
│       ├── router.ex          # API router
│       └── telemetry.ex       # Metrics
├── assets/                    # React frontend
│   ├── src/                   # Frontend source
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── priv/                      # Private resources
│   └── static/               # Built assets
└── architecture/             # This directory
```

## Documents

### Core Architecture
1. **[01-system-overview.md](./01-system-overview.md)** - High-level system architecture
2. **[02-binary-format-specification.md](./02-binary-format-specification.md)** - Binary file format
3. **[03-api-design.md](./03-api-design.md)** - API design
4. **[04-scalability-performance.md](./04-scalability-performance.md)** - Performance optimization
5. **[05-deployment-guide.md](./05-deployment-guide.md)** - Deployment setup

### Technical Specifications
6. **[06-zobrist-hashing.md](./06-zobrist-hashing.md)** - Zobrist hashing
7. **[07-pgn-specification.md](./07-pgn-specification.md)** - PGN parsing
8. **[08-opening-classification.md](./08-opening-classification.md)** - Opening codes
9. **[09-data-migration-guide.md](./09-data-migration-guide.md)** - Data migration
10. **[10-chess-rules-engine.md](./10-chess-rules-engine.md)** - Chess rules
11. **[11-uci-integration.md](./11-uci-integration.md)** - UCI engines
12. **[12-react-ui-architecture.md](./12-react-ui-architecture.md)** - React UI
13. **[13-security-testing.md](./13-security-testing.md)** - Security
14. **[99-implementation-plan.md](./99-implementation-plan.md)** - Implementation plan

### Advanced Topics
15. **[15-storage-architecture.md](./15-storage-architecture.md)** - Storage design
16. **[16-distributed-system-design.md](./16-distributed-system-design.md)** - Distributed system
17. **[17-binary-format-evolution.md](./17-binary-format-evolution.md)** - Format versioning

### Implementation Guides
- **[14-nif-implementation.md](./14-nif-implementation.md)** - NIF integration
- **[14-stress-testing.md](./14-stress-testing.md)** - Stress testing
- **[14-search-algorithm.md](./14-search-algorithm.md)** - Search algorithms
- **[14-data-retention.md](./14-data-retention.md)** - Data retention

## Key Design Decisions

1. **Non-umbrella project** - Single Phoenix application (not umbrella)
2. **No relative imports** - Using `~/` path alias for absolute imports
3. **Hot/Cold storage separation** - Local SSD for indexes, S3 for data
4. **Consistent hashing** - Primary sharding strategy
5. **Append-only segments** - Crash-safe writes
6. **Biome for linting** - Fast formatting with minimal ESLint

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Elixir 1.17+, Phoenix 1.7+ |
| Database | Custom binary format |
| Frontend | React 19, TypeScript, Vite |
| Styling | Vanilla Extract |
| State | Zustand |
| HTTP | ky + TanStack Query |
