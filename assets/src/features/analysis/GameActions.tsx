import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import { downloadPgn } from '@/features/analysis/pgnExport';
import { type GameTree, saveToLibrary, withDeviceRetry } from '@/lib/api';

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 text-ok"
    >
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

/**
 * The actions on the viewed game — export its PGN, save it to the library —
 * as icon buttons in the board header (the game's title bar).
 */
export default function GameActions({ tree }: { tree: GameTree }) {
  const { t } = useTranslation();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handleSave() {
    if (saveState !== 'idle') {
      return;
    }
    setSaveState('saving');
    try {
      // A 401 means the profile was wiped server-side (redeploy) — re-heal
      // and retry once before giving up.
      await withDeviceRetry((device) => saveToLibrary(device, tree));
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
    window.setTimeout(() => setSaveState('idle'), 2000);
  }

  const saveLabel =
    saveState === 'saved'
      ? t('room.savedToLibrary')
      : saveState === 'error'
        ? t('room.saveLibraryError')
        : t('room.saveToLibrary');

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        id="export-pgn-button"
        className={button({ intent: 'ghost', size: 'icon' })}
        aria-label={t('room.exportPgn')}
        title={t('room.exportPgn')}
        onClick={() => downloadPgn(tree)}
      >
        <DownloadIcon />
      </button>
      <button
        type="button"
        id="save-to-library-button"
        className={button({ intent: 'ghost', size: 'icon' })}
        aria-label={saveLabel}
        title={saveLabel}
        disabled={saveState === 'saving'}
        onClick={() => void handleSave()}
      >
        {saveState === 'saved' ? <CheckIcon /> : <BookmarkIcon />}
      </button>
    </div>
  );
}
