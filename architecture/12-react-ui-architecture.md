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

### Vanilla Extract Design System

We use **Vanilla Extract** as our design system for consistent theming and component styling.

```typescript
// src/styles/design-tokens.css.ts
import { createGlobalTheme, createThemeContract } from '@vanilla-extract/css';

export const vars = createThemeContract({
  color: {
    primary: null,
    secondary: null,
    background: null,
    surface: null,
    text: null,
    textMuted: null,
    border: null,
    board: {
      light: null,
      dark: null,
      highlight: null,
      selected: null
    },
    piece: {
      white: null,
      black: null
    }
  },
  spacing: {
    xs: null,
    sm: null,
    md: null,
    lg: null,
    xl: null
  },
  font: {
    family: null,
    size: {
      xs: null,
      sm: null,
      md: null,
      lg: null,
      xl: null
    },
    weight: {
      normal: null,
      bold: null
    }
  },
  borderRadius: {
    sm: null,
    md: null,
    lg: null
  },
  shadow: {
    sm: null,
    md: null,
    lg: null
  }
});

createGlobalTheme(':root', vars, {
  color: {
    primary: '#4a90d9',
    secondary: '#6c757d',
    background: '#f8f9fa',
    surface: '#ffffff',
    text: '#212529',
    textMuted: '#6c757d',
    border: '#dee2e6',
    board: {
      light: '#f0d9b5',
      dark: '#b58863',
      highlight: '#ffff00',
      selected: '#4a90d9'
    },
    piece: {
      white: '#ffffff',
      black: '#000000'
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    size: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '24px'
    },
    weight: {
      normal: '400',
      bold: '700'
    }
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px'
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)'
  }
});
```

**Component Theme Styles**:

```typescript
// src/styles/components/button.css.ts
import { style } from '@vanilla-extract/css';
import { vars } from '../design-tokens.css.ts';

export const button = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${vars.spacing.sm} ${vars.spacing.md}`,
  fontFamily: vars.font.family,
  fontSize: vars.font.size.md,
  fontWeight: vars.font.weight.bold,
  borderRadius: vars.borderRadius.md,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  selectors: {
    '&:hover': {
      opacity: 0.9
    },
    '&:disabled': {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  }
});

export const buttonPrimary = style([button, {
  backgroundColor: vars.color.primary,
  color: vars.color.surface
}]);

export const buttonSecondary = style([button, {
  backgroundColor: vars.color.secondary,
  color: vars.color.surface
}]);
```

**Chess Board Theme Styles**:

```typescript
// src/styles/components/chess-board.css.ts
import { style } from '@vanilla-extract/css';
import { vars } from '../design-tokens.css.ts';

export const board = style({
  display: 'flex',
  flexDirection: 'column',
  border: `2px solid ${vars.color.border}`,
  borderRadius: vars.borderRadius.md,
  overflow: 'hidden',
  boxShadow: vars.shadow.md
});

export const boardRow = style({
  display: 'flex'
});

export const square = style({
  width: '64px',
  height: '64px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  selectors: {
    '&.light': {
      backgroundColor: vars.color.board.light
    },
    '&.dark': {
      backgroundColor: vars.color.board.dark
    },
    '&.highlighted': {
      backgroundColor: vars.color.board.highlight
    },
    '&.selected': {
      boxShadow: `inset 0 0 0 4px ${vars.color.board.selected}`
    }
  }
});
```

### Vanilla Extract Sprinkles (Atomic CSS)

We use **Sprinkles** for type-safe atomic CSS utilities - perfect for quick layout and styling without creating new stylesheets.

```typescript
// src/styles/sprinkles.css.ts
import { createSprinkles, defineConfig } from '@vanilla-extract/sprinkles';
import { vars } from './design-tokens.css.ts';

const responsiveConfig = defineConfig({
  breakpoints: {
    mobile: '(min-width: 640px)',
    tablet: '(min-width: 768px)',
    desktop: '(min-width: 1024px)'
  },
  conditions: {
    hover: '@hover',
    focus: '@focus'
  }
});

