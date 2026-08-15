import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Piece,
  type PieceColor,
  type PieceKind,
  parseFen,
  pieceSrc,
} from '@/components/board';
import { plyLabel } from '@/features/analysis/GameFlow';
import type { GameNode, GameTree } from '@/lib/api';

/** Chart geometry: a 100×40 viewBox stretched to full width. */
const WIDTH = 100;
const HEIGHT = 40;

const VALUES: Record<PieceKind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

type Capture = { by: Piece; victim: Piece };
type MaterialPoint = { ply: number; balance: number; capture: Capture | null };

function balanceOf(position: (Piece | null)[]): number {
  let balance = 0;
  for (const piece of position) {
    if (piece !== null) {
      balance += piece.color === 'w' ? VALUES[piece.kind] : -VALUES[piece.kind];
    }
  }
  return balance;
}

function countsOf(position: (Piece | null)[], color: PieceColor): Map<PieceKind, number> {
  const counts = new Map<PieceKind, number>();
  for (const piece of position) {
    if (piece !== null && piece.color === color) {
      counts.set(piece.kind, (counts.get(piece.kind) ?? 0) + 1);
    }
  }
  return counts;
}

/** The capturer's kind from the SAN: 'Nxd4' → knight, 'exd4' → pawn. */
function capturerKind(san: string): PieceKind {
  const first = san[0];
  return 'KQRBN'.includes(first) ? (first.toLowerCase() as PieceKind) : 'p';
}

/**
 * Material over the mainline: the balance (white − black, in pawns) per ply
 * and every capture — the victim from the piece-count diff between positions
 * (en passant included), the capturer from the SAN. Pure tree data; no
 * engine analysis needed.
 */
export function materialTimeline(root: GameNode): MaterialPoint[] {
  const points: MaterialPoint[] = [];
  let node: GameNode | null = root;
  let prevCounts: { w: Map<PieceKind, number>; b: Map<PieceKind, number> } | null = null;

  while (node !== null) {
    const position = node.fen === null ? null : parseFen(node.fen);
    if (position === null) {
      node = node.children[0] ?? null;
      continue;
    }
    const w = countsOf(position, 'w');
    const b = countsOf(position, 'b');

    let capture: Capture | null = null;
    if (node.san?.includes('x') === true && prevCounts !== null) {
      const mover: PieceColor = node.ply % 2 === 1 ? 'w' : 'b';
      const victimColor: PieceColor = mover === 'w' ? 'b' : 'w';
      const before = victimColor === 'w' ? prevCounts.w : prevCounts.b;
      const after = victimColor === 'w' ? w : b;
      // The victim is the kind whose count dropped; the en-passant pawn is
      // the only capture that leaves no target-square trace, hence 'p' last.
      let victimKind: PieceKind = 'p';
      for (const kind of ['q', 'r', 'b', 'n', 'k', 'p'] as PieceKind[]) {
        if ((after.get(kind) ?? 0) < (before.get(kind) ?? 0)) {
          victimKind = kind;
          break;
        }
      }
      capture = {
        by: { color: mover, kind: capturerKind(node.san) },
        victim: { color: victimColor, kind: victimKind },
      };
    }

    points.push({ ply: node.ply, balance: balanceOf(position), capture });
    prevCounts = { w, b };
    node = node.children[0] ?? null;
  }
  return points;
}

/** "+3" / "0" / "-2" — the material balance in pawns, white's perspective. */
function balanceText(balance: number): string {
  return balance > 0 ? `+${balance}` : String(balance);
}

/** The area on white's side: down to the bottom edge, or up when flipped. */
function areaPath(points: { x: number; y: number }[], flipped: boolean): string {
  const edge = flipped ? 0 : HEIGHT;
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return `M${first.x.toFixed(2)} ${edge} ${line} L${last.x.toFixed(2)} ${edge} Z`;
}

/**
 * The material timeline: white's material share over the mainline (a pawn
 * ≈ 5% from the midline), mirrored with the board like the eval chart, with
 * the captured pieces appearing on the track below at the ply they fell.
 * Click or drag to jump to a ply; hovering reveals the balance and the
 * capture made there. Needs no engine analysis.
 */
