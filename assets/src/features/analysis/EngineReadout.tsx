import { useTranslation } from 'react-i18next';
import { statusDot } from '@/components/ui';
import { evalLabel, pvToSan } from '@/features/analysis/uci';
import type { EngineState } from '@/features/analysis/useEngine';

/**
 * The 36px engine readout bar below the board: status dot, depth, eval badge
 * (light when white is better, dark otherwise), and the principal variation
 * in SAN. Always rendered at a fixed height so engine updates never shift
 * the layout; the previous eval stays visible while thinking.
 */
export default function EngineReadout({ fen, state }: { fen: string; state: EngineState }) {
  const { t } = useTranslation();
  const { status, eval: white, depth, pv, retry } = state;

  const pvSan = pv.length > 0 ? pvToSan(fen, pv) : [];

  return (
    <div
      className="flex h-9 w-full items-center gap-2 rounded-control border border-line bg-panel px-3"
      data-testid="engine-readout"
    >
      <span
        className={statusDot({
          tone: status === 'error' ? 'bad' : status === 'thinking' ? 'warn' : 'ok',
          pulse: status === 'thinking',
        })}
      />
      {status === 'error' ? (
        <>
          <span className="text-ui text-muted">{t('analysis.engineUnavailable')}</span>
          <button
            type="button"
            className="text-ui font-semibold text-gold-hi hover:underline"
            onClick={retry}
          >
            {t('analysis.engineRetry')}
          </button>
        </>
      ) : (
        <>
          <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
            {status === 'thinking' && t('analysis.engineThinking')}
            {status === 'ready' && depth !== null && (
              <>
                {t('analysis.depthLabel')} <span className="text-muted">{depth}</span>
              </>
            )}
          </span>
          {white !== null && (
            <span
              className={`rounded-chip border border-line px-1.5 py-0.5 text-note font-semibold tabular-nums ${
                white.type === 'result'
                  ? white.result === '1-0'
                    ? 'bg-[#f4f6fb] text-[#20180a]'
                    : white.result === '0-1'
                      ? 'bg-[#1a1d24] text-[#e8eaf0]'
                      : 'bg-raised text-muted'
                  : (white.type === 'cp' && white.cp < 0) ||
                      (white.type === 'mate' && white.moves < 0)
                    ? 'bg-[#1a1d24] text-[#e8eaf0]'
                    : 'bg-[#f4f6fb] text-[#20180a]'
              } ${status === 'thinking' ? 'opacity-85' : ''}`}
              data-testid="engine-eval-badge"
            >
              {evalLabel(white)}
            </span>
          )}
          {pvSan.length > 0 && (
            <span className="truncate text-ui text-muted tabular-nums" data-testid="engine-pv">
              {pvSan.join(' ')}
            </span>
          )}
        </>
      )}
    </div>
  );
}
