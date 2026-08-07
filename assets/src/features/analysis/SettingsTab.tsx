import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';

function ToggleRow({
  label,
  hint,
  on,
  onToggle,
  testid,
  disabled = false,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  testid: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2.5 ${disabled ? 'opacity-40' : ''}`}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-ui text-ink">{label}</span>
        <span className="text-note text-faint">{hint}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        data-testid={testid}
        disabled={disabled}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          on ? 'bg-gold' : 'bg-raised border border-line-strong'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
        onClick={onToggle}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Per-viewer analysis preferences (persisted locally; never shared with the
 * room). Lives in the sidebar's Settings tab.
 */
export default function SettingsTab({
  engineOn,
  arrowsOn,
  onToggleEngine,
  onToggleArrows,
}: {
  engineOn: boolean;
  arrowsOn: boolean;
  onToggleEngine: () => void;
  onToggleArrows: () => void;
}) {
  const { t } = useTranslation();

  return (
    <section className={panel({ layout: 'none', pad: 'none' })}>
      <div className="flex flex-col divide-y divide-line py-1">
        <ToggleRow
          label={t('analysis.engineAnalysis')}
          hint={t('analysis.engineAnalysisHint')}
          on={engineOn}
          onToggle={onToggleEngine}
          testid="setting-engine"
        />
        <ToggleRow
          label={t('analysis.hintArrows')}
          hint={t('analysis.hintArrowsHint')}
          on={arrowsOn}
          onToggle={onToggleArrows}
          testid="setting-arrows"
          disabled={!engineOn}
        />
      </div>
    </section>
  );
}
