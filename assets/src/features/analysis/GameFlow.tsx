import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

/** The area under a segment, down to the bottom edge — white's territory. */
function areaPath(segment: Point[]): string {
  const first = segment[0];
  const last = segment[segment.length - 1];
  const line = segment.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return `M${first.x.toFixed(2)} ${HEIGHT} ${line} L${last.x.toFixed(2)} ${HEIGHT} Z`;
}

/**
 * The game-flow chart (ADR-0009): engine eval over the mainline, the same
 * mapping as the eval bar — light area where white stands better, dark
 * where black does. Click or drag to jump to a ply. Rendered once a
 * whole-game analysis exists.
 */
export default function GameFlow({
  evals,
  currentPly,
  onSelectPly,
}: {
  evals: AnalysisEval[];
  currentPly: number;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  /** The last ply pushed during a drag, so identical moves aren't repeated. */
  const scrubbedTo = useRef<number | null>(null);

  const maxPly = evals.length > 0 ? evals[evals.length - 1].ply : 0;

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
        y: ((100 - share) / 100) * HEIGHT,
      });
    }
    if (segment.length > 0) {
      segments.push(segment);
    }
  }

  if (maxPly === 0) {
    return null;
  }

  const markerX = (Math.min(Math.max(currentPly, 0), maxPly) / maxPly) * WIDTH;

  function plyAt(event: React.PointerEvent<SVGSVGElement>): number | null {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) {
      return null;
    }
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    return Math.round(fraction * maxPly);
  }

  function scrub(event: React.PointerEvent<SVGSVGElement>) {
    const ply = plyAt(event);
    if (ply !== null && ply !== scrubbedTo.current) {
      scrubbedTo.current = ply;
      onSelectPly(ply);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="h-16 w-full cursor-crosshair touch-none select-none rounded-control border border-line bg-[#1a1d24]"
      role="img"
      aria-label={t('analysis.gameFlow')}
      data-testid="game-flow"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        scrubbedTo.current = null;
        scrub(event);
      }}
      onPointerMove={(event) => {
        if ((event.buttons & 1) === 1) {
          scrub(event);
        }
      }}
      onPointerUp={() => {
        scrubbedTo.current = null;
      }}
      onPointerCancel={() => {
        scrubbedTo.current = null;
      }}
    >
      {segments.map((segment) =>
        segment.length > 1 ? (
          <path
            key={segment[0].x}
            d={areaPath(segment)}
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
  );
}
