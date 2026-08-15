import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip } from '@/components/ui';
import { useAppSelector } from '@/store';

/**
 * The compact room actions in the app header's left cluster for everyone in
 * the room: the code to copy and share (joiners land as viewers anyway) plus
 * leave. Read-only rooms (the demo, ADR-0014) get a badge explaining why
 * nothing can be edited.
 */
export default function RoomHeader({ slug, onLeave }: { slug: string; onLeave: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const readOnly = useAppSelector((state) => state.room.readOnly);

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
        aria-label={t('room.copy')}
        title={t('room.copy')}
        className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-muted transition-colors hover:border-white/30 hover:text-ink"
        onClick={() => void handleCopy()}
      >
        <span className="relative block h-4 w-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${
              copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`absolute inset-0 h-4 w-4 text-ok-hi transition-all duration-200 ${
              copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
          >
            <path d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
        <span className="sr-only" aria-live="polite">
          {copied ? t('room.copied') : t('room.copy')}
        </span>
      </button>
      <button
        type="button"
        id="leave-room-button"
        className={button({ intent: 'ghost', size: 'sm' })}
        onClick={onLeave}
      >
        {t('room.leave')}
      </button>
      {readOnly && (
        <span className={chip({ tone: 'gold' })} title={t('room.demoHint')}>
          {t('room.demoBadge')}
        </span>
      )}
    </div>
  );
}
