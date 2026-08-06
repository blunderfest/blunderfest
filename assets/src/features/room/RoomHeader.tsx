import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

/**
 * The compact room chip rendered in the app header, visible to the room's
 * owner only (they are the one sharing the code). Non-owners leave via the
 * brand link home.
 */
export default function RoomHeader({ slug, onLeave }: { slug: string; onLeave: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

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
        className={button({ variant: 'ghost', size: 'sm' })}
        onClick={onLeave}
      >
        {t('room.leave')}
      </button>
    </div>
  );
}
