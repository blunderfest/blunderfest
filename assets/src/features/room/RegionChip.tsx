import { useTranslation } from 'react-i18next';
import { formatRegion, regionFlag } from '@/lib/region';

/**
 * The ambient connection chip in the app header's right cluster: the region
 * of the machine the client is connected to — the flag on small screens,
 * flag + name from sm up. The future home of connection telemetry (lag,
 * the you-region vs room-region split).
 */
export default function RegionChip({ region: code }: { region: string | null }) {
  const { t } = useTranslation();
  const text = formatRegion(code);
  if (text === null) {
    return null;
  }
  const flag = regionFlag(code);

  return (
    <span
      data-testid="region-chip"
      title={t('room.regionLabel')}
      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted"
    >
      <span className="sr-only">{t('room.regionLabel')} </span>
      {flag !== null ? <span className="sm:hidden">{flag}</span> : null}
      <span className={flag !== null ? 'max-sm:hidden' : undefined}>{text}</span>
    </span>
  );
}
