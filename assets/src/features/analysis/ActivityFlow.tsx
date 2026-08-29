import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ActivityPoint, activityTimeline } from '@/features/analysis/activity';
import { plyLabel } from '@/features/analysis/GameFlow';
import type { GameTree } from '@/lib/api';

/** Chart geometry: a 100×40 viewBox stretched to full width. */
const WIDTH = 100;
const HEIGHT = 40;

type Point = { x: number; y: number };

/** The area on white's side: down to the bottom edge, or up when flipped. */
function areaPath(points: Point[], flipped: boolean): string {
  const edge = flipped ? 0 : HEIGHT;
  const first = points[0];
  const last = points[points.length - 1];
  const line = points.map((p) => `L${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return `M${first.x.toFixed(2)} ${edge} ${line} L${last.x.toFixed(2)} ${edge} Z`;
}

/**
 * Piece activity over the mainline (ideas doc #4): each side's legal-move
 * count per ply — white's share of the total as territory, mirrored with
 * the board. Hovering shows both counts ("12. W 32 · B 28"); click or drag
 * jumps to a ply. Pure FEN data, no engine needed.
 */
export default function ActivityFlow({
  tree,
  currentPly,
  flipped = false,
  spanPly,
  heightClass = 'h-44',
  onSelectPly,
}: {
  tree: GameTree;
  currentPly: number;
  flipped?: boolean;
  /** The x-axis domain: the last ply shown. Defaults to the mainline tip; the timeline band passes its own so layers align. */
  spanPly?: number;
  /** The chart's height (the timeline band stacks layers compactly). */
  heightClass?: string;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const scrubbedTo = useRef<number | null>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  const points = useMemo(() => activityTimeline(tree.root), [tree]);
  // The x-axis domain: the mainline tip, or the shared span (band).
  const maxPly = spanPly ?? (points.length > 0 ? points[points.length - 1].ply : 0);
  const pointByPly = useMemo(() => new Map(points.map((p) => [p.ply, p])), [points]);

  if (maxPly === 0) {
    return null;
  }

  const chartPoints = points.map((p) => {
    const total = p.white + p.black;
    const share = total === 0 ? 50 : Math.min(98, Math.max(2, (p.white / total) * 100));
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
  const hoverPoint: ActivityPoint | null =
    hoverPly === null ? null : (pointByPly.get(hoverPly) ?? null);
  const tooltipShift =
    hoverFraction < 0.12
      ? 'translate-x-0'
      : hoverFraction > 0.88
        ? '-translate-x-full'
        : '-translate-x-1/2';

  return (
    <div
      className={`flex ${heightClass} cursor-crosshair touch-none flex-col select-none`}
      role="img"
      aria-label={t('analysis.activityFlow')}
      data-testid="activity-flow"
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
          className="block h-full w-full"
        >
          <path
            d={areaPath(chartPoints, flipped)}
            className="fill-[#6ea8fe]"
            data-testid="activity-flow-area"
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
            data-testid="activity-flow-marker"
          />
        </svg>
        {hoverPly !== null && hoverPoint !== null && (
          <div
            className={`pointer-events-none absolute top-1 z-10 rounded-chip border border-line-strong bg-panel/95 px-1.5 py-0.5 font-semibold text-[10px] whitespace-nowrap tabular-nums text-ink backdrop-blur-sm ${tooltipShift}`}
            style={{ left: `${hoverFraction * 100}%` }}
            data-testid="activity-flow-tooltip"
          >
            {plyLabel(hoverPly, t('analysis.startPosition'))}{' '}
            {t('analysis.activityValue', {
              white: hoverPoint.white,
              black: hoverPoint.black,
            })}
          </div>
        )}
      </div>
    </div>
  );
}
