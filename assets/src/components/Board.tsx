import { useEffect, useRef, useState } from 'react';
import { tv } from 'tailwind-variants';
import {
  arrowShape,
  DRAW_COLORS,
  isLightSquare,
  type Piece,
  type Position,
  pieceSrc,
  squareFromPoint,
  squareIndex,
  squareName,
} from '@/components/board';
import type { DrawnHighlight } from '@/protocol/ops';

const square = tv({
  base: 'relative flex items-center justify-center aspect-square select-none focus-visible:z-20 focus-visible:shadow-[inset_0_0_0_2px_var(--color-surface),inset_0_0_0_4px_var(--color-gold-hi)]',
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

export type BoardArrow = { from: string; to: string; color?: string; hint?: boolean };

/** Touch/pen drawing: hold this long without moving to start a draw. */
const LONG_PRESS_MS = 350;
/** Finger travel that cancels a pending long-press (and keeps the drag). */
const LONG_PRESS_TOLERANCE_PX = 10;

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
  paintBrush,
  onPaintSquare,
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
  /**
   * Edit-mode brush (a palette piece or the eraser): pressing a square
   * paints it there, and holding the button sweeps across squares —
   * lichess-style. When set, board pieces can't be dragged (the brush owns
   * the press).
   */
  paintBrush?: Piece | 'erase' | null;
  onPaintSquare?: (square: string) => void;
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

  // Right-button drawing is tracked with window-level listeners while active:
  // some browsers (Vivaldi's mouse gestures, Firefox's menu) interfere with
  // right-button drags, and the sequence must always complete. Touch and pen
  // input (no right button) starts the same gesture via long-press instead.
  const drawRef = useRef<{
    from: string;
    hover: string | null;
    pointerId: number;
    fromRightButton: boolean;
  } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{ from: string; to: string } | null>(null);
  // A same-square draw is a highlight toggle: show it as soon as the
  // gesture starts (the long-press fires), not only on release.
  const [highlightPreview, setHighlightPreview] = useState<string | null>(null);
  const [arrowDraft, setArrowDraft] = useState<string | null>(null);
  // A finished long-press draw suppresses the synthetic click that the
  // release still produces, so lifting the finger doesn't also select/move.
  const suppressClickRef = useRef(false);
  // Brush painting (edit mode): active while the button is held after a
  // paint-press, with the last painted square so sweeps don't repeat.
  const paintingRef = useRef(false);
  const lastPaintedRef = useRef<string | null>(null);
  const longPressRef = useRef<{
    pointerId: number;
    from: string;
    startX: number;
    startY: number;
    timer: number;
  } | null>(null);
  // The active draw's window listeners, so they can be removed on unmount.
  const drawCleanupRef = useRef<(() => void) | null>(null);

  const drawable = onDrawArrow !== undefined || onToggleHighlight !== undefined;

  // Release gesture listeners and the long-press timer on unmount (e.g.
  // switching games mid-drag): nothing may fire into the old view.
  useEffect(() => {
    const longPress = longPressRef;
    const drawCleanup = drawCleanupRef;
    return () => {
      if (longPress.current !== null) {
        window.clearTimeout(longPress.current.timer);
        longPress.current = null;
      }
      drawCleanup.current?.();
    };
  }, []);

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
     * Square keys apply whenever a square is focused. Pointer interaction
     * never focuses squares (see handlePointerDown), so focus always means
     * keyboard intent — no :focus-visible heuristics, which Firefox drops
     * for programmatic focus.
     */
    if (
      !(event.target instanceof HTMLElement) ||
      event.target.closest('[data-board-grid]') === null ||
      event.target.closest('[data-square-index]') === null
    ) {
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
    // A new press means any pending click suppression has served its purpose
    // (the suppressed click always fires right after the draw's release).
    suppressClickRef.current = false;
    // A brush paints on press, not release — and owns the gesture (no drag).
    if (event.button === 0 && paintBrush != null && onPaintSquare !== undefined) {
      event.preventDefault();
      paintingRef.current = true;
      lastPaintedRef.current = from;
      onPaintSquare(from);
      return;
    }
    // Mouse/pointer interaction never takes keyboard focus: a focused square
    // always means keyboard intent, which keeps square navigation working in
    // Firefox (its :focus-visible heuristics drop programmatic focus).
    if (event.button !== 2 && interactive) {
      event.preventDefault();
    }
    if (event.button === 2 && drawable) {
      event.preventDefault();
      startDraw(from, event.pointerId, true);
      return;
    }
    if (event.button === 0 && interactive) {
      dragRef.current = {
        from,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
      // Touch and pen have no right button: long-press starts the drawing
      // gesture instead. Moving early wins the piece drag; releasing early
      // stays a plain tap.
      if (drawable && (event.pointerType === 'touch' || event.pointerType === 'pen')) {
        const pointerId = event.pointerId;
        longPressRef.current = {
          pointerId,
          from,
          startX: event.clientX,
          startY: event.clientY,
          timer: window.setTimeout(() => {
            longPressRef.current = null;
            dragRef.current = null;
            setGhost(null);
            startDraw(from, pointerId, false);
          }, LONG_PRESS_MS),
        };
      }
    }
  }

  /**
   * Drawing is tracked on window listeners so the gesture always completes —
   * browser gesture layers (Vivaldi) and context menus interfere with
   * container-level right-drag sequences. Events are matched by pointerId so
   * touch/pen long-press draws (whose pointerup has button 0) work too.
   */
  function startDraw(from: string, pointerId: number, fromRightButton: boolean) {
    drawRef.current = { from, hover: from, pointerId, fromRightButton };
    setHighlightPreview(from);
    containerRef.current?.setPointerCapture?.(pointerId);

    const finish = (to: string | null) => {
      drawCleanupRef.current?.();
      drawCleanupRef.current = null;
      const draw = drawRef.current;
      drawRef.current = null;
      setDrawPreview(null);
      setHighlightPreview(null);
      if (draw === null || to === null) {
        return;
      }
      if (!draw.fromRightButton) {
        suppressClickRef.current = true;
      }
      if (to !== draw.from) {
        onDrawArrow?.(draw.from, to, drawColor);
      } else {
        onToggleHighlight?.(to, drawColor);
      }
    };
    const onMove = (event: PointerEvent) => {
      const draw = drawRef.current;
      if (draw === null || event.pointerId !== draw.pointerId) {
        return;
      }
      // Vivaldi's mouse-gesture layer swallows the whole right-button drag,
      // pointerup included; the first event delivered after the button was
      // released arrives with buttons=0. Treat "right button no longer held"
      // as the end of the draw, committing at the current position. Only for
      // mouse-initiated draws: touch/pen moves never carry the right-button
      // bit while the contact is still down.
      if (draw.fromRightButton && (event.buttons & 2) === 0) {
        finish(pointToSquare(event));
        return;
      }
      draw.hover = pointToSquare(event);
      setHighlightPreview(draw.hover === draw.from ? draw.from : null);
      setDrawPreview(
        draw.hover !== null && draw.hover !== draw.from
          ? { from: draw.from, to: draw.hover }
          : null,
      );
    };
    const onEnd = (event: PointerEvent) => {
      if (event.pointerId !== drawRef.current?.pointerId) {
        return;
      }
      finish(pointToSquare(event));
    };
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== drawRef.current?.pointerId) {
        return;
      }
      finish(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onCancel);
    drawCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onCancel);
    };
  }

  function cancelLongPress() {
    const lp = longPressRef.current;
    if (lp !== null) {
      window.clearTimeout(lp.timer);
      longPressRef.current = null;
    }
  }

  function handlePointerMove(event: React.PointerEvent) {
    // A held brush paints every square it sweeps over.
    if (paintingRef.current) {
      const square = pointToSquare(event);
      if (square !== null && square !== lastPaintedRef.current) {
        lastPaintedRef.current = square;
        onPaintSquare?.(square);
      }
      return;
    }
    const lp = longPressRef.current;
    if (
      lp !== null &&
      event.pointerId === lp.pointerId &&
      Math.hypot(event.clientX - lp.startX, event.clientY - lp.startY) > LONG_PRESS_TOLERANCE_PX
    ) {
      cancelLongPress();
    }
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
  }

  function handlePointerUp(event: React.PointerEvent) {
    cancelLongPress();
    paintingRef.current = false;
    lastPaintedRef.current = null;
    const drag = dragRef.current;
    if (drag !== null) {
      dragRef.current = null;
      if (drag.dragging) {
        setGhost(null);
        const to = pointToSquare(event);
        onDragMove?.(drag.from, to);
      }
    }
  }

  function handlePointerCancel() {
    cancelLongPress();
    paintingRef.current = false;
    lastPaintedRef.current = null;
    dragRef.current = null;
    setGhost(null);
  }

  const indices = flipped ? [...Array(64).keys()].reverse() : [...Array(64).keys()];
  const rankRow = flipped ? 1 : 8;
  const fileCol = flipped ? 7 : 0;

  const highlightOf = (name: string) => highlights.find((h) => h.square === name);

  const allArrows: { from: string; to: string; color: string; hint?: boolean }[] = [
    ...arrows.map((arrow) => ({ ...arrow, color: arrow.color ?? arrowColor })),
    ...(drawPreview !== null
      ? [{ from: drawPreview.from, to: drawPreview.to, color: drawColor }]
      : []),
    // Keyboard draft: preview from the draft source to the focused square.
    ...(arrowDraft !== null && squareName(focusIndex) !== arrowDraft
      ? [{ from: arrowDraft, to: squareName(focusIndex), color: drawColor }]
      : []),
  ];

  return (
    // Board width: viewport minus the page padding (1.5rem), the eval/palette
    // slot (2.5rem) and the row gap (0.75rem), capped at 34rem — the board row
    // never overflows a phone.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is img or group, both support aria-label
    // biome-ignore lint/a11y/noStaticElementInteractions: grid container handles bubbled keys and pointer gestures; focus stays on the square buttons
    <div
      ref={containerRef}
      data-board-grid
      className={`relative grid aspect-square w-[min(calc(100vw-4.75rem),34rem)] self-start grid-cols-8 grid-rows-8 select-none overflow-hidden rounded-md border border-board-edge shadow-board [-webkit-touch-callout:none] [container-type:inline-size] ${interactive ? 'touch-none' : ''}`}
      role={interactive ? 'group' : 'img'}
      aria-label={label}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
            {highlightPreview === name && (
              <div
                data-testid={`highlight-preview-${name}`}
                className="pointer-events-none absolute inset-0.5 animate-pulse-soft rounded-sm"
                style={{
                  backgroundColor: `${drawColor}59`,
                  boxShadow: `inset 0 0 0 2px ${drawColor}`,
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
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
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
          className="pointer-events-none absolute z-30 leading-none"
          style={{
            left: ghost.left,
            top: ghost.top,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <img
            src={pieceSrc(ghost.piece)}
            alt=""
            draggable={false}
            data-piece={`${ghost.piece.color}${ghost.piece.kind}`}
            className="w-[10.4cqi] select-none"
          />
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
            // Engine hint arrows are "ghosts": thinner and translucent, no
            // bold outline, so they can never be confused with the solid
            // user-drawn annotations — even when the colors match.
            if (arrow.hint === true) {
              return (
                <g key={`${arrow.from}-${arrow.to}-${arrow.color}`} opacity={0.55}>
                  <line
                    x1={shape.line.x1}
                    y1={shape.line.y1}
                    x2={shape.line.x2}
                    y2={shape.line.y2}
                    stroke={arrow.color}
                    strokeWidth={0.14}
                    strokeLinecap="round"
                  />
                  <polygon points={shape.head} fill={arrow.color} data-testid="arrow-head" />
                </g>
              );
            }
            return (
              <g key={`${arrow.from}-${arrow.to}-${arrow.color}`}>
                <line
                  x1={shape.line.x1}
                  y1={shape.line.y1}
                  x2={shape.line.x2}
                  y2={shape.line.y2}
                  stroke={arrow.color}
                  strokeWidth={0.28}
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
    <img
      src={pieceSrc(piece)}
      alt=""
      draggable={false}
      data-piece={`${piece.color}${piece.kind}`}
      className="pointer-events-none h-[85%] w-[85%] select-none"
    />
  );
}
