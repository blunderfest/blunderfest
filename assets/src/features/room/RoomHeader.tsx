import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import { formatRegion, regionFlag } from '@/lib/region';
import { useAppSelector } from '@/store';

/**
 * The compact room chip rendered in the app header for everyone in the room:
 * the code to copy and share (joiners land as viewers anyway) plus leave.
 * Also shows the region of the machine you're connected to (ADR-0013) — the
 * flag on small screens, flag + name from sm up.
 */
export default function RoomHeader({ slug, onLeave }: { slug: string; onLeave: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const region = useAppSelector((state) => state.room.region);

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
      <RegionChip region={region} />
    </div>
  );
}

function RegionChip({ region: code }: { region: string | null }) {
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