export const sprinkles = createSprinkles(
  // Layout properties
  responsiveConfig,
  {
    display: {
      none: { condition: 'hover' },
      flex: true,
      block: true,
      inline: true,
      grid: true
    },
    flexDirection: {
      row: true,
      column: true,
      'row-reverse': true,
      'column-reverse': true
    },
    justifyContent: {
      center: true,
      start: true,
      end: true,
      'space-between': true,
      'space-around': true
    },
    alignItems: {
      center: true,
      start: true,
      end: true,
      stretch: true,
      baseline: true
    },
    gap: {
      xs: vars.spacing.xs,
      sm: vars.spacing.sm,
      md: vars.spacing.md,
      lg: vars.spacing.lg,
      xl: vars.spacing.xl
    },
    padding: {
      xs: vars.spacing.xs,
      sm: vars.spacing.sm,
      md: vars.spacing.md,
      lg: vars.spacing.lg,
      xl: vars.spacing.xl
    },
    margin: {
      xs: vars.spacing.xs,
      sm: vars.spacing.sm,
      md: vars.spacing.md,
      lg: vars.spacing.lg,
      xl: vars.spacing.xl
    },
    // Color properties
    color: {
      primary: vars.color.primary,
      secondary: vars.color.secondary,
      text: vars.color.text,
      'text-muted': vars.color.textMuted
    },
    backgroundColor: {
      primary: vars.color.primary,
      secondary: vars.color.secondary,
      surface: vars.color.surface,
      background: vars.color.background
    },
    // Typography
    fontSize: {
      xs: vars.font.size.xs,
      sm: vars.font.size.sm,
      md: vars.font.size.md,
      lg: vars.font.size.lg,
      xl: vars.font.size.xl
    },
    fontWeight: {
      normal: vars.font.weight.normal,
      bold: vars.font.weight.bold
    },
    // Border radius
    borderRadius: {
      sm: vars.borderRadius.sm,
      md: vars.borderRadius.md,
      lg: vars.borderRadius.lg,
      full: '9999px'
    },
    // Shadows
    boxShadow: {
      sm: vars.shadow.sm,
      md: vars.shadow.md,
      lg: vars.shadow.lg
    }
  }
);

// Type exports for Sprinkles
export type SprinklesArgs = Parameters<typeof sprinkles>[0];
```

**Using Sprinkles in Components**:

```typescript
// src/components/common/card.tsx
import { sprinkles } from '~/styles/sprinkles.css';

interface CardProps {
  children: React.ReactNode;
  elevated?: boolean;
}

export const Card = ({ children, elevated = false }: CardProps) => (
  <div
    className={sprinkles({
      padding: 'md',
      borderRadius: 'md',
      backgroundColor: 'surface',
      display: 'flex',
      flexDirection: 'column',
      gap: 'md',
      boxShadow: elevated ? 'md' : 'sm'
    })}
  >
    {children}
  </div>
);
```

### Vanilla Extract Recipes

We use **Recipes** for reusable component patterns with variants - perfect for buttons, inputs, and other interactive elements.

```typescript
// src/styles/recipes/button.recipe.css.ts
import { defineRecipe } from '@vanilla-extract/recipes';

