# Blunderfest Architecture Documentation

This directory contains the architectural decisions and technical specifications for the Blunderfest chess database engine.

## Documents

1. **[01-system-overview.md](./01-system-overview.md)** - High-level system architecture and component overview
2. **[02-binary-format-specification.md](./02-binary-format-specification.md)** - Detailed binary file format specification
3. **[03-api-design.md](./03-api-design.md)** - API design for both core library and REST API
4. **[04-scalability-performance.md](./04-scalability-performance.md)** - Scalability targets and performance optimization strategies
5. **[05-deployment-guide.md](./05-deployment-guide.md)** - Deployment architecture and infrastructure setup

## Quick Reference

### Technology Stack
- **Backend**: Elixir 1.17+, OTP 27, Phoenix Framework
- **Frontend**: React 19, TypeScript, Vite
- **Storage**: Custom binary format with memory-mapped files
- **Deployment**: Docker, Fly.io

### Key Design Decisions
- Custom binary storage format (not PostgreSQL/SQLite)
- Distributed architecture with sharding support
- Pure React UI (no LiveView)
- UCI engine integration for analysis
- Granular opening classification system

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