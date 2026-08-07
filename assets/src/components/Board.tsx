import { useId, useRef, useState } from 'react';
import { tv } from 'tailwind-variants';
import {
  arrowLine,
  isLightSquare,
  type Piece,
  type Position,
  pieceGlyph,
  squareIndex,
  squareName,
} from '@/components/board';

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

/**
 * WAI-ARIA grid pattern for the interactive board: one square in the tab
 * order (the focused square), arrow keys move between squares (flip-
 * invariant, clamped at the board edges), Enter/Space activate a square via
 * the native button behavior. Movement happens in index space, so it is
 * independent of the display order when flipped.
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
  checkSquare = null,
  onSquareClick,
}: {
  position: Position;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
  label?: string;
  interactive?: boolean;
  selected?: string | null;
  legalTargets?: string[];
  arrows?: { from: string; to: string }[];
  arrowColor?: string;
  checkSquare?: string | null;
  onSquareClick?: (square: string) => void;
}) {
  const [focusIndex, setFocusIndex] = useState<number>(() =>
    lastMove?.to ? squareIndex(lastMove.to) : squareIndex('e4'),
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerId = useId();

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

  const indices = flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()];
  const rankRow = flipped ? 1 : 8;
  const fileCol = flipped ? 7 : 0;

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is img or group, both support aria-label
    // biome-ignore lint/a11y/noStaticElementInteractions: grid container listens for bubbled arrow keys; focus stays on the square buttons
    <div
      ref={containerRef}
      data-board-grid
      className="relative grid aspect-square w-[min(90vw,34rem)] grid-cols-8 grid-rows-8 select-none overflow-hidden rounded-md border border-board-edge shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)] [container-type:inline-size]"
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      onKeyDown={handleKeyDown}
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

      {arrows.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 8 8"
          aria-hidden="true"
          data-testid="board-arrows"
        >
          <defs>
            <marker
              id={`${markerId}-head`}
              viewBox="0 0 1 1"
              refX="0.8"
              refY="0.5"
              markerWidth="0.85"
              markerHeight="0.85"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L1,0.5 L0,1 Z" fill={arrowColor} />
            </marker>
          </defs>
          {arrows.map((arrow) => {
            const line = arrowLine(arrow.from, arrow.to, flipped);
            return (
              <g key={`${arrow.from}-${arrow.to}`}>
                <line
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(20, 22, 27, 0.5)"
                  strokeWidth={0.38}
                  strokeLinecap="round"
                />
                <line
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke={arrowColor}
                  strokeWidth={0.24}
                  strokeLinecap="round"
                  markerEnd={`url(#${markerId}-head)`}
                />
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