export default function MaterialFlow({
  tree,
  currentPly,
  flipped = false,
  onSelectPly,
}: {
  tree: GameTree;
  currentPly: number;
  flipped?: boolean;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const scrubbedTo = useRef<number | null>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);
  // Touch has no hover: the tooltip floats above the chart and stays put.
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  const points = useMemo(() => materialTimeline(tree.root), [tree]);
  const maxPly = points.length > 0 ? points[points.length - 1].ply : 0;
  const pointByPly = useMemo(() => new Map(points.map((p) => [p.ply, p])), [points]);

  if (maxPly === 0) {
    return null;
  }

  // ±10 pawns spans the full chart; a queen (9) swings ~45%.
  const shareOf = (balance: number) => Math.min(98, Math.max(2, 50 + balance * 5));
  const chartPoints = points.map((p) => {
    const share = shareOf(p.balance);
    return {
      x: (p.ply / maxPly) * WIDTH,
      y: ((flipped ? share : 100 - share) / 100) * HEIGHT,
    };
  });

  const markerX = (Math.min(Math.max(currentPly, 0), maxPly) / maxPly) * WIDTH;

  function plyAt(event: React.PointerEvent<HTMLDivElement>): number | null {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) {
      return null;
    }
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return Math.round(fraction * maxPly);
  }

  function scrub(event: React.PointerEvent<HTMLDivElement>) {
    const ply = plyAt(event);
    if (ply !== null && ply !== scrubbedTo.current) {
      scrubbedTo.current = ply;
      onSelectPly(ply);
    }
  }

  const hoverX = hoverPly === null ? null : (hoverPly / maxPly) * WIDTH;
  const hoverFraction = hoverPly === null ? 0 : hoverPly / maxPly;
  const hoverPoint = hoverPly === null ? null : pointByPly.get(hoverPly);
  const tooltipShift =
    hoverFraction < 0.12
      ? 'translate-x-0'
      : hoverFraction > 0.88
        ? '-translate-x-full'
        : '-translate-x-1/2';

  return (
    <div
      className="flex h-44 cursor-crosshair flex-col touch-none select-none"
      role="img"
      aria-label={t('analysis.materialFlow')}
      data-testid="material-flow"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        scrubbedTo.current = null;
        setHoverPly(plyAt(event));
        scrub(event);
      }}
      onPointerMove={(event) => {
        setHoverPly(plyAt(event));
        if ((event.buttons & 1) === 1) {
          scrub(event);
        }
      }}
      onPointerUp={() => {
        scrubbedTo.current = null;
      }}
      onPointerCancel={() => {
        scrubbedTo.current = null;
        setHoverPly(null);
      }}
      onPointerLeave={() => {
        scrubbedTo.current = null;
        if (!coarse) {
          setHoverPly(null);
        }
      }}
    >
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block h-full w-full rounded-control border border-line bg-[#1a1d24]"
        >
          <path
            d={areaPath(chartPoints, flipped)}
            className="fill-[#f4f6fb]"
            data-testid="material-flow-area"
          />
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            className="stroke-line-strong opacity-60"
            vectorEffect="non-scaling-stroke"
            strokeWidth={1}
          />
          {hoverX !== null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={0}
              y2={HEIGHT}
              className="stroke-white/40"
              vectorEffect="non-scaling-stroke"
              strokeWidth={1}
            />
          )}
          <line
            x1={markerX}
            x2={markerX}
            y1={0}
            y2={HEIGHT}
            className="stroke-gold"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            data-testid="material-flow-marker"
          />
        </svg>
        {hoverPly !== null && hoverPoint != null && (
          <div
            className={`pointer-events-none absolute z-10 flex items-center gap-1 rounded-chip border border-line-strong bg-panel/95 px-1.5 py-0.5 font-semibold text-[10px] whitespace-nowrap tabular-nums text-ink backdrop-blur-sm ${tooltipShift} ${
              coarse ? '-top-7' : 'top-1'
            }`}
            style={{ left: `${hoverFraction * 100}%` }}
            data-testid="material-flow-tooltip"
          >
            {plyLabel(hoverPly, t('analysis.startPosition'))}
            {hoverPoint.capture !== null && (
              <span className="inline-flex items-center gap-0.5">
                <img src={pieceSrc(hoverPoint.capture.by)} alt="" className="h-3 w-3" />×
                <img src={pieceSrc(hoverPoint.capture.victim)} alt="" className="h-3 w-3" />
              </span>
            )}
            {balanceText(hoverPoint.balance)}
          </div>
        )}
      </div>
      {/*
        The captures track: each fallen piece at the ply it disappeared, on
        the same x-axis as the chart. Inert — the wrapper's pointer handlers
        cover it, like the eval chart's quality strip.
      */}
      <div className="relative mt-1 h-3" data-testid="material-flow-captures">
        {points
          .filter((p) => p.capture !== null)
          .map((p) => (
            <img
              key={p.ply}
              src={pieceSrc((p.capture as Capture).victim)}
              alt=""
              className="pointer-events-none absolute top-0 h-3 w-3 -translate-x-1/2"
              style={{ left: `${(p.ply / maxPly) * 100}%` }}
              data-testid="material-flow-capture"
            />
          ))}
      </div>
    </div>
  );
}
