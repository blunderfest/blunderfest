import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip, textarea } from '@/components/ui';
import {
  countVariations,
  hasComments,
  hasEvaluations,
  type StripOptions,
  stripTree,
} from '@/features/import/stripTree';
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

function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-gold-hi"
    >
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

/**
 * The import dialog: a modal for pasting PGN or a Lichess URL — one box,
 * auto-detected. Input is parsed (debounced) into a preview; nothing enters
 * the room until the user confirms. Esc or a backdrop click closes it.
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
  // What the import keeps, not what it strips: checked = included. Engine
  // annotations are the one thing excluded by default.
  const [keep, setKeep] = useState({
    evaluations: false,
    comments: true,
    variations: true,
    metadata: true,
  });
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

  // The preview shows the tree *after* stripping — what's previewed is
  // exactly what enters the room.
  const displayTree = useMemo(() => {
    if (preview === null) {
      return null;
    }
    const strip: StripOptions = {
      evaluations: !keep.evaluations,
      comments: !keep.comments,
      variations: !keep.variations,
      metadata: !keep.metadata,
    };
    return stripTree(preview, strip);
  }, [preview, keep]);

  const strippable = useMemo(
    () =>
      preview === null
        ? null
        : {
            evaluations: hasEvaluations(preview.root),
            comments: hasComments(preview.root),
            variations: countVariations(preview.root) > 0,
            metadata: Object.keys(preview.headers).length > 0,
          },
    [preview],
  );

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
        className="mt-4 max-h-[calc(100vh-2rem)] w-full max-w-[640px] animate-pop overflow-y-auto rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)] sm:mt-16"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="m-0 flex items-center gap-2 text-lead font-semibold">
            <UploadIcon />
            {t('import.title')}
          </h2>
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
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <label
                className="text-micro font-semibold uppercase tracking-[0.08em] text-muted"
                htmlFor="pgn-input"
              >
                {t('import.inputLabel')}
              </label>
              <span className="flex items-center gap-2">
                {state.status === 'parsing' && (
                  <span className="text-note text-faint">{t('import.parsing')}</span>
                )}
                <button
                  type="button"
                  className={button({ intent: 'ghost', size: 'xs' })}
                  onClick={() => setInput(SAMPLE_PGN)}
                >
                  {t('import.useSample')}
                </button>
              </span>
            </div>
            <textarea
              ref={inputRef}
              id="pgn-input"
              aria-label={t('import.pgnLabel')}
              className={`${textarea({ invalid: state.status === 'error' })} h-36 font-mono text-note`}
              placeholder={t('import.pgnPlaceholder')}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </div>

          {state.status === 'error' && (
            <div
              className="flex items-start gap-2 rounded-control border border-bad/40 bg-bad/10 p-2.5"
              role="alert"
            >
              <span aria-hidden="true" className="text-bad-hi">
                ⚠
              </span>
              <div className="flex flex-col">
                <span className="text-ui font-semibold text-bad-hi">{t('import.errorTitle')}</span>
                <span className="text-note text-bad-hi/90">{t(`import.errors.${state.code}`)}</span>
              </div>
            </div>
          )}

          {displayTree !== null && (
            <div className="flex flex-col gap-2 overflow-hidden rounded-control border border-line">
              <div className="flex items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2">
                <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                  {t('import.previewTitle')}
                </span>
                <span className={chip({ tone: 'ok' })}>{t('import.validBadge')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                    {t('import.players')}
                  </span>
                  <span className="flex items-center gap-1.5 text-ui text-ink">
                    <span className="inline-block h-3 w-3 rounded-[2px] border border-line-strong bg-[#f9f9f9]" />
                    {displayTree.headers.White ?? '?'}
                    <span className="text-faint">vs</span>
                    <span className="inline-block h-3 w-3 rounded-[2px] border border-line-strong bg-[#1a1a1a]" />
                    {displayTree.headers.Black ?? '?'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                    {t('import.result')}
                  </span>
                  <span className="text-ui font-semibold text-ink">{displayTree.result}</span>
                </div>
                {(displayTree.headers.Event || displayTree.headers.Date) && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                      {t('import.eventDate')}
                    </span>
                    <span className="text-ui text-ink">
                      {[displayTree.headers.Event, displayTree.headers.Date]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                    {t('import.stats')}
                  </span>
                  <span className="text-ui text-ink tabular-nums">
                    {t('import.size', {
                      plies: displayTree.mainline_ply_count,
                      nodes: displayTree.node_count,
                    }) +
                      ' · ' +
                      t('import.variationCount', { count: countVariations(displayTree.root) })}
                  </span>
                </div>
                <div className="col-span-2">
                  <span
                    className={chip({
                      tone:
                        state.status === 'preview' && state.source === 'lichess'
                          ? 'info'
                          : 'neutral',
                    })}
                  >
                    {state.status === 'preview' && state.source === 'lichess' ? 'lichess' : 'pgn'}
                  </span>
                </div>
                {strippable !== null &&
                  (strippable.evaluations ||
                    strippable.comments ||
                    strippable.variations ||
                    strippable.metadata) && (
                    <fieldset className="col-span-2 m-0 border-0 border-t border-line p-0 pt-2">
                      <legend className="mb-1.5 text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                        {t('import.keepLabel')}
                      </legend>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(
                          [
                            [
                              'comments',
                              t('import.keepComments'),
                              t('import.keepCommentsDesc'),
                              strippable.comments,
                            ],
                            [
                              'variations',
                              t('import.keepVariations'),
                              t('import.keepVariationsDesc'),
                              strippable.variations,
                            ],
                            [
                              'metadata',
                              t('import.keepMetadata'),
                              t('import.keepMetadataDesc'),
                              strippable.metadata,
                            ],
                            [
                              'evaluations',
                              t('import.keepEvaluations'),
                              t('import.keepEvaluationsDesc'),
                              strippable.evaluations,
                            ],
                          ] as const
                        ).map(([key, title, description, applicable]) =>
                          applicable ? (
                            <label
                              key={key}
                              className="group/card flex cursor-pointer items-start gap-2 rounded-control border border-line bg-raised p-2.5 transition-colors has-[:checked]:border-gold/60 has-[:checked]:bg-gold/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-hi"
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                aria-label={title}
                                checked={keep[key]}
                                onChange={(event) =>
                                  setKeep({ ...keep, [key]: event.target.checked })
                                }
                              />
                              <span
                                aria-hidden="true"
                                className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-line-strong transition-colors group-has-[:checked]/card:border-gold group-has-[:checked]/card:bg-gold"
                              >
                                {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative tick — the wrapping span is aria-hidden and the real checkbox carries the state */}
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="h-3 w-3 text-[#20180a] opacity-0 transition-opacity group-has-[:checked]/card:opacity-100"
                                >
                                  <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z" />
                                </svg>
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className="text-ui font-semibold text-ink">{title}</span>
                                <span className="text-note text-faint">{description}</span>
                              </span>
                            </label>
                          ) : null,
                        )}
                      </div>
                    </fieldset>
                  )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          <span className="text-note text-faint">
            {t('import.sharedNote')} <kbd>Esc</kbd> {t('import.escToCancel')}
          </span>
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
              disabled={displayTree === null}
              onClick={() => {
                if (displayTree !== null) {
                  onImported(displayTree);
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
