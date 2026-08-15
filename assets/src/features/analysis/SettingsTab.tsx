import { useTranslation } from 'react-i18next';
import Switch from '@/components/Switch';
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
      <Switch on={on} onToggle={onToggle} label={label} testid={testid} disabled={disabled} />
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
