import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, input, panel } from '@/components/ui';
import { ApiError, type GameTree, importLichess, importPgn } from '@/lib/api';

type ImportState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'success'; tree: GameTree }
  | { status: 'error'; code: string };

export default function ImportForm({ onImported }: { onImported: (tree: GameTree) => void }) {
  const { t } = useTranslation();
  const [pgn, setPgn] = useState('');
  const [url, setUrl] = useState('');
  const [state, setState] = useState<ImportState>({ status: 'idle' });

  function handleImport() {
    if (state.status === 'importing') {
      return;
    }
    if (!pgn.trim() && !url.trim()) {
      return;
    }

    setState({ status: 'importing' });

    const request = url.trim() ? importLichess(url.trim()) : importPgn(pgn);
    request.then(
      ({ tree }) => {
        setState({ status: 'success', tree });
        onImported(tree);
      },
      (error) =>
        setState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' }),
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex w-full max-w-xl flex-col gap-2">
        <h2 className="m-0 text-2xl tracking-[-0.02em]">{t('import.title')}</h2>
        <p className="m-0 text-muted">{t('import.subtitle')}</p>
      </div>

      <section className={panel({ width: 'md' })}>
        <label className="m-0 text-sm font-semibold text-muted" htmlFor="pgn-input">
          {t('import.pgnLabel')}
        </label>
        <textarea
          id="pgn-input"
          className="h-40 w-full resize-y rounded-lg border border-white/10 bg-transparent px-3 py-2 font-mono text-xs text-ink placeholder:text-muted focus:border-white/40 focus:outline-none"
          placeholder={t('import.pgnPlaceholder')}
          value={pgn}
          onChange={(event) => setPgn(event.target.value)}
        />
        <label className="m-0 text-sm font-semibold text-muted" htmlFor="lichess-url-input">
          {t('import.lichessLabel')}
        </label>
        <input
          id="lichess-url-input"
          className={input()}
          placeholder={t('import.lichessPlaceholder')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              handleImport();
            }
          }}
        />
        <button
          type="button"
          id="import-submit-button"
          className={button({ variant: 'primary', disabled: 'dim' })}
          disabled={state.status === 'importing' || (!pgn.trim() && !url.trim())}
          onClick={handleImport}
        >
          {t('import.submit')}
        </button>
        {state.status === 'error' && (
          <p className="m-0 text-sm text-bad" role="alert">
            {t(`import.errors.${state.code}`)}
          </p>
        )}
      </section>
    </div>
  );
}
