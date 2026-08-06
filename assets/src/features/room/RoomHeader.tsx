import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

export default function RoomHeader({
  slug,
  joined,
  onLeave,
}: {
  slug: string;
  joined: boolean;
  onLeave: () => void;
}) {
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
    <section className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 text-2xl tracking-[-0.02em]">{t('room.codeLabel')}</h1>
        <code className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-lg tracking-widest">
          {slug.toUpperCase()}
        </code>
        <button
          type="button"
          id="copy-code-button"
          className="rounded-lg border border-white/10 px-3 py-1 text-sm text-muted transition-colors hover:border-white/30 hover:text-ink"
          onClick={() => void handleCopy()}
        >
          {copied ? t('room.copied') : t('room.copy')}
        </button>
        {!joined && <p className="m-0 text-sm text-warn">{t('room.connecting')}</p>}
      </div>
      <button
        type="button"
        id="leave-room-button"
        className={button({ variant: 'ghost' })}
        onClick={onLeave}
      >
        {t('room.leave')}
      </button>
    </section>
  );
}
