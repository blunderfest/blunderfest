import { useTranslation } from 'react-i18next';
import { statusDot } from '@/components/ui';
import { formatRegion } from '@/lib/region';
import { useAppSelector } from '@/store';

/**
 * The header's connection chip (ADR-0032): server region + room region +
 * measured round-trip as ambient app-bar chrome — the Room tab's old
 * connection readout promoted next to Share. Green dot when healthy; the
 * tooltip spells both full region names and the RTT. Renders nothing until
 * the join reply supplies a region (the only source of truth).
 */
export default function RegionChip() {
  const { t } = useTranslation();
  const region = useAppSelector((state) => state.room.region);
  const roomRegion = useAppSelector((state) => state.room.roomRegion);
  const lagMs = useAppSelector((state) => state.room.lagMs);

  if (region === null) {
    return null;
  }

  const you = formatRegion(region) ?? region;
  const split = roomRegion !== null && roomRegion !== region;
  const room = roomRegion === null ? you : (formatRegion(roomRegion) ?? roomRegion);
  const code = split ? `${region}↔${roomRegion}` : region;
  const tooltip =
    lagMs !== null
      ? t('room.regionChipTooltip', { you, room, ms: lagMs })
      : split
        ? t('room.connectionSplit', { you, room })
        : t('room.regionChipTooltipLocal');

  return (
    <span
      className="flex items-center gap-1 rounded-chip border border-line px-1.5 py-0.5 font-mono text-micro whitespace-nowrap uppercase text-muted"
      title={tooltip}
      data-testid="region-chip"
    >
      <span className={statusDot({ tone: lagMs === null ? 'warn' : 'ok' })} />
      {code}
      {lagMs !== null && (
        <span className="tabular-nums text-faint" data-testid="lag-ms">
          {t('room.lag', { ms: lagMs })}
        </span>
      )}
    </span>
  );
}
