import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip, textarea } from '@/components/ui';
import { type ImportSkip, importAnything } from '@/features/import/importSources';
import {
  countVariations,
  hasComments,
  hasEvaluations,
  type StripOptions,
  stripTree,
} from '@/features/import/stripTree';
import {
  ApiError,
  type ChesscomGame,
  fetchChesscomGames,
  fetchLichessGames,
  fetchStudies,
  type GameTree,
  importLichessGames,
  importLichessStudy,
  importPgn,
  type LichessGame,
  type LichessStudy,
} from '@/lib/api';
import { loadDevice } from '@/lib/device';
import { useScrollLock } from '@/lib/useScrollLock';

type PreviewState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | {
      status: 'preview';
      trees: GameTree[];
      skips: ImportSkip[];
      source: 'pgn' | 'lichess' | 'mixed' | 'chesscom';
    }
  | { status: 'error'; code: string };

type StudiesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; studies: LichessStudy[] }
  | { status: 'error'; code: string };

type GamesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; games: LichessGame[] }
  | { status: 'error'; code: string };

type ChesscomState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; games: ChesscomGame[] }
  | { status: 'empty' }
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
      className="text-muted"
    >
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

/** A one-line reason for a skipped game/URL, for the warning box. */
function skipLine(t: TFunction, skip: ImportSkip): string {
  if (skip.kind === 'pgnGame') {
    const reason = t(`import.reasons.${skip.detail.reason}`, {
      defaultValue: t('import.reasons.unknown'),
    });
    return t('import.skipGame', {
      index: skip.index,
      reason: skip.detail.san !== undefined ? `${reason} (${skip.detail.san})` : reason,
    });
  }
  if (skip.kind === 'lichess') {
    return t('import.skipLichess', {
      url: skip.url,
      reason: t(`import.reasons.${skip.code}`, { defaultValue: t('import.reasons.unknown') }),
    });
  }
  return t(`import.errors.${skip.code}`, { defaultValue: t('import.errors.unknown') });
}

/**
 * The import dialog: a modal for pasting PGN/Lichess URLs or, when the
 * profile is Lichess-linked, picking one of the owner's studies (every
 * chapter imports). Input is parsed (debounced) into a preview; nothing
 * enters the room until the user confirms. Esc or a backdrop click closes
 * it.
 */
