import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import { downloadPgn } from '@/features/analysis/pgnExport';
import { type GameTree, saveToLibrary, withDeviceRetry } from '@/lib/api';

/**
 * The actions on the viewed game: export its PGN, save it to the library.
 * They live on the Moves tab — what you export or save is the move list
 * you're looking at.
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

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <button
        type="button"
        id="export-pgn-button"
        className={button({ intent: 'quiet', size: 'sm' })}
        onClick={() => downloadPgn(tree)}
      >
        {t('room.exportPgn')}
      </button>
      <button
        type="button"
        id="save-to-library-button"
        className={button({ intent: 'quiet', size: 'sm' })}
        onClick={() => void handleSave()}
        disabled={saveState === 'saving'}
      >
        {saveState === 'saved'
          ? t('room.savedToLibrary')
          : saveState === 'error'
            ? t('room.saveLibraryError')
            : t('room.saveToLibrary')}
      </button>
    </div>
  );
}
