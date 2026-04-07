# Blunderfest

High-performance distributed chess database engine built with Elixir/Phoenix backend and React/TypeScript frontend.

## Quick Start

### Backend (Elixir/Phoenix)

```bash
# Install dependencies
mix deps.get

# Create database
mix ecto.create

# Run migrations
mix ecto.migrate

# Start Phoenix server
mix phx.server
```

### Frontend (React/Vite)

```bash
cd assets

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Project Structure

```
blunderfest/
├── mix.exs                    # Phoenix application
├── config/                    # Configuration files
├── lib/
│   ├── blunderfest/          # Core application
│   └── blunderfest_web/      # Web controllers
├── assets/                   # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── stores/           # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   ├── lib/              # Utilities
│   │   └── styles/           # Vanilla Extract styles
│   ├── package.json
│   └── vite.config.ts
└── priv/                     # Private resources
```

## API

The API is available at `http://localhost:8080/api/v1`:

- `GET /api/v1/health` - Health check
- `GET /api/v1/games` - List games
- `GET /api/v1/games/:id` - Get game
- `POST /api/v1/games` - Add game
- `GET /api/v1/positions/:fen` - Position statistics
- `GET /api/v1/players` - List players

## Development

### Running Tests

```bash
# Backend tests
mix test

# Frontend tests (future)
cd assets && pnpm test
```

### Code Quality

```bash
# Lint and format frontend
cd assets
pnpm lint
pnpm format
```

## Documentation

See the `architecture/` directory for detailed architecture documentation.
