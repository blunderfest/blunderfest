import { useTranslation } from 'react-i18next';
import { statusDot } from '@/components/ui';
import { evalLabel, pvToSan, type WhiteEval } from '@/features/analysis/uci';
import type { EngineLineState, EngineState } from '@/features/analysis/useEngine';

function evalBadgeClass(white: WhiteEval, dimmed: boolean): string {
  const light =
    white.type === 'result'
      ? white.result === '1-0'
      : (white.type === 'cp' && white.cp >= 0) || (white.type === 'mate' && white.moves > 0);
  const tone =
    white.type === 'result' && white.result === '1/2-1/2'
      ? 'bg-raised text-muted'
      : light
        ? 'bg-[#f4f6fb] text-[#20180a]'
        : 'bg-[#1a1d24] text-[#e8eaf0]';
  return `rounded-chip border border-line px-1.5 py-0.5 text-note font-semibold tabular-nums ${tone} ${
    dimmed ? 'opacity-85' : ''
  }`;
}

function Line({
  fen,
  line,
  dimmed,
  badgeTestId,
}: {
  fen: string;
  line: EngineLineState;
  dimmed: boolean;
  badgeTestId?: string;
}) {
  const pvSan = line.pv.length > 0 ? pvToSan(fen, line.pv) : [];
  return (
    <>
      <span className={evalBadgeClass(line.eval, dimmed)} data-testid={badgeTestId}>
        {evalLabel(line.eval)}
      </span>
      {pvSan.length > 0 && (
        <span className="truncate text-ui text-muted tabular-nums" data-testid="engine-pv">
          {pvSan.join(' ')}
        </span>
      )}
    </>
  );
}

/**
 * The engine's readout inside the engine box: one row per MultiPV line
 * (best first) — eval badge (light when white is better) plus the principal
 * variation in SAN. The first row carries the status dot and depth. The
 * previous lines stay visible while the next position is analyzed.
 */
export default function EngineReadout({ fen, state }: { fen: string; state: EngineState }) {
  const { t } = useTranslation();
  const { status, lines, retry } = state;
  const thinking = status === 'thinking';

  // Terminal positions carry a result instead of engine lines — show it
  // through the same single-line fallback.
  const displayLines =
    lines.length > 0
      ? lines
      : state.eval !== null
        ? [{ eval: state.eval, depth: state.depth ?? 0, wdl: null, pv: state.pv }]
        : [];

  if (status === 'error') {
    return (
      <div className="flex h-9 w-full items-center gap-2 px-3" data-testid="engine-readout">
        <span className={statusDot({ tone: 'bad' })} />
        <span className="text-ui text-muted">{t('analysis.engineUnavailable')}</span>
        <button
          type="button"
          className="text-ui font-semibold text-gold-hi hover:underline"
          onClick={retry}
        >
          {t('analysis.engineRetry')}
        </button>
      </div>
    );
  }

  if (displayLines.length === 0) {
    return (
      <div className="flex h-9 w-full items-center gap-2 px-3" data-testid="engine-readout">
        <span className={statusDot({ tone: thinking ? 'warn' : 'ok', pulse: thinking })} />
        <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
          {thinking ? t('analysis.engineThinking') : ''}
        </span>
      </div>
    );
  }

  const wdl = displayLines[0]?.wdl ?? null;

  return (
    <div className="flex w-full flex-col px-3 py-1" data-testid="engine-readout">
      {displayLines.map((line, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the index IS the identity — row N is always the Nth-best line
        <div key={index} className="flex h-7 items-center gap-2" data-testid="engine-line">
          {index === 0 ? (
            <span className={statusDot({ tone: thinking ? 'warn' : 'ok', pulse: thinking })} />
          ) : (
            <span className="w-1.5 shrink-0" />
          )}
          {index === 0 && line.depth > 0 && (
            <span className="shrink-0 text-micro font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-faint">
              {t('analysis.depthLabel')} <span className="text-muted">{line.depth}</span>
            </span>
          )}
          <Line
            fen={fen}
            line={line}
            dimmed={thinking}
            badgeTestId={index === 0 ? 'engine-eval-badge' : undefined}
          />
        </div>
      ))}
      {wdl !== null && (
        // Segment tones are chosen to read on both panel themes — the eval
        // bar's pure white/black disappear against the matching panel.
        <div
          className="mt-0.5 mb-1 flex h-1.5 overflow-hidden rounded-full border border-line"
          title={`${t('analysis.wdl')}: ${Math.round(wdl.win / 10)}% · ${Math.round(wdl.draw / 10)}% · ${Math.round(wdl.loss / 10)}%`}
          data-testid="engine-wdl"
        >
          <span className="bg-[#dfe4ee]" style={{ width: `${wdl.win / 10}%` }} />
          <span className="bg-[#7a8499]" style={{ width: `${wdl.draw / 10}%` }} />
          <span className="bg-[#2e3442]" style={{ width: `${wdl.loss / 10}%` }} />
        </div>
      )}
    </div>
  );
}