export const buttonRecipe = defineRecipe({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    borderRadius: '8px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: 'none',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  },
  variants: {
    variant: {
      primary: {
        backgroundColor: '#4a90d9',
        color: '#ffffff',
        ':hover': { opacity: 0.9 },
        ':disabled': { opacity: 0.5, cursor: 'not-allowed' }
      },
      secondary: {
        backgroundColor: '#6c757d',
        color: '#ffffff',
        ':hover': { opacity: 0.9 },
        ':disabled': { opacity: 0.5, cursor: 'not-allowed' }
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '#4a90d9',
        ':hover': { backgroundColor: 'rgba(74, 144, 217, 0.1)' }
      },
      outline: {
        backgroundColor: 'transparent',
        color: '#4a90d9',
        border: '2px solid #4a90d9',
        ':hover': { backgroundColor: 'rgba(74, 144, 217, 0.1)' }
      }
    },
    size: {
      sm: {
        fontSize: '12px',
        padding: '4px 8px'
      },
      md: {
        fontSize: '16px',
        padding: '8px 16px'
      },
      lg: {
        fontSize: '18px',
        padding: '12px 24px'
      }
    },
    fullWidth: {
      true: { width: '100%' },
      false: { width: 'auto' }
    }
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    fullWidth: false
  }
});
```

**Using Recipes in Components**:

```typescript
// src/components/common/button.tsx
import { buttonRecipe } from '~/styles/recipes/button.recipe.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  onClick,
  disabled
}: ButtonProps) => (
  <button
    className={buttonRecipe({ variant, size, fullWidth })}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

// Usage examples
const Examples = () => (
  <>
    <Button variant="primary" size="md">Primary Button</Button>
    <Button variant="secondary" size="lg">Secondary Button</Button>
    <Button variant="ghost">Ghost Button</Button>
    <Button variant="outline" size="sm">Outline Button</Button>
    <Button fullWidth>Full Width Button</Button>
  </>
);
```

### Complete Vanilla Extract Setup

**Folder Structure**:

```
src/styles/
├── design-tokens.css.ts      # Theme variables (createThemeContract)
├── sprinkles.css.ts          # Atomic CSS utilities
├── recipes/
│   ├── button.recipe.css.ts  # Button component recipe
│   ├── input.recipe.css.ts   # Input component recipe
│   └── card.recipe.css.ts    # Card component recipe
├── components/
│   ├── button.css.ts         # Custom button styles
│   └── chess-board.css.ts   # Chess board styles
└── globals.css               # Global styles
```

### Linting and Formatting

We'll use **Biome** for linting and formatting, with a minimal ESLint configuration for import path enforcement.

**Rationale**:
- Biome is faster than ESLint + Prettier
- Single tool for linting and formatting
- Good TypeScript support
- Minimal ESLint config only for import path rules

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.8.3/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "warn",
        "noUnusedImports": "warn"
      },
      "security": {
        "noDangerouslySetInnerHtml": "warn"
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
      "semicolons": "always",
      "trailingCommas": "es5"
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
      {
        "dirs": ["src"],
        "allowSameFolder": false,
        "resolveToRelative": false
      }
    ]
  }
}
```

### Path Aliases

We use **~** as the path prefix for absolute imports (not "@").

```typescript
// ✅ Good - using ~ prefix
import { useGameStore } from '~/stores/game-store';
import { Move, Position } from '~/types/chess';
import ChessBoard from '~/components/chess/board/chess-board';

// ❌ Bad - no relative imports
import { useGameStore } from '../../../stores/game-store';
```

### File Naming Convention

All files use **kebab-case**:

```
src/
├── components/
│   ├── chess/
│   │   ├── board/
│   │   │   ├── chess-board.tsx
│   │   │   ├── chess-board.css.ts
│   │   │   └── index.ts
│   │   ├── piece/
│   │   │   ├── piece.tsx
│   │   │   └── index.ts
│   │   └── move-list/
│   │       ├── move-list.tsx
│   │       └── index.ts
│   └── layout/
│       ├── header/
│       │   ├── header.tsx
│       │   └── index.ts
│       └── sidebar/
│           ├── sidebar.tsx
│           └── index.ts
├── stores/
│   ├── game-store.ts
│   ├── analysis-store.ts
│   └── ui-store.ts
├── hooks/
│   ├── use-chess-game.ts
│   └── use-position-search.ts
└── types/
    ├── chess.ts
    └── api.ts
```

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
// src/components/chess/board/chess-board.tsx
import React, { useCallback } from 'react';
import { useDrop } from 'react-dnd';
import { useGameStore } from '~/stores/game-store';
import Square from '~/components/chess/board/square';
import Piece from '~/components/chess/board/piece';
import { Move, Position } from '~/types/chess';
import './chess-board.css';

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
// src/components/chess/move-list/move-list.tsx
import React from 'react';
import { Move } from '~/types/chess';
import './move-list.css';

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
// src/components/features/position-search/position-search.tsx
import React, { useState } from 'react';
import { usePositionSearch } from '~/hooks/use-position-search';
import ChessBoard from '~/components/chess/board/chess-board';
import { MaterialFilter, PatternFilter } from '~/types/search';
import './position-search.css';

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
// src/stores/game-store.ts
import { create } from 'zustand';
import { Game, Move, Position } from '~/types/chess';

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
// src/stores/analysis-store.ts
import { create } from 'zustand';
import { AnalysisResult } from '~/types/analysis';

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
    const { websocket, isAnalyzing } = get();
    
    // Clean up existing WebSocket if any
    if (websocket) {
      websocket.close();
    }
    
    // Create new WebSocket connection
    const ws = new WebSocket(
      `ws://${import.meta.env.VITE_API_URL}/ws/analysis`
    );
    
    set({ 
      isAnalyzing: true,
      websocket: ws,  // Store reference for cleanup
      currentAnalysis: null
    });
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'analysis_update') {
          set({ currentAnalysis: data.result });
        } else if (data.type === 'analysis_complete') {
          set({ 
            isAnalyzing: false,
            websocket: null  // Clear reference on completion
          });
          ws.close();
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      set({ 
        isAnalyzing: false,
        websocket: null 
      });
    };
    
    ws.onclose = () => {
      // Ensure cleanup on close
      const { websocket: currentWs } = get();
      if (currentWs === ws) {
        set({ 
          isAnalyzing: false,
          websocket: null 
        });
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
    const { websocket } = get();
    
    // Close WebSocket if exists
    if (websocket) {
      websocket.close();
    }
    
    set({ 
      isAnalyzing: false,
      websocket: null 
    });
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
import { api } from '~/lib/api';
import { Game, GameSearchParams } from '~/types/game';
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
import { api } from '~/lib/api';
import { Game, GameSearchParams } from '~/types/game';

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
import { api } from '~/lib/api';
import { Game, GameSearchParams } from '~/types/game';

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
// src/components/chess/move-list/virtual-move-list.tsx
import React from 'react';
import { FixedSizeList } from 'react-window';
import MoveRow from './move-row';

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
// src/components/chess/board/memoized-board.tsx
import React, { memo, useMemo } from 'react';
import { Position } from '~/types/chess';

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
// tests/components/chess-board.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChessBoard from '~/components/chess/board/chess-board';
import { Position } from '~/types/chess';

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
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig(({ command }) => {
	const isDev = command !== 'build';
	
	if (isDev) {
		// Terminate the watcher when Phoenix quits
		process.stdin.on('close', () => {
			process.exit(0);
		});

		process.stdin.resume();
	}

	return {
		plugins: [react()],
		resolve: {
			alias: {
				'~': path.resolve(__dirname, './src')
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
	};
});
```

**Key Points:**
- Uses **~** (not **@**) as the path prefix for absolute imports
- Handles Phoenix stdin closure to properly terminate Vite in development
- Proxies API requests to Phoenix server

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
      "~/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```
