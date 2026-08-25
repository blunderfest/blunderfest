import { Chess } from 'chess.js';
import { useEffect, useRef, useState } from 'react';
import {
  type Piece,
  type Position,
  parseFen,
  positionToFen,
  squareFromPoint,
  squareIndex,
} from '@/components/board';

/**
 * Free-form position editing (ADR-0011). In edit mode the board accepts
 * arbitrary piece placement: click a piece to pick it up and drop it
 * anywhere, or pick a piece from the palette (then every click places it).
 * The eraser removes pieces. `buildFen` validates with chess.js and yields
 * the FEN for a `set_position` op (or null, after flagging the error).
 *
 * The hook owns only the editing state and interactions; committing the op
 * (and its pending echo) stays with the caller.
 */
export function usePositionEditor({ flipped }: { flipped: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editPos, setEditPos] = useState<Position>([]);
  const [editTurn, setEditTurn] = useState<'w' | 'b'>('w');
  const [editSelected, setEditSelected] = useState<string | null>(null);
  const [editBrush, setEditBrush] = useState<Piece | 'erase' | null>(null);
  const [editError, setEditError] = useState(false);
  /** The piece following the pointer while dragging out of the palette. */
  const [paletteGhost, setPaletteGhost] = useState<{
    piece: Piece;
    x: number;
    y: number;
  } | null>(null);
  const paletteListeners = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
    cancel: (e: PointerEvent) => void;
  } | null>(null);

  // Palette drags attach window listeners; release them on unmount.
  useEffect(() => {
    return () => {
      const listeners = paletteListeners.current;
      if (listeners !== null) {
        window.removeEventListener('pointermove', listeners.move);
        window.removeEventListener('pointerup', listeners.up);
        window.removeEventListener('pointercancel', listeners.cancel);
      }
    };
  }, []);

  function enterEditMode(fen: string | null) {
    setEditPos(parseFen(fen ?? ''));
    setEditTurn(fen?.split(' ')[1] === 'b' ? 'b' : 'w');
    setEditSelected(null);
    setEditBrush(null);
    setEditError(false);
    setEditing(true);
  }

  function exitEditMode() {
    setEditing(false);
    setEditSelected(null);
    setEditBrush(null);
    setEditError(false);
  }

  /**
   * The brush landing on a square: place the piece / erase. Functional
   * updates so a held-pointer sweep can paint several squares in a row.
   */
  function paintSquare(square: string) {
    const index = squareIndex(square);
    if (editBrush === 'erase') {
      setEditPos((previous) => {
        if (previous[index] == null) {
          return previous;
        }
        const next = [...previous];
        next[index] = null;
        return next;
      });
      return;
    }
    if (editBrush !== null) {
      setEditPos((previous) => {
        const next = [...previous];
        next[index] = editBrush;
        return next;
      });
    }
  }

  function handleEditSquareClick(square: string) {
    const index = squareIndex(square);
    if (editBrush !== null) {
      paintSquare(square);
      return;
    }
    if (editSelected === null) {
      if (editPos[index] != null) {
        setEditSelected(square);
      }
      return;
    }
    if (square === editSelected) {
      setEditSelected(null);
      return;
    }
    const from = squareIndex(editSelected);
    const next = [...editPos];
    next[index] = next[from] ?? null;
    next[from] = null;
    setEditPos(next);
    setEditSelected(null);
  }

  /** In edit mode a drag is free-form placement; off-board drops delete. */
  function handleEditDrag(from: string, to: string | null) {
    const fromIndex = squareIndex(from);
    const piece = editPos[fromIndex] ?? null;
    if (piece === null) {
      return;
    }
    const next = [...editPos];
    next[fromIndex] = null;
    if (to !== null) {
      next[squareIndex(to)] = piece;
    }
    setEditPos(next);
  }

  /**
   * Dragging a piece out of the palette: the brush is set on pointerdown,
   * the ghost follows the pointer, and releasing over a board square
   * places the piece there — once, at the release point. (Sweep-painting
   * several squares belongs to gestures that start on the board.) A plain
   * click still toggles the brush (the release lands on the palette, not
   * the board, so nothing is placed).
   */
  /** Set when a palette press already handled selection (the click must not re-toggle). */
  const palettePressedRef = useRef(false);

  /** Keyboard path for palette pieces — pointer users toggle on press. */
  function handlePaletteClick(piece: Piece | 'erase') {
    if (palettePressedRef.current) {
      palettePressedRef.current = false;
      return;
    }
    toggleBrush(piece);
  }

  /**
   * Palette presses select/deselect immediately (chess-UI feel). A drag
   * starts only once the pointer moves a few pixels — a tap never flashes
   * a ghost — and the piece lands where the pointer is released.
   */
  function handlePalettePointerDown(piece: Piece, event: React.PointerEvent) {
    if (event.button !== 0) {
      return;
    }
    palettePressedRef.current = true;
    toggleBrush(piece);
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      paletteListeners.current = null;
      setPaletteGhost(null);
    };
    const onMove = (move: PointerEvent) => {
      if (!dragging && Math.hypot(move.clientX - startX, move.clientY - startY) > 6) {
        // A real drag: no click follows it, so re-arm the selection flag
        // for the next press and make the brush current.
        palettePressedRef.current = false;
        dragging = true;
        setEditBrush(piece);
      }
      if (dragging) {
        setPaletteGhost({ piece, x: move.clientX, y: move.clientY });
      }
    };
    const onUp = (up: PointerEvent) => {
      // Place once, where the drag ends — off-board releases drop nothing.
      if (dragging) {
        const board = document.querySelector('[data-board-grid]');
        if (board !== null) {
          const target = squareFromPoint(
            board.getBoundingClientRect(),
            up.clientX,
            up.clientY,
            flipped,
          );
          if (target !== null) {
            setEditPos((previous) => {
              const next = [...previous];
              next[squareIndex(target)] = piece;
              return next;
            });
          }
        }
      }
      cleanup();
    };
    // A canceled pointer (the browser took the gesture to scroll the page)
    // must drop the ghost and listeners, never place the piece.
    const onCancel = () => cleanup();

    paletteListeners.current = { move: onMove, up: onUp, cancel: onCancel };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  /**
   * The FEN for the edited position, or null (and the error shown) when it
   * can't even be read structurally. Analysis is an unstructured activity:
   * chess-rule validation is skipped on purpose — kingless boards, pawns on
   * the back rank and "impossible" checks all commit. Downstream features
   * degrade honestly (no legal moves, engine unavailable).
   */
  function buildFen(currentFen: string | null): string | null {
    const fullmove = Number.parseInt(currentFen?.split(' ')[5] ?? '1', 10) || 1;
    const fen = positionToFen(editPos, editTurn, fullmove);
    try {
      new Chess(fen, { skipValidation: true });
      return fen;
    } catch {
      setEditError(true);
      return null;
    }
  }

  function toggleBrush(piece: Piece | 'erase') {
    setEditBrush((brush) => {
      const active =
        piece === 'erase'
          ? brush === 'erase'
          : brush !== null &&
            brush !== 'erase' &&
            brush.color === piece.color &&
            brush.kind === piece.kind;
      return active ? null : piece;
    });
  }

  return {
    editing,
    editPos,
    editTurn,
    editSelected,
    editBrush,
    editError,
    paletteGhost,
    enterEditMode,
    exitEditMode,
    handleEditSquareClick,
    handleEditDrag,
    handlePalettePointerDown,
    handlePaletteClick,
    paintSquare,
    buildFen,
    toggleBrush,
    toggleTurn: () => setEditTurn((turn) => (turn === 'w' ? 'b' : 'w')),
    clearBoard: () => setEditPos(new Array(64).fill(null)),
    resetPosition: (fen: string | null) => setEditPos(parseFen(fen ?? '')),
  };
}