export default function ImportDialog({
  onImported,
  onClose,
  lichessLinked = false,
}: {
  onImported: (trees: GameTree[]) => void;
  onClose: () => void;
  /** Shows the "My Lichess studies" source tab (ADR-0022). */
  lichessLinked?: boolean;
}) {
  const { t } = useTranslation();
  useScrollLock();
  const [input, setInput] = useState('');
  const [state, setState] = useState<PreviewState>({ status: 'idle' });
  const [sourceTab, setSourceTab] = useState<'paste' | 'studies' | 'games' | 'chesscom'>('paste');
  const [studies, setStudies] = useState<StudiesState>({ status: 'idle' });
  // The currently picked study (toggle: click again to deselect).
  const [pickedStudyId, setPickedStudyId] = useState<string | null>(null);
  const [games, setGames] = useState<GamesState>({ status: 'idle' });
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [ccUser, setCcUser] = useState(() => {
    try {
      return localStorage.getItem('blunderfest.chesscom-user') ?? '';
    } catch {
      return '';
    }
  });
  const [ccMonth, setCcMonth] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() + 1 };
  });
  const [ccState, setCcState] = useState<ChesscomState>({ status: 'idle' });
  const [ccSelected, setCcSelected] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    const text = input.trim();
    if (text === '') {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'parsing' });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      importAnything(text).then(
        (preview) => {
          if (!cancelled) {
            setState({ status: 'preview', ...preview });
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
  }, [input]);

  // The linked account's studies load lazily the first time the tab opens
  // (a ref guard: flipping to `loading` must not re-run and self-cancel).
  const studiesRequested = useRef(false);
  useEffect(() => {
    if (sourceTab !== 'studies' || studiesRequested.current) {
      return;
    }
    studiesRequested.current = true;
    const device = loadDevice();
    if (device === null) {
      setStudies({ status: 'error', code: 'unauthorized' });
      return;
    }
    setStudies({ status: 'loading' });
    fetchStudies(device).then(
      (result) => setStudies({ status: 'loaded', studies: result.studies }),
      (error) =>
        setStudies({
          status: 'error',
          code: error instanceof ApiError ? error.code : 'unknown',
        }),
    );
  }, [sourceTab]);

  const gamesRequested = useRef(false);
  useEffect(() => {
    if (sourceTab !== 'games' || gamesRequested.current) {
      return;
    }
    gamesRequested.current = true;
    const device = loadDevice();
    if (device === null) {
      setGames({ status: 'error', code: 'unauthorized' });
      return;
    }
    setGames({ status: 'loading' });
    fetchLichessGames(device).then(
      (result) => setGames({ status: 'loaded', games: result.games }),
      (error) =>
        setGames({
          status: 'error',
          code: error instanceof ApiError ? error.code : 'unknown',
        }),
    );
  }, [sourceTab]);

  function handlePickStudy(studyId: string) {
    const device = loadDevice();
    if (device === null) {
      return;
    }

    // Toggle: clicking the picked study again deselects it (clears the
    // preview back to the study list).
    if (pickedStudyId === studyId) {
      setPickedStudyId(null);
      setState({ status: 'idle' });
      return;
    }

    setPickedStudyId(studyId);
    setState({ status: 'parsing' });
    importLichessStudy(device, studyId).then(
      (result) => {
        setState({
          status: 'preview',
          trees: result.trees,
          skips: result.failures.map((failure) => ({ kind: 'pgnGame' as const, ...failure })),
          source: 'lichess',
        });
      },
      (error) => {
        setPickedStudyId(null);
        setState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' });
      },
    );
  }

  function handleImportSelectedGames() {
    const device = loadDevice();
    if (device === null || selectedGames.size === 0) {
      return;
    }
    setState({ status: 'parsing' });
    importLichessGames(device, [...selectedGames]).then(
      (result) => {
        // Clean fetch → import immediately (the selection WAS the
        // confirmation; a second Import click was a usability bug).
        // Failures pause at the preview with the skip list.
        if (result.failures.length === 0) {
          onImported(result.trees);
          onClose();
          return;
        }

        setState({
          status: 'preview',
          trees: result.trees,
          skips: result.failures.map((failure) => ({ kind: 'pgnGame' as const, ...failure })),
          source: 'lichess',
        });
      },
      (error) => {
        setState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' });
      },
    );
  }

  function loadChesscomGames(username = ccUser, month = ccMonth) {
    const device = loadDevice();
    const trimmed = username.trim();
    if (device === null || trimmed === '') {
      return;
    }
    try {
      localStorage.setItem('blunderfest.chesscom-user', trimmed);
    } catch {
      // private mode — the username just won't persist
    }
    setCcState({ status: 'loading' });
    setCcSelected(new Set());
    fetchChesscomGames(device, trimmed, month.year, month.month).then(
      (result) => {
        setCcState(
          result.games.length === 0
            ? { status: 'empty' }
            : { status: 'loaded', games: result.games },
        );
      },
      (error) => {
        setCcState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' });
      },
    );
  }

  function handleImportChesscom() {
    if (ccState.status !== 'loaded' || ccSelected.size === 0) {
      return;
    }
    const pgns = ccState.games
      .filter((game) => ccSelected.has(game.id))
      .map((game) => game.pgn)
      .join('\n\n');
    setState({ status: 'parsing' });
    importPgn(pgns).then(
      (result) => {
        // Same one-click contract as the Lichess games tab: clean fetch
        // imports immediately; failures pause at the preview.
        if (result.failures.length === 0) {
          onImported(result.trees);
          onClose();
          return;
        }

        setState({
          status: 'preview',
          trees: result.trees,
          skips: result.failures.map((failure) => ({ kind: 'pgnGame' as const, ...failure })),
          source: 'chesscom',
        });
      },
      (error) => {
        setState({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' });
      },
    );
  }

  const preview = state.status === 'preview' ? state.trees : null;
  const skips = state.status === 'preview' ? state.skips : [];

  // The preview shows the trees *after* stripping — what's imported is
  // exactly what enters the room.
  const displayTrees = useMemo(() => {
    if (preview === null) {
      return null;
    }
    const strip: StripOptions = {
      evaluations: !keep.evaluations,
      comments: !keep.comments,
      variations: !keep.variations,
      metadata: !keep.metadata,
    };
    return preview.map((tree) => stripTree(tree, strip));
  }, [preview, keep]);

  const strippable = useMemo(
    () =>
      preview === null
        ? null
        : {
            evaluations: preview.some((tree) => hasEvaluations(tree.root)),
            comments: preview.some((tree) => hasComments(tree.root)),
            variations: preview.some((tree) => countVariations(tree.root) > 0),
            metadata: preview.some((tree) => Object.keys(tree.headers).length > 0),
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
        className="mt-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-[640px] animate-pop flex-col overflow-hidden rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)] sm:mt-16"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
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

        {/*
          The shrink-0 on every direct child matters: without it a tight
          viewport would flex-shrink the preview panel (which has
          overflow-hidden) and silently clip the keep-cards instead of
          letting this body scroll.
        */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
          {lichessLinked && (
            <div
              className="flex shrink-0 gap-1"
              role="tablist"
              aria-label={t('import.sourceLabel')}
            >
              {(['paste', 'studies', 'games', 'chesscom'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={sourceTab === tab}
                  className={`rounded-control border px-2.5 py-1 text-note font-semibold transition-colors ${
                    sourceTab === tab
                      ? 'border-brand-hi/60 bg-brand/15 text-ink'
                      : 'border-line text-muted hover:border-line-strong hover:text-ink'
                  }`}
                  onClick={() => setSourceTab(tab)}
                >
                  {t(
                    tab === 'paste'
                      ? 'import.pasteTab'
                      : tab === 'studies'
                        ? 'import.studiesTab'
                        : tab === 'games'
                          ? 'import.gamesTab'
                          : 'import.chesscomTab',
                  )}
                </button>
              ))}
            </div>
          )}

          {sourceTab === 'paste' ? (
            <div className="flex shrink-0 flex-col gap-1">
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
              <p className="m-0 text-note text-faint">{t('import.multiHint')}</p>
            </div>
          ) : sourceTab === 'studies' ? (
            <div className="flex shrink-0 flex-col gap-1" data-testid="studies-panel">
              <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                {t('import.studiesLabel')}
              </span>
              {studies.status === 'loading' && (
                <p className="m-0 text-ui text-faint">{t('import.studiesLoading')}</p>
              )}
              {studies.status === 'error' && (
                <p className="m-0 text-ui text-bad-hi" role="alert">
                  {t(`import.errors.${studies.code}`)}
                </p>
              )}
              {studies.status === 'loaded' && studies.studies.length === 0 && (
                <p className="m-0 text-ui text-faint">{t('import.studiesEmpty')}</p>
              )}
              {studies.status === 'loaded' && studies.studies.length > 0 && (
                <ul className="m-0 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                  {studies.studies.map((study) => (
                    <li key={study.id}>
                      <button
                        type="button"
                        aria-pressed={pickedStudyId === study.id}
                        className={
                          pickedStudyId === study.id
                            ? 'flex w-full items-baseline justify-between gap-2 rounded-control bg-accent-muted px-2 py-1.5 text-left text-ui text-ink outline-1 outline-accent/60 transition-colors hover:bg-accent/20'
                            : 'flex w-full items-baseline justify-between gap-2 rounded-control px-2 py-1.5 text-left text-ui text-ink transition-colors hover:bg-raised'
                        }
                        onClick={() => handlePickStudy(study.id)}
                      >
                        <span className="min-w-0 flex-1 truncate">{study.name}</span>
                        <span className="shrink-0 text-note text-faint tabular-nums">
                          {new Date(study.updated_at).toLocaleDateString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : sourceTab === 'games' ? (
            <div className="flex shrink-0 flex-col gap-1" data-testid="games-panel">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                  {t('import.gamesLabel')}
                </span>
              </div>
              {games.status === 'loading' && (
                <p className="m-0 text-ui text-faint">{t('import.gamesLoading')}</p>
              )}
              {games.status === 'error' && (
                <p className="m-0 text-ui text-bad-hi" role="alert">
                  {t(`import.errors.${games.code}`)}
                </p>
              )}
              {games.status === 'loaded' && games.games.length === 0 && (
                <p className="m-0 text-ui text-faint">{t('import.gamesEmpty')}</p>
              )}
              {games.status === 'loaded' && games.games.length > 0 && (
                <ul className="m-0 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                  {games.games.map((game) => (
                    <li key={game.id}>
                      <label className="flex cursor-pointer items-baseline gap-2 rounded-control px-2 py-1.5 text-ui text-ink transition-colors hover:bg-raised">
                        <input
                          type="checkbox"
                          className="relative top-px"
                          checked={selectedGames.has(game.id)}
                          onChange={(event) => {
                            setSelectedGames((current) => {
                              const next = new Set(current);
                              if (event.target.checked) {
                                next.add(game.id);
                              } else {
                                next.delete(game.id);
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {game.white} – {game.black}
                        </span>
                        <span className="shrink-0 text-note text-faint tabular-nums">
                          {game.result} · {game.speed}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex shrink-0 flex-col gap-2" data-testid="chesscom-panel">
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label
                    className="text-micro font-semibold uppercase tracking-[0.08em] text-muted"
                    htmlFor="chesscom-username"
                  >
                    {t('import.chesscomUserLabel')}
                  </label>
                  <input
                    id="chesscom-username"
                    className="rounded-control border border-line bg-transparent px-2 py-1 text-ui text-ink outline-none placeholder:text-faint focus:border-line-strong"
                    placeholder={t('import.chesscomUserPlaceholder')}
                    value={ccUser}
                    onChange={(event) => {
                      setCcUser(event.target.value);
                      // Username change also invalidates the loaded list —
                      // manual reload required.
                      setCcState({ status: 'idle' });
                      setCcSelected(new Set());
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        loadChesscomGames();
                      }
                    }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="month"
                    id="chesscom-month"
                    className="rounded-control border border-line bg-transparent px-2 py-1 text-ui text-ink outline-none focus:border-line-strong"
                    value={`${ccMonth.year}-${String(ccMonth.month).padStart(2, '0')}`}
                    onChange={(event) => {
                      const [y, m] = event.target.value.split('-').map(Number);
                      if (y && m) {
                        setCcMonth({ year: y, month: m });
                        // Manual trigger only (Chess.com API etiquette): a
                        // month change never auto-loads — the user clicks
                        // Load games again. The previously loaded list is
                        // marked stale rather than silently kept.
                        setCcState({ status: 'idle' });
                        setCcSelected(new Set());
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  id="chesscom-load-button"
                  className={button({ intent: 'secondary', size: 'sm' })}
                  disabled={ccUser.trim() === '' || ccState.status === 'loading'}
                  onClick={() => loadChesscomGames()}
                >
                  {ccState.status === 'loading'
                    ? t('import.chesscomLoading')
                    : t('import.chesscomLoad')}
                </button>
              </div>

              {ccState.status === 'empty' && (
                <p className="m-0 text-ui text-faint">{t('import.chesscomEmpty')}</p>
              )}
              {ccState.status === 'error' && (
                <p className="m-0 text-ui text-bad-hi" role="alert">
                  {t(`import.errors.${ccState.code}`)}
                </p>
              )}
              {ccState.status === 'loaded' && (
                <ul className="m-0 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                  {ccState.games.map((game) => (
                    <li key={game.id}>
                      <label className="flex cursor-pointer items-baseline gap-2 rounded-control px-2 py-1.5 text-ui text-ink transition-colors hover:bg-raised">
                        <input
                          type="checkbox"
                          className="relative top-px"
                          checked={ccSelected.has(game.id)}
                          onChange={(event) => {
                            setCcSelected((current) => {
                              const next = new Set(current);
                              if (event.target.checked) {
                                next.add(game.id);
                              } else {
                                next.delete(game.id);
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {game.white} – {game.black}
                        </span>
                        <span className="shrink-0 text-note text-faint tabular-nums">
                          {game.result} · {game.speed}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="m-0 text-note text-faint">{t('import.chesscomAttribution')}</p>
            </div>
          )}

          {state.status === 'error' && (
            <div
              className="flex shrink-0 items-start gap-2 rounded-control border border-bad/40 bg-bad/10 p-2.5"
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

          {skips.length > 0 && (
            <div
              className="flex shrink-0 items-start gap-2 rounded-control border border-warn/40 bg-warn/10 p-2.5"
              role="alert"
              data-testid="import-failures"
            >
              <span aria-hidden="true" className="text-warn-hi">
                ⚠
              </span>
              <div className="flex flex-col">
                <span className="text-ui font-semibold text-warn-hi">
                  {t('import.partialTitle')}
                </span>
                {skips.map((skip, position) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the skip list is static per parse — the index IS the identity
                  <span key={position} className="text-note text-warn-hi/90">
                    {skipLine(t, skip)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {displayTrees !== null &&
            (displayTrees.length === 1 ? (
              <div className="flex shrink-0 flex-col gap-2 overflow-hidden rounded-control border border-line">
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
                      {displayTrees[0].headers.White ?? '?'}
                      <span className="text-faint">vs</span>
                      <span className="inline-block h-3 w-3 rounded-[2px] border border-line-strong bg-[#1a1a1a]" />
                      {displayTrees[0].headers.Black ?? '?'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                      {t('import.result')}
                    </span>
                    <span className="text-ui font-semibold text-ink">{displayTrees[0].result}</span>
                  </div>
                  {(displayTrees[0].headers.Event || displayTrees[0].headers.Date) && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                        {t('import.eventDate')}
                      </span>
                      <span className="text-ui text-ink">
                        {[displayTrees[0].headers.Event, displayTrees[0].headers.Date]
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
                        plies: displayTrees[0].mainline_ply_count,
                        nodes: displayTrees[0].node_count,
                      }) +
                        ' · ' +
                        t('import.variationCount', {
                          count: countVariations(displayTrees[0].root),
                        })}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={chip({
                        tone:
                          state.status === 'preview' && state.source !== 'pgn' ? 'info' : 'neutral',
                      })}
                    >
                      {state.status === 'preview' && state.source === 'mixed'
                        ? 'pgn + lichess'
                        : state.status === 'preview' && state.source === 'lichess'
                          ? 'lichess'
                          : state.status === 'preview' && state.source === 'chesscom'
                            ? 'chess.com'
                            : 'pgn'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex shrink-0 flex-col gap-2 overflow-hidden rounded-control border border-line">
                <div className="flex items-center justify-between gap-2 border-b border-line bg-raised px-3 py-2">
                  <span className="text-micro font-semibold uppercase tracking-[0.08em] text-muted">
                    {t('import.previewTitle')}
                  </span>
                  <span className={chip({ tone: 'ok' })}>{t('import.validBadge')}</span>
                </div>
                <div className="flex flex-col gap-1.5 p-3">
                  <p className="m-0 text-ui font-semibold text-ink">
                    {t('import.gamesFound', { count: displayTrees.length })}
                  </p>
                  <ul className="m-0 flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                    {displayTrees.map((tree, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the preview list is static per parse — the index IS the identity
                      <li key={index} className="flex items-center gap-2 text-ui">
                        <span className="min-w-0 flex-1 truncate text-ink">
                          {tree.headers.White ?? '?'} – {tree.headers.Black ?? '?'}
                        </span>
                        <span className="text-faint">{tree.result}</span>
                        <span className="tabular-nums text-faint">
                          {t('import.pliesShort', { count: tree.mainline_ply_count })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          {displayTrees !== null &&
            strippable !== null &&
            (strippable.evaluations ||
              strippable.comments ||
              strippable.variations ||
              strippable.metadata) && (
              <fieldset className="m-0 border-0 border-t border-line p-0 pt-2">
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
                        className="group/card flex cursor-pointer items-start gap-2 rounded-control border border-line bg-raised p-2.5 transition-colors has-[:checked]:border-accent/60 has-[:checked]:bg-accent-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          aria-label={title}
                          checked={keep[key]}
                          onChange={(event) => setKeep({ ...keep, [key]: event.target.checked })}
                        />
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-line-strong transition-colors group-has-[:checked]/card:border-accent group-has-[:checked]/card:bg-accent"
                        >
                          {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative tick — the wrapping span is aria-hidden and the real checkbox carries the state */}
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3 w-3 text-void opacity-0 transition-opacity group-has-[:checked]/card:opacity-100"
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

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-4 py-3">
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
              disabled={displayTrees === null && selectedGames.size === 0 && ccSelected.size === 0}
              onClick={() => {
                // A selection on the games/chess.com tabs fetches and
                // imports in one click — handleImportSelectedGames /
                // handleImportChesscom call onImported directly when there
                // are no failures (a failed fetch shows the preview with
                // the skip list, same as the other sources).
                if (displayTrees === null) {
                  if (selectedGames.size > 0) {
                    handleImportSelectedGames();
                    return;
                  }

                  if (ccSelected.size > 0) {
                    handleImportChesscom();
                    return;
                  }
                }

                if (displayTrees !== null) {
                  onImported(displayTrees);
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
