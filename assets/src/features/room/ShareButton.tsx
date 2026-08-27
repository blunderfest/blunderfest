import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

/**
 * The room's primary action, in the app bar (ADR-0031): a gold Share button
 * copying the room's deep link — the code alone is ambiguous to paste, the
 * URL is clickable anywhere. The icon flips to a green check briefly, like
 * the code copy before it.
 */
export default function ShareButton({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/#/r/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions etc.) — nothing to show
    }
  }

  return (
    <button
      type="button"
      id="share-room-button"
      data-tour="share"
      className={button({ intent: 'primary', size: 'sm' })}
      aria-label={t('room.share')}
      title={t('room.shareHint')}
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
          className={`absolute inset-0 h-4 w-4 text-[#20180a] transition-all duration-200 ${
            copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
        >
          <path d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
      <span className="hidden sm:inline">{copied ? t('room.copied') : t('room.share')}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? t('room.copied') : t('room.share')}
      </span>
    </button>
  );
}
