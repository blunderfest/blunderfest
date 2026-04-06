# Blunderfest Architecture Documentation

This directory contains the architectural decisions and technical specifications for the Blunderfest chess database engine.

## Documents

### Core Architecture
1. **[01-system-overview.md](./01-system-overview.md)** - High-level system architecture and component overview
2. **[02-binary-format-specification.md](./02-binary-format-specification.md)** - Detailed binary file format specification
3. **[03-api-design.md](./03-api-design.md)** - API design for both core library and REST API
4. **[04-scalability-performance.md](./04-scalability-performance.md)** - Scalability targets and performance optimization strategies
5. **[05-deployment-guide.md](./05-deployment-guide.md)** - Deployment architecture and infrastructure setup

### Technical Specifications
6. **[06-zobrist-hashing.md](./06-zobrist-hashing.md)** - Zobrist hashing for position indexing
7. **[07-pgn-specification.md](./07-pgn-specification.md)** - PGN parsing and generation
8. **[08-opening-classification.md](./08-opening-classification.md)** - ECO code and opening classification system
9. **[09-data-migration-guide.md](./09-data-migration-guide.md)** - Migration from external formats
10. **[10-chess-rules-engine.md](./10-chess-rules-engine.md)** - Chess move generation and validation
11. **[11-uci-integration.md](./11-uci-integration.md)** - UCI engine integration for analysis
12. **[12-react-ui-architecture.md](./12-react-ui-architecture.md)** - React UI architecture and components
13. **[13-security-testing.md](./13-security-testing.md)** - Security and testing specifications
14. **[99-implementation-plan.md](./99-implementation-plan.md)** - Phased implementation plan

### Advanced Topics (NEW - Address Critical Review Issues)
15. **[15-storage-architecture.md](./15-storage-architecture.md)** - **Hot/cold storage architecture** with proper S3 separation
16. **[16-distributed-system-design.md](./16-distributed-system-design.md)** - **Distributed coordination** with consistent hashing, WAL, and failure handling
17. **[17-binary-format-evolution.md](./17-binary-format-evolution.md)** - **Binary format versioning** and migration strategy

## Quick Reference

### Technology Stack
- **Backend**: Elixir 1.17+, OTP 27, Phoenix Framework
- **Frontend**: React 19, TypeScript, Vite
- **Storage**: Custom binary format with memory-mapped hot indexes + S3 cold storage
- **Deployment**: Docker, Fly.io

### Key Design Decisions
- Custom binary storage format (not PostgreSQL/SQLite)
- **Hot/Cold storage separation** - Local NVMe SSD for indexes, S3 for game data
- Consistent hashing for distributed sharding
- Append-only segment design for crash-safe writes
- Pure React UI (no LiveView)
- UCI engine integration for analysis
- Granular opening classification system

### Critical Architectural Fixes (v2)

This architecture addresses issues identified during review:

| Issue | Solution |
|-------|----------|
| S3 + mmap contradiction | Hot storage (local SSD) + Cold storage (S3) |
| Write coordination | Append-only segments + WAL |
| Sharding conflicts | Consistent hashing as single primary strategy |
| Binary format evolution | Semantic versioning + lazy migration |
| Performance bottlenecks | NIF integration for hot paths |

### Capacity Targets
- **Single database**: 100+ million games
- **Distributed cluster**: Billions of games
- **Concurrent users**: 10,000+ per node
- **Position lookup**: < 1ms for indexed positions
- **Import speed**: 1,000+ games/second

## Getting Started

For implementation details, see the individual architecture documents. The implementation follows a phased approach:

1. **Phase 1**: Core library with basic game storage
2. **Phase 2**: Position indexing and search
3. **Phase 3**: Analysis engine and opening classification
4. **Phase 4**: Advanced features and optimizations
5. **Phase 5**: API server with WebSocket support
6. **Phase 6**: React UI

See the main project README for setup and development instructions.

## New Critical Documents

If you're implementing this system, read these first:

1. **[15-storage-architecture.md](./15-storage-architecture.md)** - Understand the hot/cold storage separation
2. **[16-distributed-system-design.md](./16-distributed-system-design.md)** - Understand write coordination and sharding
3. **[17-binary-format-evolution.md](./17-binary-format-evolution.md)** - Understand versioning strategy

These documents address critical architectural issues and should be considered authoritative over earlier documents where they conflict.
