import { useRef, useState } from 'react';
import { tv } from 'tailwind-variants';
import {
  arrowShape,
  DRAW_COLORS,
  isLightSquare,
  type Piece,
  type Position,
  pieceGlyph,
  squareFromPoint,
  squareIndex,
  squareName,
} from '@/components/board';
import type { DrawnHighlight } from '@/protocol/ops';

const square = tv({
  base: 'relative flex items-center justify-center aspect-square select-none focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-hi',
  variants: {
    shade: { light: 'bg-board-light', dark: 'bg-board-dark' },
    highlight: { none: '', lastMove: '', selected: '' },
  },
  compoundVariants: [
    { shade: 'light', highlight: 'lastMove', class: 'bg-move-from' },
    { shade: 'dark', highlight: 'lastMove', class: 'bg-move-to' },
    { shade: 'light', highlight: 'selected', class: 'bg-[#cfe0ff]' },
    { shade: 'dark', highlight: 'selected', class: 'bg-[#7f93b8]' },
  ],
});

const coord = tv({
  base: 'absolute text-[10px] font-semibold',
  variants: {
    shade: { light: 'text-board-dark', dark: 'text-board-light' },
  },
});

export type BoardArrow = { from: string; to: string; color?: string };

/**
 * WAI-ARIA grid pattern for the interactive board: one square in the tab
 * order (the focused square), arrow keys move between squares (flip-
 * invariant, clamped at the board edges), Enter/Space activate a square via
 * the native button behavior. Movement happens in index space, so it is
 * independent of the display order when flipped.
 *
 * Pointer interactions: left-drag moves pieces (ghost follows the cursor;
 * dropping off the board reports `to: null` so edit mode can delete);
 * right-drag draws an arrow, right-click toggles a square highlight — both
 * colored by modifier keys (blue default, Shift green, Ctrl/Cmd purple,
 * Alt red).
 */
