import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { plyLabel } from '@/features/analysis/GameFlow';
import { type MoveTime, moveTimes } from '@/features/analysis/moveTimes';
import type { GameTree } from '@/lib/api';

/** Chart geometry: a 100×40 viewBox stretched to full width. */
const WIDTH = 100;
const HEIGHT = 40;

/** The tooltip's think-time label: "12s" / "1:47" (visualization ideas #10). */
export function thinkTimeLabel(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The time-management layer of the timeline band: how long each mainline
 * move took, as bars from the bottom (taller = longer think) on the shared
 * move axis. White's bars are near-white, black's silver (the layer
 * legend), and the hover readout names the side. Click or drag jumps to a
 * ply. Needs clock data (`[%clk]` extracted at import) plus a
 * `TimeControl` header — see `moveTimes.ts`.
 */
export default function ClocksFlow({
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

  const times = useMemo(() => moveTimes(tree), [tree]);
  const timeByPly = useMemo(() => new Map(times.map((time) => [time.ply, time])), [times]);
  const maxPly = spanPly ?? (times.length > 0 ? times[times.length - 1].ply : 0);

  const available = times.length > 0;
  if (!available || maxPly === 0) {
    return (
      <div className={`grid ${heightClass} place-items-center`}>
        <p className="m-0 text-note text-faint">{t('analysis.clocksEmpty')}</p>
      </div>
    );
  }

  // Log scale: a 3s blitz think and a 4-minute tank both read, but the
  // short ones don't vanish next to the outliers.
  const worst = times.reduce((max, time) => Math.max(max, time.seconds), 0);
  const barHeight = (seconds: number) =>
    Math.max(1.5, (Math.log1p(seconds) / Math.log1p(worst)) * HEIGHT);

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

  const hoverFraction = hoverPly === null ? 0 : hoverPly / maxPly;
  const hoverTime: MoveTime | null = hoverPly === null ? null : (timeByPly.get(hoverPly) ?? null);
  const tooltipShift =
    hoverFraction < 0.12
      ? 'translate-x-0'
      : hoverFraction > 0.88
        ? '-translate-x-full'
        : '-translate-x-1/2';

  return (
    <div
      className={`flex ${heightClass} cursor-crosshair touch-none select-none`}
      role="img"
      aria-label={t('analysis.clocksFlow')}
      data-testid="clocks-flow"
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
          {times.map((time) => {
            const h = barHeight(time.seconds);
            // One bar per move, ~1 ply wide with a hair of daylight. The
            // mover's color: near-white for white, silver for black (the
            // layer legend explains the pair).
            const w = Math.max(0.3, WIDTH / maxPly / 2);
            const x = (time.ply / maxPly) * WIDTH - w / 2;
            return (
              <rect
                key={time.ply}
                x={Math.max(0, Math.min(WIDTH - w, x))}
                y={HEIGHT - h}
                width={w}
                height={h}
                className={
                  time.ply === currentPly
                    ? 'fill-gold-hi'
                    : time.mover === 'w'
                      ? 'fill-[#f4f6fb]'
                      : 'fill-[#b6bdcc]'
                }
                data-testid="clocks-flow-bar"
                data-ply={time.ply}
                data-side={time.mover}
              />
            );
          })}
          <line
            x1={markerX}
            x2={markerX}
            y1={0}
            y2={HEIGHT}
            className="stroke-gold"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            data-testid="clocks-flow-marker"
          />
        </svg>
        {hoverPly !== null && hoverTime !== null && (
          <div
            className={`pointer-events-none absolute top-1 z-10 rounded-chip border border-line-strong bg-panel/95 px-1.5 py-0.5 font-semibold text-[10px] whitespace-nowrap tabular-nums text-ink backdrop-blur-sm ${tooltipShift}`}
            style={{ left: `${hoverFraction * 100}%` }}
            data-testid="clocks-flow-tooltip"
          >
            {plyLabel(hoverPly, t('analysis.startPosition'))}{' '}
            {t(hoverTime.mover === 'w' ? 'analysis.thinkTimeWhite' : 'analysis.thinkTimeBlack', {
              time: thinkTimeLabel(hoverTime.seconds),
            })}
          </div>
        )}
      </div>
    </div>
  );
}
