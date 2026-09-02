import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chip } from '@/components/ui';

/**
 * The room's code as header chrome (ADR-0032, as implemented): the 5-char
 * code in mono, click to copy the code itself — visible at a glance, the
 * invite affordance the Room tab used to bury. Read-only rooms (the demo,
 * ADR-0014) carry the demo badge here too. Leaving the room is the logo
 * (it navigates home); the deep link is in the address bar.
 */
export default function RoomCodeChip({ slug, readOnly }: { slug: string; readOnly: boolean }) {
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
    <>
      <button
        type="button"
        id="copy-code-button"
        data-tour="share"
        aria-label={t('room.codeLabel')}
        title={t('room.codeChipHint')}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 font-mono text-ui tracking-widest text-ink transition-colors hover:border-line-strong"
        onClick={() => void handleCopy()}
      >
        <span aria-hidden="true">{copied ? t('room.copied') : slug.toUpperCase()}</span>
        <span className="sr-only" aria-live="polite">
          {copied ? t('room.copied') : `${t('room.codeLabel')} ${slug.toUpperCase()}`}
        </span>
        <span className="relative block h-3.5 w-3.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`absolute inset-0 h-3.5 w-3.5 transition-all duration-200 ${
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
            className={`absolute inset-0 h-3.5 w-3.5 text-ok-hi transition-all duration-200 ${
              copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
          >
            <path d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </span>
      </button>
      {readOnly && (
        <span className={chip({ tone: 'info' })} title={t('room.demoHint')}>
          {t('room.demoBadge')}
        </span>
      )}
    </>
  );
}
