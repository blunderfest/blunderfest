import { useTranslation } from 'react-i18next';
import Switch from '@/components/Switch';
import { button, statusDot } from '@/components/ui';
import EngineReadout from '@/features/analysis/EngineReadout';
import type { EngineState } from '@/features/analysis/useEngine';

/**
 * The engine section at the top of the Moves panel (lichess-style): the
 * on/off switch, hint-arrows toggle and line-count selector in the header;
 * the live readout for the current position below — or the paused note
 * while the position editor is open.
 */
export default function EngineBox({
  fen,
  state,
  engineOn,
  arrowsOn,
  linesCount,
  paused = false,
  onToggleEngine,
  onToggleArrows,
  onLinesCount,
  onInsertLine,
  analyze = null,
}: {
  fen: string;
  state: EngineState;
  engineOn: boolean;
  arrowsOn: boolean;
  linesCount: number;
  /** Position editor is open: the engine is paused, show that instead. */
  paused?: boolean;
  onToggleEngine: () => void;
  onToggleArrows: () => void;
  onLinesCount: (count: number) => void;
  /** When set (editors only), a line can be clicked to insert it as a variation. */
  onInsertLine?: (pv: string[]) => void;
  /**
   * The server-side whole-game/line analysis action (ADR-0009): "Analyze
   * line" on a variation, "Re-analyze" when the mainline outgrew the job.
   * Independent of the in-browser engine toggle — the pool is server-side.
   */
  analyze?: {
    label: string;
    onClick: () => void;
    progress?: { done: number; total: number } | null;
  } | null;
}) {
  const { t } = useTranslation();

  // The depth of the search behind the shown lines (the ticking current
  // depth while thinking, the best line's depth once results land).
  const depth = state.lines[0]?.depth ?? state.depth ?? 0;

  return (
    <div className="shrink-0" data-testid="engine-box">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.11em] text-muted">
          {t('analysis.engineToggle')}
          {/* The engine's status dot lives here, with the engine's identity —
              one engine, one status; it was never a property of the first
              PV line. */}
          <span
            className={statusDot({
              tone: !engineOn
                ? 'idle'
                : state.status === 'error'
                  ? 'bad'
                  : state.status === 'thinking'
                    ? 'warn'
                    : 'ok',
              pulse: engineOn && state.status === 'thinking',
            })}
            title={
              !engineOn
                ? t('analysis.engineOff')
                : state.status === 'error'
                  ? t('analysis.engineUnavailable')
                  : state.status === 'thinking'
                    ? t('analysis.engineThinking')
                    : t('analysis.engineReady')
            }
          />
          {depth > 0 && (
            <>
              {' · '}
              {t('analysis.depthLabel')} <span className="tabular-nums text-faint">{depth}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-2">
          <select
            aria-label={t('analysis.engineLines')}
            data-testid="engine-lines-select"
            className="h-6 rounded-control border border-line bg-transparent px-1 text-micro text-muted"
            value={linesCount}
            onChange={(event) => onLinesCount(Number(event.target.value))}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={t('analysis.hintArrows')}
            aria-pressed={arrowsOn}
            title={t('analysis.hintArrows')}
            data-testid="engine-box-arrows"
            disabled={!engineOn}
            className={`grid h-6 w-6 place-items-center rounded-control border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              arrowsOn
                ? 'border-gold/60 bg-gold/25 text-gold-text'
                : 'border-line text-muted hover:border-line-strong hover:text-ink'
            }`}
            onClick={onToggleArrows}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-3.5 w-3.5"
            >
              <path d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          </button>
          <Switch
            on={engineOn}
            onToggle={onToggleEngine}
            label={t('analysis.engineToggle')}
            testid="engine-box-switch"
          />
        </span>
      </div>
      {engineOn &&
        (paused ? (
          <div className="flex h-9 items-center gap-2 px-3" data-testid="engine-paused">
            <span className={statusDot({ tone: 'warn', pulse: true })} />
            <span className="text-ui text-gold-hi">{t('analysis.enginePaused')}</span>
          </div>
        ) : (
          <EngineReadout fen={fen} state={state} onInsertLine={onInsertLine} />
        ))}
      {analyze !== null && (
        <div className="border-t border-line p-2">
          <button
            type="button"
            data-testid="analyze-action-button"
            className={button({ intent: 'quiet', size: 'sm', block: true })}
            disabled={analyze.progress != null}
            onClick={analyze.onClick}
          >
            {analyze.progress != null
              ? t('room.analyzing', {
                  done: analyze.progress.done,
                  total: analyze.progress.total,
                })
              : analyze.label}
          </button>
        </div>
      )}
    </div>
  );
}