export default function Board({
  position,
  lastMove,
  flipped = false,
  label = 'Chess board',
  interactive = false,
  selected = null,
  legalTargets = [],
  arrows = [],
  arrowColor = '#3b82f6',
  highlights = [],
  checkSquare = null,
  drawColor = '#3b82f6',
  onSquareClick,
  onDragMove,
  onDrawArrow,
  onToggleHighlight,
  onDrawColorChange,
}: {
  position: Position;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
  label?: string;
  interactive?: boolean;
  selected?: string | null;
  legalTargets?: string[];
  arrows?: BoardArrow[];
  arrowColor?: string;
  highlights?: DrawnHighlight[];
  checkSquare?: string | null;
  onSquareClick?: (square: string) => void;
  onDragMove?: (from: string, to: string | null) => void;
  onDrawArrow?: (from: string, to: string, color: string) => void;
  onToggleHighlight?: (square: string, color: string) => void;
  drawColor?: string;
  onDrawColorChange?: (color: string) => void;
}) {
  const [focusIndex, setFocusIndex] = useState<number>(() =>
    lastMove?.to ? squareIndex(lastMove.to) : squareIndex('e4'),
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef<{
    from: string;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const [ghost, setGhost] = useState<{ piece: Piece; left: number; top: number } | null>(null);

  const [drawFrom, setDrawFrom] = useState<string | null>(null);
  const [drawHover, setDrawHover] = useState<string | null>(null);
  const [arrowDraft, setArrowDraft] = useState<string | null>(null);

  const drawable = onDrawArrow !== undefined || onToggleHighlight !== undefined;

  function boardRect() {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }

  function pointToSquare(event: { clientX: number; clientY: number }): string | null {
    const rect = boardRect();
    if (rect === null) {
      return null;
    }
    return squareFromPoint(rect, event.clientX, event.clientY, flipped);
  }

  function focusSquare(index: number) {
    setFocusIndex(index);
    containerRef.current
      ?.querySelector<HTMLButtonElement>(`[data-square-index="${index}"]`)
      ?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!interactive) {
      return;
    }
    /**
     * Square-by-square arrow navigation is reserved for keyboard users: a
     * square reached via Tab matches :focus-visible, one focused by a mouse
     * click does not. Mouse users keep global game navigation — the event
     * falls through to the analysis handler (which listens on window).
     */
    if (!(event.target instanceof HTMLElement) || !event.target.matches(':focus-visible')) {
      return;
    }

    // Keyboard drawing: h toggles a highlight on the focused square, a starts
    // and completes an arrow (Esc cancels the draft) — all colored by
    // modifier keys, same as the pointer gestures.
    if (event.key === 'h' && onToggleHighlight !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onToggleHighlight(squareName(focusIndex), drawColor);
      return;
    }
    if (event.key === 'a' && onDrawArrow !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      const square = squareName(focusIndex);
      if (arrowDraft === null) {
        setArrowDraft(square);
      } else {
        if (square !== arrowDraft) {
          onDrawArrow(arrowDraft, square, drawColor);
        }
        setArrowDraft(null);
      }
      return;
    }
    const colorIndex = ['1', '2', '3', '4'].indexOf(event.key);
    if (colorIndex !== -1 && onDrawColorChange !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      onDrawColorChange(DRAW_COLORS[colorIndex]);
      return;
    }
    if (event.key === 'Escape' && arrowDraft !== null) {
      event.preventDefault();
      event.stopPropagation();
      setArrowDraft(null);
      return;
    }

    let next: number | null = null;
    switch (event.key) {
      case 'ArrowUp':
        next = focusIndex + (flipped ? 8 : -8);
        break;
      case 'ArrowDown':
        next = focusIndex + (flipped ? -8 : 8);
        break;
      case 'ArrowLeft':
        next = focusIndex + (flipped ? 1 : -1);
        break;
      case 'ArrowRight':
        next = focusIndex + (flipped ? -1 : 1);
        break;
    }
    if (next === null || next < 0 || next > 63) {
      return;
    }
    const blockedLeft = flipped ? focusIndex % 8 === 7 : focusIndex % 8 === 0;
    const blockedRight = flipped ? focusIndex % 8 === 0 : focusIndex % 8 === 7;
    if (
      (event.key === 'ArrowLeft' && blockedLeft) ||
      (event.key === 'ArrowRight' && blockedRight)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusSquare(next);
  }

  function handlePointerDown(event: React.PointerEvent) {
    const from = pointToSquare(event);
    if (from === null) {
      return;
    }
    if (event.button === 2 && drawable) {
      // Preventing the right-button pointerdown default is what actually
      // suppresses the context menu in Firefox (Shift+right-click bypasses
      // contextmenu preventDefault there).
      event.preventDefault();
      setDrawFrom(from);
      setDrawHover(from);
      containerRef.current?.setPointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && interactive) {
      dragRef.current = {
        from,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag !== null) {
      if (
        !drag.dragging &&
        Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4
      ) {
        drag.dragging = true;
        const piece = position[squareIndex(drag.from)];
        if (piece !== null && piece !== undefined) {
          containerRef.current?.setPointerCapture?.(event.pointerId);
        }
      }
      if (drag.dragging) {
        const rect = boardRect();
        const piece = position[squareIndex(drag.from)];
        if (rect !== null && piece !== null && piece !== undefined) {
          setGhost({
            piece,
            left: event.clientX - rect.left,
            top: event.clientY - rect.top,
          });
        }
      }
    }
    if (drawFrom !== null) {
      const hover = pointToSquare(event);
      if (hover !== drawHover) {
        setDrawHover(hover);
      }
    }
  }

  function handlePointerUp(event: React.PointerEvent) {
    const drag = dragRef.current;
    if (drag !== null) {
      dragRef.current = null;
      if (drag.dragging) {
        setGhost(null);
        const to = pointToSquare(event);
        onDragMove?.(drag.from, to);
      }
      return;
    }
    if (drawFrom !== null) {
      const to = pointToSquare(event);
      if (to !== null && to !== drawFrom) {
        onDrawArrow?.(drawFrom, to, drawColor);
      } else if (to !== null) {
        onToggleHighlight?.(to, drawColor);
      }
      setDrawFrom(null);
      setDrawHover(null);
    }
  }

  const indices = flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()];
  const rankRow = flipped ? 1 : 8;
  const fileCol = flipped ? 7 : 0;

  const highlightOf = (name: string) => highlights.find((h) => h.square === name);

  const allArrows: { from: string; to: string; color: string }[] = [
    ...arrows.map((arrow) => ({ ...arrow, color: arrow.color ?? arrowColor })),
    ...(drawFrom !== null && drawHover !== null && drawHover !== drawFrom
      ? [{ from: drawFrom, to: drawHover, color: drawColor }]
      : []),
    // Keyboard draft: preview from the draft source to the focused square.
    ...(arrowDraft !== null && squareName(focusIndex) !== arrowDraft
      ? [{ from: arrowDraft, to: squareName(focusIndex), color: drawColor }]
      : []),
  ];

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is img or group, both support aria-label
    // biome-ignore lint/a11y/noStaticElementInteractions: grid container handles bubbled keys and pointer gestures; focus stays on the square buttons
    <div
      ref={containerRef}
      data-board-grid
      className="relative grid aspect-square w-[min(90vw,34rem)] grid-cols-8 grid-rows-8 select-none overflow-hidden rounded-md border border-board-edge shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)] [container-type:inline-size]"
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={(event) => {
        if (interactive || drawable) {
          event.preventDefault();
        }
      }}
    >
      {indices.map((index) => {
        const name = squareName(index);
        const piece = position[index];
        const file = index % 8;
        const rank = 8 - Math.floor(index / 8);
        const shade = isLightSquare(index) ? 'light' : 'dark';
        const isLastMove = lastMove !== null && (lastMove?.from === name || lastMove?.to === name);
        const isSelected = selected === name;
        const isTarget = legalTargets.includes(name);
        const clickable = interactive && onSquareClick !== undefined;
        const drawnHighlight = highlightOf(name);

        const highlight = isSelected ? 'selected' : isLastMove ? 'lastMove' : 'none';
        const squareBg = square({ shade, highlight });

        const content = (
          <>
            {file === fileCol && (
              <span className={`${coord({ shade })} top-0.5 left-1`}>{rank}</span>
            )}
            {rank === rankRow && (
              <span className={`${coord({ shade })} right-1 bottom-0.5`}>{name[0]}</span>
            )}
            {drawnHighlight !== undefined && (
              <div
                data-testid={`highlight-${name}`}
                className="pointer-events-none absolute inset-0.5 rounded-sm"
                style={{
                  backgroundColor: `${drawnHighlight.color}59`,
                  boxShadow: `inset 0 0 0 2px ${drawnHighlight.color}`,
                }}
              />
            )}
            {piece && <PieceGlyph piece={piece} />}
            {checkSquare === name && (
              <div
                data-testid={`check-${name}`}
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(224,90,78,0.95)_10%,rgba(224,90,78,0.55)_45%,transparent_72%)]"
              />
            )}
            {isSelected && (
              <div
                data-testid={`selected-${name}`}
                className="pointer-events-none absolute inset-0 ring-2 ring-select ring-inset"
              />
            )}
            {isTarget &&
              (piece ? (
                <div
                  data-testid={`target-${name}`}
                  className="pointer-events-none absolute inset-[6%] rounded-full border-[5px] border-[rgba(20,22,27,0.35)]"
                />
              ) : (
                <div
                  data-testid={`target-${name}`}
                  className="pointer-events-none absolute h-[28%] w-[28%] rounded-full bg-[rgba(20,22,27,0.3)]"
                />
              ))}
          </>
        );

        if (clickable) {
          return (
            <button
              key={index}
              type="button"
              data-square-index={index}
              data-testid={`square-${name}`}
              aria-label={name}
              aria-pressed={isSelected}
              tabIndex={focusIndex === index ? 0 : -1}
              className={`${squareBg} cursor-pointer`}
              onClick={() => {
                setFocusIndex(index);
                onSquareClick(name);
              }}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={index} data-testid={`square-${name}`} className={squareBg}>
            {content}
          </div>
        );
      })}

      {ghost !== null && (
        <span
          data-testid="drag-ghost"
          className="pointer-events-none absolute z-30 text-[10.4cqi] leading-none"
          style={{
            left: ghost.left,
            top: ghost.top,
            transform: 'translate(-50%, -50%)',
            color: ghost.piece.color === 'w' ? '#f9f9f9' : '#1a1a1a',
            textShadow:
              ghost.piece.color === 'w'
                ? '0 0 2px rgba(26,26,26,0.9), 0 1px 3px rgba(0,0,0,0.55)'
                : '0 1px 1px rgba(255,255,255,0.35)',
          }}
        >
          {pieceGlyph(ghost.piece.color, ghost.piece.kind)}
        </span>
      )}

      {allArrows.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 z-20 h-full w-full"
          viewBox="0 0 8 8"
          aria-hidden="true"
          data-testid="board-arrows"
        >
          {allArrows.map((arrow) => {
            const shape = arrowShape(arrow.from, arrow.to, flipped);
            if (shape === null) {
              return null;
            }
            return (
              <g key={`${arrow.from}-${arrow.to}-${arrow.color}`}>
                <line
                  x1={shape.line.x1}
                  y1={shape.line.y1}
                  x2={shape.line.x2}
                  y2={shape.line.y2}
                  stroke="rgba(20, 22, 27, 0.5)"
                  strokeWidth={0.38}
                  strokeLinecap="round"
                />
                <polygon points={shape.head} fill="rgba(20, 22, 27, 0.5)" />
                <line
                  x1={shape.line.x1}
                  y1={shape.line.y1}
                  x2={shape.line.x2}
                  y2={shape.line.y2}
                  stroke={arrow.color}
                  strokeWidth={0.24}
                  strokeLinecap="round"
                />
                <polygon points={shape.head} fill={arrow.color} data-testid="arrow-head" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function PieceGlyph({ piece }: { piece: Piece }) {
  return (
    <span
      className="text-[10.4cqi] leading-none"
      style={{
        color: piece.color === 'w' ? '#f9f9f9' : '#1a1a1a',
        textShadow:
          piece.color === 'w'
            ? '0 0 2px rgba(26,26,26,0.9), 0 1px 3px rgba(0,0,0,0.55)'
            : '0 1px 1px rgba(255,255,255,0.35)',
      }}
    >
      {pieceGlyph(piece.color, piece.kind)}
    </span>
  );
}
