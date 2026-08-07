"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FILES,
  PIECE_GLYPH,
  PIECE_NAME,
  colorOf,
  inCheck,
  isLightSquare,
  kingSquare,
  legalMoves,
  parseFen,
  squareIndex,
  squareName,
  toSan,
} from "@/lib/chess";
import { square } from "@/ui/variants";

export interface BoardShape {
  /** future: drawable arrows + highlights arrive over the same protocol */
  kind: "arrow" | "highlight";
  from: string;
  to?: string;
  color?: "gold" | "info" | "ok" | "bad";
}

interface BoardProps {
  fen: string;
  lastMove?: { from: string; to: string } | null;
  orientation: "white" | "black";
  interactive?: boolean;
  shapes?: BoardShape[];
  onMove?: (from: string, to: string, promotion?: string) => void;
  onAnnounce?: (message: string) => void;
}

const SHAPE_COLOR: Record<string, string> = {
  gold: "var(--color-gold)",
  info: "var(--color-info)",
  ok: "var(--color-ok)",
  bad: "var(--color-bad)",
};

export function Board({
  fen,
  lastMove,
  orientation,
  interactive = true,
  shapes = [],
  onMove,
  onAnnounce,
}: BoardProps) {
  const position = useMemo(() => parseFen(fen), [fen]);
  // selection is tied to the position it was made in — no reset effect needed
  const [selection, setSelection] = useState<{ fen: string; index: number | null }>({
    fen,
    index: null,
  });
  const selected = selection.fen === fen ? selection.index : null;
  const setSelected = (index: number | null) => setSelection({ fen, index });
  const [cursor, setCursor] = useState<number>(() =>
    orientation === "white" ? squareIndex("e2") : squareIndex("e7"),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedRef = useRef(false);

  const targets = useMemo(() => {
    if (selected === null) return new Map<number, string>();
    const map = new Map<number, string>();
    for (const m of legalMoves(position, selected)) map.set(m.to, toSan(position, m));
    return map;
  }, [position, selected]);

  const checkSquare = inCheck(position, position.turn)
    ? kingSquare(position, position.turn)
    : -1;

  const order = useMemo(() => {
    const idx = Array.from({ length: 64 }, (_, i) => i);
    return orientation === "white" ? idx : idx.slice().reverse();
  }, [orientation]);

  const lastFrom = lastMove ? squareIndex(lastMove.from) : -1;
  const lastTo = lastMove ? squareIndex(lastMove.to) : -1;

  function focusSquare(index: number) {
    setCursor(index);
    refs.current[index]?.focus();
  }

  function activate(index: number) {
    const piece = position.board[index];
    if (selected !== null && targets.has(index)) {
      const promotion =
        position.board[selected]?.toLowerCase() === "p" &&
        (index < 8 || index > 55)
          ? "q"
          : undefined;
      onMove?.(squareName(selected), squareName(index), promotion);
      onAnnounce?.(`${targets.get(index)} played`);
      setSelected(null);
      return;
    }
    if (piece && colorOf(piece) === position.turn && interactive) {
      setSelected(index === selected ? null : index);
      onAnnounce?.(
        index === selected
          ? "Selection cleared"
          : `${PIECE_NAME[piece.toLowerCase()]} on ${squareName(index)} selected, ${
              legalMoves(position, index).length
            } legal moves`,
      );
      return;
    }
    setSelected(null);
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const file = index & 7;
    const rank = index >> 3;
    const flip = orientation === "black" ? -1 : 1;
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = rank * 8 + Math.min(7, Math.max(0, file + flip));
        break;
      case "ArrowLeft":
        next = rank * 8 + Math.min(7, Math.max(0, file - flip));
        break;
      case "ArrowUp":
        next = Math.min(7, Math.max(0, rank - flip)) * 8 + file;
        break;
      case "ArrowDown":
        next = Math.min(7, Math.max(0, rank + flip)) * 8 + file;
        break;
      case "Home":
        next = rank * 8;
        break;
      case "End":
        next = rank * 8 + 7;
        break;
      case "Escape":
        setSelected(null);
        onAnnounce?.("Selection cleared");
        event.preventDefault();
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        activate(index);
        return;
      default:
        return;
    }
    if (next !== null) {
      event.preventDefault();
      focusSquare(next);
    }
  }

  return (
    <div className="relative">
      <div
        role="grid"
        aria-label="Analysis board. Arrow keys move, Enter selects and plays, Escape clears."
        style={{ containerType: "inline-size" }}
        className="grid grid-board overflow-hidden rounded-[6px] border border-board-edge shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]"
        onFocus={() => (focusedRef.current = true)}
      >
        {order.map((index) => {
          const piece = position.board[index];
          const isTarget = targets.has(index);
          const state =
            index === checkSquare
              ? "check"
              : index === selected
                ? "selected"
                : index === lastFrom || index === lastTo
                  ? "lastMove"
                  : "default";
          const name = squareName(index);
          const label = piece
            ? `${colorOf(piece) === "w" ? "White" : "Black"} ${PIECE_NAME[piece.toLowerCase()]} on ${name}`
            : `Empty square ${name}`;
          return (
            <button
              key={index}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="gridcell"
              tabIndex={cursor === index ? 0 : -1}
              aria-label={isTarget ? `${label}. Legal move: ${targets.get(index)}` : label}
              aria-selected={index === selected}
              onClick={() => {
                setCursor(index);
                activate(index);
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={square({
                shade: isLightSquare(index) ? "light" : "dark",
                state,
                interactive: interactive,
              })}
            >
              {/* legal-target affordance: dot for quiet moves, ring for captures */}
              {isTarget &&
                (piece ? (
                  <span className="absolute inset-[6%] rounded-full border-[5px] border-[rgba(20,22,27,0.35)]" />
                ) : (
                  <span className="absolute h-[28%] w-[28%] rounded-full bg-[rgba(20,22,27,0.3)]" />
                ))}
              {piece && (
                <span
                  className={`relative z-10 leading-none ${
                    colorOf(piece) === "w"
                      ? "text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_1px_#333]"
                      : "text-[#2a2418]"
                  }`}
                  style={{ fontSize: "10.4cqi" }}
                >
                  {PIECE_GLYPH[piece]}
                </span>
              )}
              {/* coordinates, lichess-style: file letters on rank 1, ranks on file a */}
              {(index >> 3) === (orientation === "white" ? 7 : 0) && (
                <span
                  className={`pointer-events-none absolute bottom-px right-[3px] text-[9px] font-bold ${
                    isLightSquare(index) ? "text-board-dark" : "text-board-light"
                  }`}
                >
                  {FILES[index & 7]}
                </span>
              )}
              {(index & 7) === (orientation === "white" ? 0 : 7) && (
                <span
                  className={`pointer-events-none absolute left-[3px] top-px text-[9px] font-bold ${
                    isLightSquare(index) ? "text-board-dark" : "text-board-light"
                  }`}
                >
                  {8 - (index >> 3)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overlay reserved for drawable arrows / highlights (protocol-ready) */}
      <svg
        viewBox="0 0 8 8"
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <defs>
          <marker id="bf-arrow" markerWidth="3" markerHeight="3" refX="1.6" refY="1.5" orient="auto">
            <path d="M0,0 L3,1.5 L0,3 z" fill="context-stroke" />
          </marker>
        </defs>
        {shapes.map((shape, i) => {
          const point = (name: string) => {
            const index = squareIndex(name);
            const file = index & 7;
            const rank = index >> 3;
            const x = orientation === "white" ? file : 7 - file;
            const y = orientation === "white" ? rank : 7 - rank;
            return { x: x + 0.5, y: y + 0.5 };
          };
          const color = SHAPE_COLOR[shape.color ?? "gold"];
          if (shape.kind === "highlight") {
            const p = point(shape.from);
            return (
              <rect
                key={i}
                x={p.x - 0.5}
                y={p.y - 0.5}
                width={1}
                height={1}
                fill={color}
                opacity={0.35}
              />
            );
          }
          const a = point(shape.from);
          const b = point(shape.to ?? shape.from);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={color}
              strokeWidth={0.16}
              strokeLinecap="round"
              opacity={0.85}
              markerEnd="url(#bf-arrow)"
            />
          );
        })}
      </svg>
    </div>
  );
}
