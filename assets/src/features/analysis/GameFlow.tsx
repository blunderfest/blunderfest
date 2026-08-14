import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BookExitIcon from '@/features/analysis/BookExitIcon';
import { evalText, type MoveMark, moveMark } from '@/features/analysis/evalMarks';
import { type WhiteEval, whiteShare } from '@/features/analysis/uci';
import type { AnalysisEval } from '@/protocol/ops';

/** Chart geometry: a 100×40 viewBox stretched to full width. */
const WIDTH = 100;
const HEIGHT = 40;

type Point = { x: number; y: number };

function toWhiteEval(score: AnalysisEval['score']): WhiteEval | null {
  if (score === null) {
    return null;
  }
  if (score.cp !== undefined) {
    return { type: 'cp', cp: score.cp };
  }
  if (score.mate !== undefined) {
    return { type: 'mate', moves: score.mate };
  }
  return null;
}

/**
 * The area on white's side of a segment: down to the bottom edge normally,
 * up to the top edge with a flipped board (white's pieces at the top).
 */
function areaPath(segment: Point[], flipped: boolean): string {
  const edge = flipped ? 0 : HEIGHT;
  const first = segment[0];
  const last = segment[segment.length - 1];
  const line = segment.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return `M${first.x.toFixed(2)} ${edge} ${line} L${last.x.toFixed(2)} ${edge} Z`;
}

/** "12." / "12…" / "start position" — the hovered ply as a move label. */
function plyLabel(ply: number, startLabel: string): string {
  if (ply === 0) {
    return startLabel;
  }
  return ply % 2 === 1 ? `${(ply + 1) / 2}.` : `${ply / 2}…`;
}

/**
 * The game-flow chart (ADR-0009): engine eval over the mainline, the same
 * mapping as the eval bar — white's territory on white's side of the chart,
 * mirrored when the board is flipped. Click or drag to jump to a ply;
 * hovering reveals the ply and its exact eval. Rendered once a whole-game
 * analysis exists.
 */
export default function GameFlow({
  evals,
  currentPly,
  flipped = false,
  openingExitPly = null,
  onSelectPly,
}: {
  evals: AnalysisEval[];
  currentPly: number;
  /** Board orientation: white's territory sits on white's side of the board. */
  flipped?: boolean;
  /** The ply where the line leaves the opening book (dashed marker). */
  openingExitPly?: number | null;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  /** The last ply pushed during a drag, so identical moves aren't repeated. */
  const scrubbedTo = useRef<number | null>(null);
  /** The ply under the pointer, for the hover readout. */
  const [hoverPly, setHoverPly] = useState<number | null>(null);
  /**
   * Touch has no hover: on coarse pointers the tooltip floats above the
   * chart (a finger would cover it inside) and stays put on release — a
   * tap also navigates to that ply, so it reads as the current eval.
   */
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  const maxPly = evals.length > 0 ? evals[evals.length - 1].ply : 0;

  const evalByPly = useMemo(
    () => new Map(evals.map((evaluation) => [evaluation.ply, evaluation.score])),
    [evals],
  );

  // Consecutive non-null evals form segments; a failed eval breaks the area.
  const segments: Point[][] = [];
  if (maxPly > 0) {
    let segment: Point[] = [];
    for (const evaluation of evals) {
      const white = toWhiteEval(evaluation.score);
      if (white === null) {
        if (segment.length > 0) {
          segments.push(segment);
        }
        segment = [];
        continue;
      }
      const share = whiteShare(white); // 2..98 — 50 is level, 98 white is winning
      segment.push({
        x: (evaluation.ply / maxPly) * WIDTH,
        y: ((flipped ? share : 100 - share) / 100) * HEIGHT,
      });
    }
    if (segment.length > 0) {
      segments.push(segment);
    }
  }

  if (maxPly === 0) {
    return null;
  }

  /** Move-quality dots on the curve, from consecutive evals (same math as the move list). */
  const marks: { ply: number; mark: MoveMark; xPct: number; yPct: number }[] = [];
  for (const evaluation of evals) {
    if (evaluation.ply === 0 || evaluation.score === null) {
      continue;
    }
    const mark = moveMark(
      evalByPly.get(evaluation.ply - 1) ?? null,
      evaluation.score,
      evaluation.ply % 2 === 1,
    );
    if (mark === null) {
      continue;
    }
    const white = toWhiteEval(evaluation.score);
    if (white === null) {
      continue;
    }
    const share = whiteShare(white);
    marks.push({
      ply: evaluation.ply,
      mark,
      xPct: (evaluation.ply / maxPly) * 100,
      yPct: flipped ? share : 100 - share,
    });
  }

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
  // Keep the tooltip inside the chart near its left/right edges.
  const tooltipShift =
    hoverFraction < 0.12
      ? 'translate-x-0'
      : hoverFraction > 0.88
        ? '-translate-x-full'
        : '-translate-x-1/2';
  const tooltipVertical = coarse ? '-top-7' : 'top-1';

  return (
    <div
      className="relative cursor-crosshair touch-none select-none"
      role="img"
      aria-label={t('analysis.gameFlow')}
      data-testid="game-flow"
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
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        className="block h-16 w-full rounded-control border border-line bg-[#1a1d24]"
      >
        {segments.map((segment) =>
          segment.length > 1 ? (
            <path
              key={segment[0].x}
              d={areaPath(segment, flipped)}
              className="fill-[#f4f6fb]"
              data-testid="game-flow-area"
            />
          ) : null,
        )}
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
            data-testid="game-flow-hover"
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
          data-testid="game-flow-marker"
        />
      </svg>
      {openingExitPly !== null && openingExitPly <= maxPly && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px border-l border-dashed border-info"
          style={{ left: `${(openingExitPly / maxPly) * 100}%` }}
          data-testid="game-flow-book-exit"
        >
          <BookExitIcon className="absolute -top-0.5 -left-[5px] h-2.5 w-2.5 text-info" />
        </div>
      )}
      {marks.map(({ ply, mark, xPct, yPct }) => (
        <div
          key={ply}
          className={`pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
            mark === '??' ? 'bg-bad-hi' : mark === '?' ? 'bg-gold-hi' : 'bg-muted'
          }`}
          style={{ left: `${xPct}%`, top: `${yPct}%` }}
          data-testid="game-flow-mark"
          data-mark={mark}
        />
      ))}
      {hoverPly !== null && (
        <div
          className={`pointer-events-none absolute z-10 rounded-chip border border-line-strong bg-panel/95 px-1.5 py-0.5 font-semibold text-[10px] whitespace-nowrap tabular-nums text-ink backdrop-blur-sm ${tooltipShift} ${tooltipVertical}`}
          style={{ left: `${hoverFraction * 100}%` }}
          data-testid="game-flow-tooltip"
        >
          {[
            plyLabel(hoverPly, t('analysis.startPosition')),
            marks.find((m) => m.ply === hoverPly)?.mark ?? null,
            evalText(evalByPly.get(hoverPly) ?? null),
            hoverPly === openingExitPly ? t('analysis.bookExit') : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </div>
      )}
    </div>
  );
}
