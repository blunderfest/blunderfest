// biome-ignore-all lint/suspicious/noArrayIndexKey: tray rows come from parse/fetch batches that reset or append wholesale — the index IS the identity
import type { TFunction } from 'i18next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip, textarea } from '@/components/ui';
import { type ImportSkip, importAnything, splitImportInput } from '@/features/import/importSources';
import { type StripOptions, stripTree } from '@/features/import/stripTree';
import {
  ApiError,
  type ChesscomGame,
  fetchChesscomGames,
  fetchLichessGames,
  fetchStudies,
  type GameTree,
  importLichess,
  importLichessGames,
  importLichessStudy,
  importPgn,
  type LichessGame,
  type LichessStudy,
  lichessAuthStart,
} from '@/lib/api';
import { loadDevice } from '@/lib/device';
import { roomCodeInHash } from '@/lib/roomCode';
import { useScrollLock } from '@/lib/useScrollLock';

/**
 * The import dialog, redesigned as a tray with a checkout bar: a source
 * rail (always ALL sources — Chess.com needs no account, so it is never
 * hidden), one shared row shape per pane (parsed games pre-checked,
 * failures as red rows), and a fixed checkout bar that summarizes the
 * selection, hosts the keep-options as a popover (a setting, not content),
 * and confirms with a count-aware Import button. Every source ends in the
 * same contract: the bar's button is the single confirmation; deferred
 * selections (recent games, chess.com) fetch behind it; the keep options
 * apply to everything that enters the room.
 */

type KeepState = {
  evaluations: boolean;
  comments: boolean;
  variations: boolean;
  metadata: boolean;
};

const DEFAULT_KEEP: KeepState = {
  evaluations: false,
  comments: true,
  variations: true,
  metadata: true,
};

function stripOf(keep: KeepState): StripOptions {
  return {
    evaluations: !keep.evaluations,
    comments: !keep.comments,
    variations: !keep.variations,
    metadata: !keep.metadata,
  };
}

type ParseState =
  | { status: 'idle' }
  | { status: 'parsing' }
  | { status: 'ready'; trees: GameTree[]; skips: ImportSkip[] }
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

/** Bring games in — heroicons arrow-down-tray, same glyph as the rail's. */
function ImportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 text-muted"
    >
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3" />
    </svg>
  );
}

/** A one-line reason for a skipped game/URL, for the red failure rows. */
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

function whoOf(tree: GameTree): string {
  return `${tree.headers.White ?? '?'} – ${tree.headers.Black ?? '?'}`;
}

/** The shared selectable row shape across every source pane. */
function TrayRow({
  checked,
  onChecked,
  who,
  result,
  meta,
}: {
  checked: boolean;
  onChecked: (checked: boolean) => void;
  who: string;
  result?: string;
  meta?: string;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-baseline gap-2 rounded-control px-2 py-1.5 text-ui text-ink transition-colors hover:bg-raised">
        <input
          type="checkbox"
          className="relative top-px"
          checked={checked}
          onChange={(event) => onChecked(event.target.checked)}
        />
        <span className="min-w-0 flex-1 truncate">{who}</span>
        {result !== undefined && <span className="shrink-0 text-note text-faint">{result}</span>}
        {meta !== undefined && (
          <span className="shrink-0 text-note text-faint tabular-nums">{meta}</span>
        )}
      </label>
    </li>
  );
}

/** A parse/fetch failure: visible in the tray, red, not selectable. */
function FailedRow({ text }: { text: string }) {
  return (
    <li
      className="flex items-baseline gap-2 px-2 py-1.5 text-ui text-bad-hi"
      data-testid="import-failure-row"
    >
      <span aria-hidden="true">⚠</span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </li>
  );
}

