import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { plyLabel } from '@/features/analysis/GameFlow';
import { type ClockPoint, remainingClocks } from '@/features/analysis/moveTimes';
import type { GameTree } from '@/lib/api';

/** Chart geometry: a 100×40 viewBox stretched to full width. */
const WIDTH = 100;
const HEIGHT = 40;

/** The tooltip's clock readout: "3:07" / "42s". */
function clockLabel(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The time-remaining layer of the timeline band: each side's clock after
 * its moves as two draining lines (white's solid, black's dashed) on the
 * shared move axis — a time-trouble readout against the position's quality.
 * Click or drag jumps to a ply. Needs clock data (`[%clk]` extracted at
 * import) — see `moveTimes.ts`.
 */
export default function RemainingClocksFlow({
  tree,
  currentPly,
  spanPly,
  heightClass = 'h-44',
  onSelectPly,
}: {
  tree: GameTree;
  currentPly: number;
  /** The x-axis domain: the last ply shown (the band's shared span). */
  spanPly?: number;
  /** The chart's height (the timeline band stacks layers compactly). */
  heightClass?: string;
  onSelectPly: (ply: number) => void;
}) {
  const { t } = useTranslation();
  const scrubbedTo = useRef<number | null>(null);
  const [hoverPly, setHoverPly] = useState<number | null>(null);
  const [coarse] = useState(() => window.matchMedia('(pointer: coarse)').matches);

  const points = useMemo(() => remainingClocks(tree), [tree]);
  const maxPly = spanPly ?? (points.length > 0 ? points[points.length - 1].ply : 0);

  const available = points.length > 0;
  if (!available || maxPly === 0) {
    return (
      <div className={`grid ${heightClass} place-items-center`}>
        <p className="m-0 text-note text-faint">{t('analysis.clocksEmpty')}</p>
      </div>
    );
  }

  // The y domain: the initial clock at the top, the lowest remaining seen
  // near the bottom — the drain fills the chart instead of hugging the top.
  const peak = points.reduce((max, point) => Math.max(max, point.remaining), 0);
  const trough = points.reduce((min, point) => Math.min(min, point.remaining), peak);
  const span = Math.max(peak - trough, 1);
  const yFor = (remaining: number) => 1 + (1 - (remaining - trough) / span) * (HEIGHT - 2);

  const seriesFor = (mover: 'w' | 'b'): string =>
    points
      .filter((point) => point.mover === mover)
      .map(
        (point) =>
          `${((point.ply / maxPly) * WIDTH).toFixed(2)},${yFor(point.remaining).toFixed(2)}`,
      )
      .join(' ');

  const markerX = Math.min(
    (Math.min(Math.max(currentPly, 0), maxPly) / maxPly) * WIDTH,
    WIDTH - 0.4,
  );

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

  const hoverFraction = hoverPly === null ? 0 : hoverPly / maxPly;
  const tooltipShift =
    hoverFraction < 0.12
      ? 'translate-x-0'
      : hoverFraction > 0.88
        ? '-translate-x-full'
        : '-translate-x-1/2';

  // The readout at the hovered ply: the most recent clock per side at or
  // before that ply (a side's clock only changes on its own moves).
  function hoverReadout(mover: 'w' | 'b'): ClockPoint | null {
    if (hoverPly === null) {
      return null;
    }
    let latest: ClockPoint | null = null;
    for (const point of points) {
      if (point.mover === mover && point.ply <= hoverPly) {
        if (latest === null || point.ply > latest.ply) {
          latest = point;
        }
      }
    }
    return latest;
  }
  const hoverW = hoverReadout('w');
  const hoverB = hoverReadout('b');

  return (
    <div
      className={`flex ${heightClass} cursor-crosshair touch-none select-none`}
      role="img"
      aria-label={t('analysis.remainingFlow')}
      data-testid="remaining-clocks-flow"
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
          <polyline
            points={seriesFor('w')}
            fill="none"
            className="stroke-clock-w"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="remaining-clocks-white"
          />
          <polyline
            points={seriesFor('b')}
            fill="none"
            className="stroke-[#b6bdcc]"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="remaining-clocks-black"
          />
          <line
            x1={markerX}
            x2={markerX}
            y1={0}
            y2={HEIGHT}
            className="stroke-accent"
            vectorEffect="non-scaling-stroke"
            strokeWidth="2"
            data-testid="remaining-clocks-marker"
          />
        </svg>
        {hoverPly !== null && (hoverW !== null || hoverB !== null) && (
          <div
            className={`pointer-events-none absolute top-1 z-10 rounded-chip border border-line-strong bg-panel/95 px-1.5 py-0.5 font-semibold text-[10px] whitespace-nowrap tabular-nums text-ink backdrop-blur-sm ${tooltipShift}`}
            style={{ left: `${hoverFraction * 100}%` }}
            data-testid="remaining-clocks-tooltip"
          >
            {plyLabel(hoverPly, t('analysis.startPosition'))}
            {hoverW !== null && (
              <> {t('analysis.clockRemainingWhite', { time: clockLabel(hoverW.remaining) })}</>
            )}
            {hoverB !== null && (
              <> {t('analysis.clockRemainingBlack', { time: clockLabel(hoverB.remaining) })}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
