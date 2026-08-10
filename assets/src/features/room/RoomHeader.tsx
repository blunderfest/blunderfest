import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import { formatRegion } from '@/lib/region';
import { useAppSelector } from '@/store';

/**
 * The compact room chip rendered in the app header for everyone in the room:
 * the code to copy and share (joiners land as viewers anyway) plus leave.
 * Also shows the server regions when known: the machine this client is
 * connected to, and — only when it differs — the machine hosting the room
 * process (ADR-0013).
 */
export default function RoomHeader({ slug, onLeave }: { slug: string; onLeave: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const serverInfo = useAppSelector((state) => state.room.serverInfo);

  async function handleCopy() {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions etc.) — nothing to show
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-sm tracking-widest">
        <span className="sr-only">{t('room.codeLabel')} </span>
        {slug.toUpperCase()}
      </code>
      <button
        type="button"
        id="copy-code-button"
        className="rounded-lg border border-white/10 px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-white/30 hover:text-ink"
        onClick={() => void handleCopy()}
      >
        <span aria-live="polite">{copied ? t('room.copied') : t('room.copy')}</span>
      </button>
      <button
        type="button"
        id="leave-room-button"
        className={button({ intent: 'ghost', size: 'sm' })}
        onClick={onLeave}
      >
        {t('room.leave')}
      </button>
      <RegionChip serverInfo={serverInfo} />
    </div>
  );
}

function RegionChip({
  serverInfo,
}: {
  serverInfo: { region: string | null; roomRegion: string | null };
}) {
  const { t } = useTranslation();
  const region = formatRegion(serverInfo.region);
  if (region === null) {
    return null;
  }
  const roomRegion = formatRegion(serverInfo.roomRegion);
  const split = roomRegion !== null && roomRegion !== region;
  const text = split ? `${region} · ${t('room.roomPrefix')} ${roomRegion}` : region;

  return (
    <span
      data-testid="region-chip"
      title={t('room.regionLabel')}
      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted"
    >
      <span className="sr-only">{t('room.regionLabel')} </span>
      {text}
    </span>
  );
}
