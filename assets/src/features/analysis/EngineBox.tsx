import { useTranslation } from 'react-i18next';
import Switch from '@/components/Switch';
import { panel, statusDot } from '@/components/ui';
import EngineReadout from '@/features/analysis/EngineReadout';
import type { EngineState } from '@/features/analysis/useEngine';

/**
 * The engine box at the top of the Moves tab (lichess-style): the on/off
 * switch in the header, the live readout for the current position below
 * it — or the paused note while the position editor is open. The Settings
 * tab keeps the full preferences (hint arrows & co.).
 */
export default function EngineBox({
  fen,
  state,
  engineOn,
  paused = false,
  onToggleEngine,
}: {
  fen: string;
  state: EngineState;
  engineOn: boolean;
  /** Position editor is open: the engine is paused, show that instead. */
  paused?: boolean;
  onToggleEngine: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className={panel({ layout: 'none', pad: 'none' })} data-testid="engine-box">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <span className="text-micro font-semibold uppercase tracking-[0.11em] text-muted">
          {t('analysis.engineToggle')}
        </span>
        <Switch
          on={engineOn}
          onToggle={onToggleEngine}
          label={t('analysis.engineToggle')}
          testid="engine-box-switch"
        />
      </div>
      {engineOn &&
        (paused ? (
          <div className="flex h-9 items-center gap-2 px-3" data-testid="engine-paused">
            <span className={statusDot({ tone: 'warn', pulse: true })} />
            <span className="text-ui text-gold-hi">{t('analysis.enginePaused')}</span>
          </div>
        ) : (
          <EngineReadout fen={fen} state={state} framed={false} />
        ))}
    </section>
  );
}
