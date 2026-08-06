import { useRef, useState } from 'react';
import { tv } from 'tailwind-variants';
import {
  isLightSquare,
  type Piece,
  type Position,
  pieceGlyph,
  squareIndex,
  squareName,
} from '@/components/board';

const square = tv({
  base: 'relative flex items-center justify-center',
  variants: {
    shade: { light: 'bg-[#f0d9b5]', dark: 'bg-[#b58863]' },
  },
});

const coord = tv({
  base: 'absolute text-[10px] font-semibold',
  variants: {
    shade: { light: 'text-[#b58863]', dark: 'text-[#f0d9b5]' },
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
  onSquareClick,
}: {
  position: Position;
  lastMove?: { from: string; to: string } | null;
  flipped?: boolean;
  label?: string;
  interactive?: boolean;
  selected?: string | null;
  legalTargets?: string[];
  onSquareClick?: (square: string) => void;
}) {
  const [focusIndex, setFocusIndex] = useState<number>(() =>
    lastMove?.to ? squareIndex(lastMove.to) : squareIndex('e4'),
  );
  const containerRef = useRef<HTMLDivElement | null>(null);

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
      className="grid aspect-square w-[min(90vw,34rem)] grid-cols-8 grid-rows-8 select-none overflow-hidden rounded-lg border border-white/10 shadow-lg"
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

        const content = (
          <>
            {file === fileCol && (
              <span className={`${coord({ shade })} top-0.5 left-1`}>{rank}</span>
            )}
            {rank === rankRow && (
              <span className={`${coord({ shade })} right-1 bottom-0.5`}>{name[0]}</span>
            )}
            {piece && <PieceGlyph piece={piece} />}
            {isLastMove && <div className="absolute inset-0 bg-yellow-400/40" />}
            {isSelected && (
              <div data-testid={`selected-${name}`} className="absolute inset-0 bg-yellow-300/50" />
            )}
            {isTarget &&
              (piece ? (
                <div
                  data-testid={`target-${name}`}
                  className="absolute inset-0 rounded-full border-4 border-emerald-400/70"
                />
              ) : (
                <div
                  data-testid={`target-${name}`}
                  className="absolute h-1/3 w-1/3 rounded-full bg-emerald-400/70"
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
              className={`${square({ shade })} cursor-pointer`}
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
          <div key={index} data-testid={`square-${name}`} className={square({ shade })}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

function PieceGlyph({ piece }: { piece: Piece }) {
  return (
    <span
      className="text-[min(10vw,3.75rem)] leading-none"
      style={{
        color: piece.color === 'w' ? '#f9f9f9' : '#1a1a1a',
        textShadow:
          piece.color === 'w' ? '0 1px 3px rgba(0,0,0,0.55)' : '0 1px 1px rgba(255,255,255,0.35)',
      }}
    >
      {pieceGlyph(piece.color, piece.kind)}
    </span>
  );
}
