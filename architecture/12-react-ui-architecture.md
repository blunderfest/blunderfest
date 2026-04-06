# React UI Architecture Specification

## Overview

The Blunderfest React UI is a modern, responsive web application for interacting with the chess database. Built with React 19, TypeScript, and Vite.

## Design Choices

### State Management

**Choice: Redux vs. Zustand vs. React Context**

We'll use **Zustand** for state management.

**Rationale**:
- Simpler API than Redux
- Better TypeScript support
- Smaller bundle size
- No boilerplate

### Styling Approach

**Choice: CSS-in-JS vs. Utility-first vs. CSS Modules**

We'll use **Vanilla Extract** for type-safe, zero-runtime CSS-in-JS styling.

**Rationale**:
- Type-safe styles with TypeScript integration
- Zero runtime overhead (compile-time CSS generation)
- Full control over styling without component library constraints
- Better developer experience with IDE autocomplete
- No opinionated design system to override
- Perfect for custom chess-specific UI components

**Note**: No component library is selected at this time. Components will be built from scratch using Vanilla Extract for styling.

### Chess Board Component

**Choice: react-chessboard vs. chessboard.js vs. Custom**

We'll use a **custom chessboard component** built on react-dnd.

**Rationale**:
- Full control over appearance and behavior
- Better integration with our state management
- Custom drag-and-drop for analysis
- No external dependencies

## Project Structure

