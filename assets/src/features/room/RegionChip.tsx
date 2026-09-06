import { useTranslation } from 'react-i18next';
import { statusDot } from '@/components/ui';
import { formatRegion, regionFlag } from '@/lib/region';
import { useRoomSelector } from '@/store/roomContext';

/**
 * The header's connection chip (ADR-0032): server region + room region +
 * measured round-trip as ambient app-bar chrome — the Room tab's old
 * connection readout promoted next to Share. Green dot when healthy; the
 * tooltip spells both full region names and the RTT. The regions themselves
 * read as country flags (🇳🇱↔🇸 when the room lives elsewhere; unknown Fly
 * codes fall back to the raw code). Renders nothing until the join reply
 * supplies a region (the only source of truth).
 */
export default function RegionChip() {
  const { t } = useTranslation();
  const region = useRoomSelector((ctx) => ctx.region);
  const roomRegion = useRoomSelector((ctx) => ctx.roomRegion);
  const lagMs = useRoomSelector((ctx) => ctx.lagMs);

  if (region === null) {
    return null;
  }

  const you = formatRegion(region) ?? region;
  const split = roomRegion !== null && roomRegion !== region;
  const room = roomRegion === null ? you : (formatRegion(roomRegion) ?? roomRegion);
  const youFlag = regionFlag(region) ?? region;
  const roomFlag = roomRegion === null ? youFlag : (regionFlag(roomRegion) ?? roomRegion);
  const tooltip =
    lagMs !== null
      ? t('room.regionChipTooltip', { you, room, ms: lagMs })
      : split
        ? t('room.connectionSplit', { you, room })
        : t('room.regionChipTooltipLocal');

  return (
    <span
      className="flex items-center gap-1 font-mono text-micro whitespace-nowrap text-faint"
      title={tooltip}
      data-testid="region-chip"
    >
      <span className={statusDot({ tone: lagMs === null ? 'warn' : 'ok' })} />
      <span role="img" aria-label={split ? `${you} ↔ ${room}` : you} data-testid="region-flags">
        {split ? `${youFlag}↔${roomFlag}` : youFlag}
      </span>
      {lagMs !== null && (
        <span className="tabular-nums text-faint" data-testid="lag-ms">
          {t('room.lag', { ms: lagMs })}
        </span>
      )}
    </span>
  );
}