export default function ImportDialog({
  onImported,
  onClose,
  lichessLinked = false,
}: {
  onImported: (trees: GameTree[]) => void;
  onClose: () => void;
  /** Enables the linked-account browsers (recent games, studies). */
  lichessLinked?: boolean;
}) {
  const { t } = useTranslation();
  useScrollLock();

  const [source, setSource] = useState<'paste' | 'lichess' | 'chesscom'>('paste');

  // Paste pane: live parse into pre-checked tray rows.
  const [input, setInput] = useState('');
  const [parse, setParse] = useState<ParseState>({ status: 'idle' });
  const [uncheckedPaste, setUncheckedPaste] = useState<ReadonlySet<number>>(new Set());
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Lichess pane: single-game fetch (works unlinked) + linked browsers.
  const [lichessUrl, setLichessUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<GameTree[]>([]);
  const [uncheckedFetched, setUncheckedFetched] = useState<ReadonlySet<number>>(new Set());
  const [segment, setSegment] = useState<'games' | 'studies'>('games');
  const [filter, setFilter] = useState('');
  const [studies, setStudies] = useState<StudiesState>({ status: 'idle' });
  const [studyTrees, setStudyTrees] = useState<GameTree[] | null>(null);
  const [uncheckedStudy, setUncheckedStudy] = useState<ReadonlySet<number>>(new Set());
  const [pickedStudyId, setPickedStudyId] = useState<string | null>(null);
  const [games, setGames] = useState<GamesState>({ status: 'idle' });
  const [selectedGames, setSelectedGames] = useState<ReadonlySet<string>>(new Set());

  // Chess.com pane.
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
  const [ccSelected, setCcSelected] = useState<ReadonlySet<string>>(new Set());

  // The keep-options: a setting in the checkout bar's popover, applied to
  // every import path. Checked = included; engine annotations excluded by
  // default.
  const [keep, setKeep] = useState<KeepState>(DEFAULT_KEEP);
  const [optsOpen, setOptsOpen] = useState(false);
  const optsRef = useRef<HTMLDivElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The options popover closes on outside click.
  useEffect(() => {
    if (!optsOpen) {
      return;
    }
    const onDown = (event: MouseEvent) => {
      if (optsRef.current !== null && !optsRef.current.contains(event.target as Node)) {
        setOptsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [optsOpen]);

  // Live parse of the paste box (debounced); editing resets the checks.
  useEffect(() => {
    const text = input.trim();
    if (text === '') {
      setParse({ status: 'idle' });
      setUncheckedPaste(new Set());
      return;
    }
    setParse({ status: 'parsing' });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      importAnything(text).then(
        (preview) => {
          if (!cancelled) {
            setParse({ status: 'ready', trees: preview.trees, skips: preview.skips });
            setUncheckedPaste(new Set());
          }
        },
        (error) => {
          if (!cancelled) {
            setParse({
              status: 'error',
              code: error instanceof ApiError ? error.code : 'unknown',
            });
          }
        },
      );
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input]);

  // The linked browsers load lazily the first time their segment opens.
  const studiesRequested = useRef(false);
  useEffect(() => {
    if (
      !lichessLinked ||
      source !== 'lichess' ||
      segment !== 'studies' ||
      studiesRequested.current
    ) {
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
        setStudies({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' }),
    );
  }, [lichessLinked, source, segment]);

  const gamesRequested = useRef(false);
  useEffect(() => {
    if (!lichessLinked || source !== 'lichess' || segment !== 'games' || gamesRequested.current) {
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
        setGames({ status: 'error', code: error instanceof ApiError ? error.code : 'unknown' }),
    );
  }, [lichessLinked, source, segment]);

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

  // A remembered username auto-loads the first time the pane opens.
  const ccAutoLoaded = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: auto-load once per pane open, with the username as remembered then
  useEffect(() => {
    if (source !== 'chesscom' || ccAutoLoaded.current || ccUser.trim() === '') {
      return;
    }
    ccAutoLoaded.current = true;
    loadChesscomGames();
  }, [source]);

  function appendFileText(file: File) {
    file.text().then((text) => {
      setInput((current) => (current.trim() === '' ? text : `${current}\n${text}`));
    });
  }

  function handleFetchLichess() {
    const raw = lichessUrl.trim();
    if (raw === '' || fetching) {
      return;
    }
    const url = raw.startsWith('http')
      ? raw
      : /^[\w-]{8}$/.test(raw)
        ? `https://lichess.org/${raw}`
        : null;
    if (url === null) {
      setFetchError(t('import.errors.invalid_lichess_url'));
      return;
    }
    setFetchError(null);
    setFetching(true);
    importLichess(url).then(
      ({ tree }) => {
        setFetched((current) => [...current, tree]);
        setLichessUrl('');
        setFetching(false);
      },
      (error) => {
        setFetching(false);
        setFetchError(
          error instanceof ApiError
            ? t(`import.errors.${error.code}`, { defaultValue: t('import.errors.unknown') })
            : t('import.errors.unknown'),
        );
      },
    );
  }

  function handlePickStudy(studyId: string) {
    const device = loadDevice();
    if (device === null) {
      return;
    }
    // Toggle: clicking the picked study again deselects it.
    if (pickedStudyId === studyId) {
      setPickedStudyId(null);
      setStudyTrees(null);
      setUncheckedStudy(new Set());
      return;
    }
    setPickedStudyId(studyId);
    importLichessStudy(device, studyId).then(
      (result) => {
        setStudyTrees(result.trees);
        setUncheckedStudy(new Set());
      },
      () => {
        setPickedStudyId(null);
        setStudyTrees(null);
      },
    );
  }

  // ——— The tray: what the checkout bar sees across all panes. ———
  const parsedTrees = parse.status === 'ready' ? parse.trees : [];
  const parsedSkips = parse.status === 'ready' ? parse.skips : [];
  const checkedPaste = parsedTrees.filter((_, index) => !uncheckedPaste.has(index));
  const checkedFetched = fetched.filter((_, index) => !uncheckedFetched.has(index));
  const studyList = studyTrees ?? [];
  const checkedStudy = studyList.filter((_, index) => !uncheckedStudy.has(index));
  const readyTrees = [...checkedPaste, ...checkedFetched, ...checkedStudy];
  const totalCount = readyTrees.length + selectedGames.size + ccSelected.size;

  const summary = (() => {
    if (totalCount === 0) {
      return t('import.checkoutNone');
    }
    const sources = new Set<string>();
    if (checkedPaste.length > 0) {
      sources.add('PGN');
    }
    if (checkedFetched.length + checkedStudy.length + selectedGames.size > 0) {
      sources.add('Lichess');
    }
    if (ccSelected.size > 0) {
      sources.add('Chess.com');
    }
    const sourceLabel = sources.size === 1 ? [...sources][0] : t('import.sourceMixed');
    const games = t('import.gamesSelected', { count: totalCount });
    if (selectedGames.size + ccSelected.size > 0) {
      return t('import.checkoutSummaryNoPlies', { games, source: sourceLabel });
    }
    const plies = readyTrees.reduce((sum, tree) => sum + tree.mainline_ply_count, 0);
    return t('import.checkoutSummary', {
      games,
      plies: t('import.pliesShort', { count: plies }),
      source: sourceLabel,
    });
  })();

  const nonDefaultKeep =
    keep.evaluations !== DEFAULT_KEEP.evaluations ||
    keep.comments !== DEFAULT_KEEP.comments ||
    keep.variations !== DEFAULT_KEEP.variations ||
    keep.metadata !== DEFAULT_KEEP.metadata;

  async function handleImport() {
    if (totalCount === 0 || importing) {
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const trees = [...readyTrees];
      const skips: ImportSkip[] = [];
      if (selectedGames.size > 0) {
        const device = loadDevice();
        if (device === null) {
          throw new ApiError('unauthorized');
        }
        const result = await importLichessGames(device, [...selectedGames]);
        trees.push(...result.trees);
        skips.push(...result.failures.map((failure) => ({ kind: 'pgnGame' as const, ...failure })));
      }
      if (ccSelected.size > 0 && ccState.status === 'loaded') {
        const pgns = ccState.games
          .filter((game) => ccSelected.has(game.id))
          .map((game) => game.pgn)
          .join('\n\n');
        const result = await importPgn(pgns);
        trees.push(...result.trees);
        skips.push(...result.failures.map((failure) => ({ kind: 'pgnGame' as const, ...failure })));
      }
      if (skips.length > 0) {
        // Partial failure: nothing enters the room; the reasons surface in
        // the banner so the offending selections can be dropped.
        setImportError(skips.map((skip) => skipLine(t, skip)).join(' · '));
        setImporting(false);
        return;
      }
      onImported(trees.map((tree) => stripTree(tree, stripOf(keep))));
      onClose();
    } catch (error) {
      setImportError(
        error instanceof ApiError
          ? t(`import.errors.${error.code}`, { defaultValue: t('import.errors.unknown') })
          : t('import.errors.unknown'),
      );
      setImporting(false);
    }
  }

  const [linkStarting, setLinkStarting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  function handleLinkLichess() {
    const device = loadDevice();
    if (device === null || linkStarting) {
      return;
    }
    setLinkStarting(true);
    setLinkError(null);
    const code = roomCodeInHash(window.location.hash);
    lichessAuthStart(device, code === null ? null : `#/r/${code}`).then(
      ({ url }) => window.location.assign(url),
      () => {
        setLinkStarting(false);
        setLinkError(t('import.errors.unknown'));
      },
    );
  }

  const detected = useMemo(() => splitImportInput(input), [input]);
  const filterLower = filter.trim().toLowerCase();
  const filteredGames =
    games.status === 'loaded'
      ? games.games.filter(
          (game) =>
            filterLower === '' || `${game.white} ${game.black}`.toLowerCase().includes(filterLower),
        )
      : [];
  const filteredStudies =
    studies.status === 'loaded'
      ? studies.studies.filter((study) => study.name.toLowerCase().includes(filterLower))
      : [];

  function toggleIn(set: ReadonlySet<string>, value: string, checked: boolean): Set<string> {
    const next = new Set(set);
    if (checked) {
      next.add(value);
    } else {
      next.delete(value);
    }
    return next;
  }

  function toggleIndex(set: ReadonlySet<number>, index: number, checked: boolean): Set<number> {
    const next = new Set(set);
    if (checked) {
      next.delete(index);
    } else {
      next.add(index);
    }
    return next;
  }

  const paneClass = 'flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-4';
  const railButton = (active: boolean) =>
    `flex items-center gap-2 rounded-control border px-2.5 py-2 text-left text-ui font-semibold transition-colors sm:w-full ${
      active
        ? 'border-brand-hi/60 bg-brand/15 text-ink'
        : 'border-transparent text-muted hover:bg-raised hover:text-ink'
    }`;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close; Esc closes too
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes too (keydown listener below)
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
        className="mt-2 flex h-[min(560px,calc(100dvh-1rem))] w-full max-w-[720px] animate-pop flex-col overflow-hidden rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)] sm:mt-16"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="m-0 flex items-center gap-2 text-lead font-semibold">
            <ImportIcon />
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

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div
            className="flex shrink-0 flex-row gap-1 border-b border-line p-2 sm:w-40 sm:flex-col sm:border-b-0 sm:border-r"
            role="tablist"
            aria-label={t('import.sourceLabel')}
          >
            {(
              [
                ['paste', t('import.pasteTab')],
                ['lichess', t('import.lichessTab')],
                ['chesscom', t('import.chesscomTab')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={source === id}
                className={railButton(source === id)}
                onClick={() => setSource(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {source === 'paste' ? (
            <div className={paneClass} data-testid="paste-panel">
              <div className="flex shrink-0 items-baseline justify-between gap-2">
                <label
                  className="text-micro font-semibold uppercase tracking-[0.08em] text-muted"
                  htmlFor="pgn-input"
                >
                  {t('import.inputLabel')}
                </label>
                <span className="flex items-center gap-2">
                  {parse.status === 'parsing' && (
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
              {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for .pgn files */}
              <div
                className={[
                  'flex shrink-0 flex-col gap-2 rounded-control border border-dashed p-2.5 transition-colors',
                  dragging ? 'border-accent bg-accent-muted' : 'border-line-strong bg-raised/40',
                ].join(' ')}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (file !== undefined) {
                    appendFileText(file);
                  }
                }}
              >
                <textarea
                  id="pgn-input"
                  aria-label={t('import.pgnLabel')}
                  className={`${textarea({ invalid: parse.status === 'error' })} h-32 font-mono text-note`}
                  placeholder={t('import.pgnPlaceholder')}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter confirms the tray (the checkout's single click);
                    // Shift+Enter still inserts a newline.
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleImport();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-note text-faint">
                    {t('import.dropHint')}{' '}
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => fileRef.current?.click()}
                    >
                      {t('import.pickFile')}
                    </button>
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pgn,.txt,text/plain"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file !== undefined) {
                        appendFileText(file);
                      }
                      event.target.value = '';
                    }}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {detected.lichessUrls.length > 0 && (
                  <span className={chip({ tone: 'info' })}>
                    {t('import.detectedLinks', { count: detected.lichessUrls.length })}
                  </span>
                )}
                {detected.pgn !== null && (
                  <span className={chip({ tone: 'neutral' })}>{t('import.detectedPgn')}</span>
                )}
                {parse.status === 'ready' && parsedTrees.length > 0 && parsedSkips.length === 0 && (
                  <span className={chip({ tone: 'ok' })}>{t('import.validBadge')}</span>
                )}
              </div>
              {parse.status === 'error' && (
                <p className="m-0 text-note text-bad-hi" role="alert">
                  {t(`import.errors.${parse.code}`, { defaultValue: t('import.errors.unknown') })}
                </p>
              )}
              {parsedTrees.length > 1 && (
                <p className="m-0 text-ui font-semibold text-ink">
                  {t('import.gamesFound', { count: parsedTrees.length })}
                </p>
              )}
              {(parsedTrees.length > 0 || parsedSkips.length > 0) && (
                <ul className="m-0 flex flex-col gap-0.5 p-0" data-testid="import-tray-rows">
                  {parsedTrees.map((tree, index) => (
                    <TrayRow
                      key={index}
                      checked={!uncheckedPaste.has(index)}
                      onChecked={(checked) =>
                        setUncheckedPaste((current) => toggleIndex(current, index, checked))
                      }
                      who={whoOf(tree)}
                      result={tree.result}
                      meta={t('import.pliesShort', { count: tree.mainline_ply_count })}
                    />
                  ))}
                  {parsedSkips.map((skip, index) => (
                    <FailedRow key={`skip-${index}`} text={skipLine(t, skip)} />
                  ))}
                </ul>
              )}
            </div>
          ) : source === 'lichess' ? (
            <div className={paneClass} data-testid="lichess-panel">
              <label
                className="shrink-0 text-micro font-semibold uppercase tracking-[0.08em] text-muted"
                htmlFor="lichess-url"
              >
                {t('import.lichessFieldLabel')}
              </label>
              <div className="flex shrink-0 gap-2">
                <input
                  id="lichess-url"
                  type="text"
                  className="min-w-0 flex-1 rounded-control border border-line bg-transparent px-2 py-1 text-ui text-ink outline-none placeholder:text-faint focus:border-line-strong"
                  placeholder={t('import.lichessFieldPlaceholder')}
                  value={lichessUrl}
                  onChange={(event) => setLichessUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleFetchLichess();
                    }
                  }}
                />
                <button
                  type="button"
                  className={button({ intent: 'secondary', size: 'sm' })}
                  disabled={fetching || lichessUrl.trim() === ''}
                  onClick={handleFetchLichess}
                >
                  {t('import.fetch')}
                </button>
              </div>
              {fetchError !== null && (
                <p className="m-0 text-note text-bad-hi" role="alert">
                  {fetchError}
                </p>
              )}
              {fetched.length > 0 && (
                <ul className="m-0 flex shrink-0 flex-col gap-0.5 p-0">
                  {fetched.map((tree, index) => (
                    <TrayRow
                      key={index}
                      checked={!uncheckedFetched.has(index)}
                      onChecked={(checked) =>
                        setUncheckedFetched((current) => toggleIndex(current, index, checked))
                      }
                      who={whoOf(tree)}
                      result={tree.result}
                      meta={t('import.pliesShort', { count: tree.mainline_ply_count })}
                    />
                  ))}
                </ul>
              )}
              {lichessLinked ? (
                <>
                  <div
                    className="flex shrink-0 gap-1"
                    role="tablist"
                    aria-label={t('import.sourceLabel')}
                  >
                    {(
                      [
                        ['games', t('import.gamesTab')],
                        ['studies', t('import.studiesTab')],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={segment === id}
                        className={`rounded-control border px-2.5 py-1 text-note font-semibold transition-colors ${
                          segment === id
                            ? 'border-line-strong bg-raised text-ink'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                        onClick={() => setSegment(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    aria-label={t('import.filterPlaceholder')}
                    className="shrink-0 rounded-control border border-line bg-transparent px-2 py-1 text-ui text-ink outline-none placeholder:text-faint focus:border-line-strong"
                    placeholder={t('import.filterPlaceholder')}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                  {segment === 'games' ? (
                    <>
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
                      {games.status === 'loaded' && filteredGames.length > 0 && (
                        <ul className="m-0 flex flex-col gap-0.5 p-0" data-testid="games-panel">
                          {filteredGames.map((game) => (
                            <TrayRow
                              key={game.id}
                              checked={selectedGames.has(game.id)}
                              onChecked={(checked) =>
                                setSelectedGames((current) => toggleIn(current, game.id, checked))
                              }
                              who={`${game.white} – ${game.black}`}
                              result={game.result}
                              meta={game.speed}
                            />
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <>
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
                      {studies.status === 'loaded' && filteredStudies.length > 0 && (
                        <ul
                          className="m-0 flex max-h-44 flex-col gap-0.5 overflow-y-auto p-0"
                          data-testid="studies-panel"
                        >
                          {filteredStudies.map((study) => (
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
                      {studyList.length > 0 && (
                        <ul className="m-0 flex flex-col gap-0.5 p-0">
                          {studyList.map((tree, index) => (
                            <TrayRow
                              key={index}
                              checked={!uncheckedStudy.has(index)}
                              onChecked={(checked) =>
                                setUncheckedStudy((current) => toggleIndex(current, index, checked))
                              }
                              who={whoOf(tree)}
                              result={tree.result}
                              meta={t('import.pliesShort', { count: tree.mainline_ply_count })}
                            />
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="flex shrink-0 flex-col gap-1.5 rounded-control border border-line bg-raised/40 p-3">
                  <p className="m-0 text-note text-faint">{t('import.linkHint')}</p>
                  <button
                    type="button"
                    className="self-start text-ui text-accent hover:underline disabled:opacity-50"
                    disabled={linkStarting}
                    onClick={handleLinkLichess}
                  >
                    {t('import.linkCta')}
                  </button>
                  {linkError !== null && (
                    <p className="m-0 text-note text-bad-hi" role="alert">
                      {linkError}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className={paneClass} data-testid="chesscom-panel">
              <div className="flex shrink-0 items-end gap-2">
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
                <input
                  type="month"
                  id="chesscom-month"
                  aria-label={t('import.chesscomMonthLabel')}
                  className="rounded-control border border-line bg-transparent px-2 py-1 text-ui text-ink outline-none focus:border-line-strong"
                  value={`${ccMonth.year}-${String(ccMonth.month).padStart(2, '0')}`}
                  onChange={(event) => {
                    const [year, month] = event.target.value.split('-').map(Number);
                    if (year !== undefined && month !== undefined && year > 0 && month > 0) {
                      setCcMonth({ year, month });
                      setCcState({ status: 'idle' });
                      setCcSelected(new Set());
                    }
                  }}
                />
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
                <ul className="m-0 flex max-h-64 flex-col gap-0.5 overflow-y-auto p-0">
                  {ccState.games.map((game) => (
                    <TrayRow
                      key={game.id}
                      checked={ccSelected.has(game.id)}
                      onChecked={(checked) =>
                        setCcSelected((current) => toggleIn(current, game.id, checked))
                      }
                      who={`${game.white} – ${game.black}`}
                      result={game.result}
                      meta={game.speed}
                    />
                  ))}
                </ul>
              )}
              <p className="m-0 shrink-0 text-note text-faint">{t('import.chesscomAttribution')}</p>
            </div>
          )}
        </div>

        {importError !== null && (
          <div
            className="flex shrink-0 items-start gap-2 border-t border-bad/40 bg-bad/10 px-4 py-2"
            role="alert"
            data-testid="import-failures"
          >
            <span aria-hidden="true" className="text-bad-hi">
              ⚠
            </span>
            <span className="text-note text-bad-hi">{importError}</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-4 py-2.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-note text-muted" data-testid="import-summary">
              {summary}
            </span>
            <span className="truncate text-micro text-faint">
              {t('import.sharedNote')} <kbd>Esc</kbd> {t('import.escToCancel')}
            </span>
          </div>
          <div className="relative" ref={optsRef}>
            <button
              type="button"
              className={button({ intent: 'secondary', size: 'sm' })}
              aria-haspopup="true"
              aria-expanded={optsOpen}
              onClick={() => setOptsOpen((open) => !open)}
            >
              {t('import.options')}
              {nonDefaultKeep && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
            </button>
            {optsOpen && (
              <div
                className="absolute bottom-full right-0 z-10 mb-2 flex w-64 flex-col gap-2 rounded-control border border-line-strong bg-overlay p-2.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.8)]"
                role="menu"
                aria-label={t('import.keepLabel')}
              >
                <span className="text-micro font-semibold uppercase tracking-[0.08em] text-faint">
                  {t('import.keepLabel')}
                </span>
                {(
                  [
                    ['comments', t('import.keepComments'), t('import.keepCommentsDesc')],
                    ['variations', t('import.keepVariations'), t('import.keepVariationsDesc')],
                    ['metadata', t('import.keepMetadata'), t('import.keepMetadataDesc')],
                    ['evaluations', t('import.keepEvaluations'), t('import.keepEvaluationsDesc')],
                  ] as const
                ).map(([key, label, description]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2.5">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-ui font-semibold text-ink">{label}</span>
                      <span className="text-note text-faint">{description}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="relative top-px"
                      aria-label={label}
                      checked={keep[key]}
                      onChange={(event) => setKeep({ ...keep, [key]: event.target.checked })}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            id="import-submit-button"
            className={button({ intent: 'primary', size: 'md' })}
            disabled={totalCount === 0 || importing}
            onClick={() => void handleImport()}
          >
            {totalCount > 0
              ? t('import.importSelected', { count: totalCount })
              : t('import.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