```
apps/blunderfest_ui/
├── public/
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── App.tsx           # Main app component
│   │   ├── routes.tsx        # Route definitions
│   │   └── providers.tsx     # Context providers
│   ├── components/
│   │   ├── common/           # Reusable UI components
│   │   │   ├── Button/
│   │   │   ├── Modal/
│   │   │   ├── Input/
│   │   │   └── ...
│   │   ├── chess/            # Chess-specific components
│   │   │   ├── Board/        # Chessboard component
│   │   │   ├── Piece/        # Chess piece component
│   │   │   ├── Square/       # Board square component
│   │   │   ├── MoveList/     # Move notation display
│   │   │   └── Evaluation/   # Engine evaluation bar
│   │   ├── layout/           # Layout components
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── Footer/
│   │   └── features/         # Feature-specific components
│   │       ├── GameViewer/
│   │       ├── PositionSearch/
│   │       ├── OpeningTree/
│   │       └── AnalysisBoard/
│   ├── hooks/                # Custom React hooks
│   │   ├── useChessGame.ts
│   │   ├── usePositionSearch.ts
│   │   ├── useEngineAnalysis.ts
│   │   └── ...
│   ├── stores/               # Zustand stores
│   │   ├── gameStore.ts
│   │   ├── searchStore.ts
│   │   ├── analysisStore.ts
│   │   └── uiStore.ts
│   ├── services/             # API services
│   │   ├── api.ts            # Base API client
│   │   ├── games.ts          # Game API
│   │   ├── positions.ts      # Position API
│   │   └── analysis.ts       # Analysis API
│   ├── types/                # TypeScript types
│   │   ├── game.ts
│   │   ├── position.ts
│   │   ├── api.ts
│   │   └── chess.ts
│   ├── utils/                # Utility functions
│   │   ├── chess.ts          # Chess utilities
│   │   ├── format.ts         # Formatting utilities
│   │   └── validation.ts     # Validation utilities
│   ├── styles/               # Global styles
│   │   └── globals.css
│   └── main.tsx              # Entry point
├── tests/                    # Test files
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## Core Components

### Chessboard Component

```typescript
// src/components/chess/Board/ChessBoard.tsx
import React, { useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { useGameStore } from '@/stores/gameStore';
import Square from '@/components/chess/Board/Square';
import Piece from '@/components/chess/Board/Piece';
import { Move, Position } from '@/types/chess';
import './ChessBoard.css';

interface ChessBoardProps {
  position: Position;
  orientation?: 'white' | 'black';
  onMove?: (move: Move) => void;
  showCoordinates?: boolean;
  showArrows?: boolean;
  highlightedSquares?: string[];
}

const ChessBoard: React.FC<ChessBoardProps> = ({
  position,
  orientation = 'white',
  onMove,
  showCoordinates = true,
  showArrows = false,
  highlightedSquares = []
}) => {
  const { selectedSquare, setSelectedSquare, legalMoves } = useGameStore();

  const handleSquareClick = useCallback((square: string) => {
    if (selectedSquare) {
      // Attempt move
      const move = legalMoves.find(m => m.to === square);
      if (move) {
        onMove?.(move);
        setSelectedSquare(null);
      } else {
        // Select new piece
        setSelectedSquare(square);
      }
    } else {
      // Select piece
      setSelectedSquare(square);
    }
  }, [selectedSquare, legalMoves, onMove, setSelectedSquare]);

  const renderSquare = (rank: number, file: number) => {
    const squareId = `${String.fromCharCode(97 + file)}${rank + 1}`;
    const piece = position.pieces[squareId];
    const isHighlighted = highlightedSquares.includes(squareId);

    return (
      <Square
        key={squareId}
        id={squareId}
        piece={piece}
        isLight={(rank + file) % 2 === 0}
        isSelected={selectedSquare === squareId}
        isHighlighted={isHighlighted}
        onClick={() => handleSquareClick(squareId)}
      />
    );
  };

  const ranks = orientation === 'white' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className="chess-board">
      {showCoordinates && (
        <div className="board-coordinates">
          {files.map(file => (
            <div key={`file-${file}`} className="coordinate file">
              {String.fromCharCode(97 + file)}
            </div>
          ))}
        </div>
      )}
      
      <div className="board-squares">
        {ranks.map(rank => (
          <div key={`rank-${rank}`} className="board-rank">
            {files.map(file => renderSquare(rank, file))}
          </div>
        ))}
      </div>

      {showCoordinates && (
        <div className="board-coordinates vertical">
          {ranks.map(rank => (
            <div key={`rank-${rank}`} className="coordinate rank">
              {rank + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChessBoard;
```

### Move List Component

```typescript
// src/components/chess/MoveList/MoveList.tsx
import React from 'react';
import { Move } from '@/types/chess';
import './MoveList.css';

interface MoveListProps {
  moves: Move[];
  currentMove?: number;
  onMoveClick?: (moveIndex: number) => void;
  showAnnotations?: boolean;
}

const MoveList: React.FC<MoveListProps> = ({
  moves,
  currentMove,
  onMoveClick,
  showAnnotations = true
}) => {
  const groupedMoves = React.useMemo(() => {
    const groups: { number: number; white?: Move; black?: Move }[] = [];
    
    for (let i = 0; i < moves.length; i += 2) {
      groups.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1]
      });
    }
    
    return groups;
  }, [moves]);

  return (
    <div className="move-list">
      {groupedMoves.map(group => (
        <div key={group.number} className="move-row">
          <span className="move-number">{group.number}.</span>
          
          {group.white && (
            <button
              className={`move-button white ${currentMove === moves.indexOf(group.white) ? 'active' : ''}`}
              onClick={() => onMoveClick?.(moves.indexOf(group.white))}
            >
              {group.white.san}
              {showAnnotations && group.white.annotation && (
                <span className="annotation">{group.white.annotation}</span>
              )}
            </button>
          )}
          
          {group.black && (
            <button
              className={`move-button black ${currentMove === moves.indexOf(group.black) ? 'active' : ''}`}
              onClick={() => onMoveClick?.(moves.indexOf(group.black))}
            >
              {group.black.san}
              {showAnnotations && group.black.annotation && (
                <span className="annotation">{group.black.annotation}</span>
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default MoveList;
```

### Position Search Component

```typescript
// src/components/features/PositionSearch/PositionSearch.tsx
import React, { useState } from 'react';
import { usePositionSearch } from '@/hooks/usePositionSearch';
import ChessBoard from '@/components/chess/Board/ChessBoard';
import { MaterialFilter, PatternFilter } from '@/types/search';
import './PositionSearch.css';

const PositionSearch: React.FC = () => {
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>({
    white: [],
    black: []
  });
  
  const [patternFilter, setPatternFilter] = useState<PatternFilter>({});
  
  const { search, results, loading, error } = usePositionSearch();

  const handleSearch = () => {
    search({
      material: materialFilter,
      pattern: patternFilter
    });
  };

  return (
    <div className="position-search">
      <div className="search-panel">
        <h3>Material Filter</h3>
        
        <div className="filter-section">
          <label>White pieces:</label>
          <div className="piece-selector">
            {['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].map(piece => (
              <label key={piece} className="piece-checkbox">
                <input
                  type="checkbox"
                  checked={materialFilter.white.includes(piece as any)}
                  onChange={(e) => {
                    setMaterialFilter(prev => ({
                      ...prev,
                      white: e.target.checked
                        ? [...prev.white, piece]
                        : prev.white.filter(p => p !== piece)
                    }));
                  }}
                />
                {piece}
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label>Black pieces:</label>
          <div className="piece-selector">
            {['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].map(piece => (
              <label key={piece} className="piece-checkbox">
                <input
                  type="checkbox"
                  checked={materialFilter.black.includes(piece as any)}
                  onChange={(e) => {
                    setMaterialFilter(prev => ({
                      ...prev,
                      black: e.target.checked
                        ? [...prev.black, piece]
                        : prev.black.filter(p => p !== piece)
                    }));
                  }}
                />
                {piece}
              </label>
            ))}
          </div>
        </div>

        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="search-results">
        {error && <div className="error">{error}</div>}
        
        {results && (
          <div className="results-list">
            {results.map(result => (
              <div key={result.id} className="result-item">
                <ChessBoard position={result.position} />
                <div className="result-stats">
                  <span>Games: {result.gameCount}</span>
                  <span>White wins: {result.whiteWinRate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionSearch;
```

## State Management

### Game Store (Zustand)

```typescript
// src/stores/gameStore.ts
import { create } from 'zustand';
import { Game, Move, Position } from '@/types/chess';

interface GameStore {
  currentGame: Game | null;
  currentPosition: Position;
  currentMoveIndex: number;
  selectedSquare: string | null;
  legalMoves: Move[];
  
  setCurrentGame: (game: Game | null) => void;
  goToMove: (index: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
  goToNext: () => void;
  goToPrevious: () => void;
  setSelectedSquare: (square: string | null) => void;
  makeMove: (move: Move) => void;
  resetBoard: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  currentPosition: Position.initial(),
  currentMoveIndex: -1,
  selectedSquare: null,
  legalMoves: [],

  setCurrentGame: (game) => {
    set({ 
      currentGame: game,
      currentPosition: Position.initial(),
      currentMoveIndex: -1,
      selectedSquare: null,
      legalMoves: []
    });
  },

  goToMove: (index) => {
    const { currentGame } = get();
    if (!currentGame || index < -1 || index >= currentGame.moves.length) return;

    const position = index === -1 
      ? Position.initial()
      : Position.applyMoves(currentGame.moves.slice(0, index + 1));

    set({ 
      currentPosition: position,
      currentMoveIndex: index,
      selectedSquare: null,
      legalMoves: []
    });
  },

  goToStart: () => get().goToMove(-1),
  goToEnd: () => {
    const { currentGame } = get();
    if (currentGame) {
      get().goToMove(currentGame.moves.length - 1);
    }
  },

  goToNext: () => {
    const { currentMoveIndex, currentGame } = get();
    if (currentGame && currentMoveIndex < currentGame.moves.length - 1) {
      get().goToMove(currentMoveIndex + 1);
    }
  },

  goToPrevious: () => {
    const { currentMoveIndex } = get();
    if (currentMoveIndex > 0) {
      get().goToMove(currentMoveIndex - 1);
    }
  },

  setSelectedSquare: (square) => {
    const { currentPosition } = get();
    
    if (square) {
      const moves = currentPosition.getLegalMoves(square);
      set({ selectedSquare: square, legalMoves: moves });
    } else {
      set({ selectedSquare: null, legalMoves: [] });
    }
  },

  makeMove: (move) => {
    const { currentPosition, currentMoveIndex, currentGame } = get();
    
    const newPosition = currentPosition.applyMove(move);
    
    // If we're in a game and at the end, add the move
    if (currentGame && currentMoveIndex === currentGame.moves.length - 1) {
      currentGame.moves.push(move);
    }
    
    set({
      currentPosition: newPosition,
      currentMoveIndex: currentMoveIndex + 1,
      selectedSquare: null,
      legalMoves: []
    });
  },

  resetBoard: () => {
    set({
      currentPosition: Position.initial(),
      currentMoveIndex: -1,
      selectedSquare: null,
      legalMoves: []
    });
  }
}));
```

### Analysis Store

```typescript
// src/stores/analysisStore.ts
import { create } from 'zustand';
import { AnalysisResult } from '@/types/analysis';

interface AnalysisStore {
  isAnalyzing: boolean;
  currentAnalysis: AnalysisResult | null;
  engineDepth: number;
  engineOptions: EngineOptions;
  
  startAnalysis: (fen: string) => void;
  stopAnalysis: () => void;
  setEngineDepth: (depth: number) => void;
  setEngineOptions: (options: EngineOptions) => void;
}

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  isAnalyzing: false,
  currentAnalysis: null,
  engineDepth: 20,
  engineOptions: {
    threads: 4,
    hash: 1024,
    multiPV: 3
  },

  startAnalysis: async (fen: string) => {
    set({ isAnalyzing: true });
    
    // Connect to WebSocket for real-time analysis
    const ws = new WebSocket(`ws://${import.meta.env.VITE_API_URL}/ws/analysis`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'analysis_update') {
        set({ currentAnalysis: data.result });
      } else if (data.type === 'analysis_complete') {
        set({ isAnalyzing: false });
      }
    };
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'start_analysis',
        fen,
        depth: get().engineDepth,
        options: get().engineOptions
      }));
    };
  },

  stopAnalysis: () => {
    set({ isAnalyzing: false });
  },

  setEngineDepth: (depth) => set({ engineDepth: depth }),
  setEngineOptions: (options) => set({ engineOptions: options })
}));
```

## API Integration

**Choice: ky + TanStack Query**

We'll use **ky** for HTTP requests (smaller, more secure than axios) and **TanStack Query** for data fetching and caching.

**Rationale**:
- ky is smaller and more secure (no known security issues like axios)
- TanStack Query provides powerful caching, background updates, and state management
- Better TypeScript support
- Automatic request deduplication and retries

### API Client (ky)

```typescript
// src/lib/api.ts
import ky from 'ky';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export const api = ky.create({
  prefixUrl: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  hooks: {
    beforeRequest: [
      request => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    ]
  }
});
```

### Games Service (with ky and TanStack Query)

```typescript
// src/services/games.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Game, GameSearchParams } from '@/types/game';

export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (filters: GameSearchParams) => [...gameKeys.lists(), filters] as const,
  details: () => [...gameKeys.all, 'detail'] as const,
  detail: (id: string) => [...gameKeys.details(), id] as const
};

export const gamesService = {
  async getGame(id: string): Promise<Game> {
    return api.get(`games/${id}`).json();
  },

  async searchGames(params: GameSearchParams): Promise<Game[]> {
    return api.get('games', { searchParams: params }).json();
  },

  async addGame(pgn: string): Promise<Game> {
    return api.post('games', { json: { pgn } }).json();
  },

  async importPGN(file: File): Promise<{ imported: number; errors: number }> {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('import/pgn', { body: formData }).json();
  }
};

// TanStack Query hooks
export const useGame = (id: string) => {
  return useQuery({
    queryKey: gameKeys.detail(id),
    queryFn: () => gamesService.getGame(id)
  });
};

export const useSearchGames = (params: GameSearchParams) => {
  return useQuery({
    queryKey: gameKeys.list(params),
    queryFn: () => gamesService.searchGames(params)
  });
};

export const useAddGame = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (pgn: string) => gamesService.addGame(pgn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
    }
  });
};

export const useImportPGN = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (file: File) => gamesService.importPGN(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() });
    }
  });
};
```

## Performance Optimizations

### Virtual Scrolling for Move Lists

```typescript
// src/components/chess/MoveList/VirtualMoveList.tsx
import React from 'react';
import { FixedSizeList } from 'react-window';
import MoveRow from './MoveRow';

interface VirtualMoveListProps {
  moves: Move[];
  currentMove?: number;
  onMoveClick?: (index: number) => void;
}

const VirtualMoveList: React.FC<VirtualMoveListProps> = ({
  moves,
  currentMove,
  onMoveClick
}) => {
  const groupedMoves = React.useMemo(() => {
    const groups = [];
    for (let i = 0; i < moves.length; i += 2) {
      groups.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i],
        black: moves[i + 1]
      });
    }
    return groups;
  }, [moves]);

  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const group = groupedMoves[index];
    return (
      <div style={style}>
        <MoveRow
          group={group}
          currentMove={currentMove}
          onMoveClick={onMoveClick}
        />
      </div>
    );
  };

  return (
    <FixedSizeList
      height={400}
      itemCount={groupedMoves.length}
      itemSize={32}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};

export default VirtualMoveList;
```

### Memoization for Board Rendering

```typescript
// src/components/chess/Board/MemoizedBoard.tsx
import React, { memo, useMemo } from 'react';
import { Position } from '@/types/chess';

interface BoardProps {
  position: Position;
  orientation?: 'white' | 'black';
}

const MemoizedBoard = memo(({ position, orientation = 'white' }: BoardProps) => {
  // Memoize the board rendering
  const boardContent = useMemo(() => {
    return renderBoard(position, orientation);
  }, [position, orientation]);

  return <div className="board">{boardContent}</div>;
});

MemoizedBoard.displayName = 'MemoizedBoard';

export default MemoizedBoard;
```

## Testing

### Component Tests

```typescript
// tests/components/ChessBoard.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChessBoard from '@/components/chess/Board/ChessBoard';
import { Position } from '@/types/chess';

describe('ChessBoard', () => {
  it('renders the initial position', () => {
    const position = Position.initial();
    render(<ChessBoard position={position} />);
    
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
  });

  it('highlights selected square', () => {
    const position = Position.initial();
    const onSquareClick = jest.fn();
    
    render(
      <ChessBoard 
        position={position} 
        selectedSquare="e2"
        onSquareClick={onSquareClick}
      />
    );
    
    const e2Square = screen.getByTestId('square-e2');
    expect(e2Square).toHaveClass('selected');
  });
});
```

## Build Configuration

### Vite Config

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: '../blunderfest_api/priv/static',
    sourcemap: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
});
```

### TypeScript Config

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}