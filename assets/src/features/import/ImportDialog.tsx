import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip, textarea } from '@/components/ui';
import { ApiError, type GameTree, importLichess, importPgn } from '@/lib/api';

type PreviewState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'preview'; tree: GameTree; source: 'pgn' | 'lichess' }
  | { status: 'error'; code: string };

const SAMPLE_PGN = `[Event "Friendly sample"]
[White "Anna"]
[Black "Boris"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 (3... Nf6 {The Berlin.}) 4. Ba4 Nf6 5. O-O Be7 1-0
`;

/**
 * The import dialog: a modal for pasting PGN or a Lichess URL. Input is
 * parsed (debounced) into a preview; nothing enters the room until the user
 * confirms. Esc or a backdrop click closes it.
 */
export default function ImportDialog({
  onImported,
  onClose,
}: {
  onImported: (tree: GameTree) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isUrl = /lichess\.org|^[A-Za-z0-9]{6,12}$/.test(input.trim()) && !input.includes(' ');

  useEffect(() => {
    const text = input.trim();
    if (text === '') {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'parsing' });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const request = isUrl ? importLichess(text) : importPgn(text);
      request.then(
        ({ tree }) => {
          if (!cancelled) {
            setState({ status: 'preview', tree, source: isUrl ? 'lichess' : 'pgn' });
          }
        },
        (error) => {
          if (!cancelled) {
            setState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' });
          }
        },
      );
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, isUrl]);

  const preview = state.status === 'preview' ? state.tree : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close; Esc closes too
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes too (see the keydown listener below)
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/75 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('import.title')}
        className="mt-16 w-full max-w-[640px] animate-pop rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="m-0 text-lead font-semibold">{t('import.title')}</h2>
          <button
            type="button"
            aria-label={t('import.cancel')}
            className={button({ intent: 'ghost', size: 'icon' })}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <p className="m-0 text-ui text-muted">{t('import.subtitle')}</p>
          <textarea
            ref={inputRef}
            id="pgn-input"
            aria-label={t('import.pgnLabel')}
            className={`${textarea()} h-36 font-mono text-note`}
            placeholder={t('import.pgnPlaceholder')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <span aria-live="polite">
              {state.status === 'parsing' && (
                <span className="text-ui text-muted">{t('import.parsing')}</span>
              )}
              {state.status === 'error' && (
                <span className="text-ui text-bad-hi" role="alert">
                  ⚠ {t(`import.errors.${state.code}`)}
                </span>
              )}
            </span>
            <button
              type="button"
              className={button({ intent: 'ghost', size: 'sm' })}
              onClick={() => setInput(SAMPLE_PGN)}
            >
              {t('import.useSample')}
            </button>
          </div>

          {preview !== null && (
            <div className="flex flex-col gap-1 rounded-control border border-line bg-panel p-3">
              <div className="flex items-center gap-2">
                <span
                  className={chip({
                    tone:
                      state.status === 'preview' && state.source === 'lichess' ? 'info' : 'neutral',
                  })}
                >
                  {state.status === 'preview' && state.source === 'lichess' ? 'lichess' : 'pgn'}
                </span>
                <span className="text-ui font-semibold text-ink">
                  {preview.headers.White ?? '?'} – {preview.headers.Black ?? '?'}
                </span>
                <span className={chip({ tone: 'outline' })}>{preview.result}</span>
              </div>
              <p className="m-0 text-note text-muted">
                {[
                  preview.headers.Event,
                  preview.headers.Date,
                  t('import.size', {
                    plies: preview.mainline_ply_count,
                    nodes: preview.node_count,
                  }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="text-note text-faint">{t('import.sharedNote')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={button({ intent: 'secondary', size: 'md' })}
              onClick={onClose}
            >
              {t('import.cancel')}
            </button>
            <button
              type="button"
              id="import-submit-button"
              className={button({ intent: 'primary', size: 'md' })}
              disabled={preview === null}
              onClick={() => {
                if (preview !== null) {
                  onImported(preview);
                  onClose();
                }
              }}
            >
              {t('import.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
