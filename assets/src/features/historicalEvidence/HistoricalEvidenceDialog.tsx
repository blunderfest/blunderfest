import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Board from '@/components/Board';
import { parseFen } from '@/components/board';
import HelpPopover from '@/components/HelpPopover';
import { button, statusDot } from '@/components/ui';
import {
  cachedResult,
  rememberResult,
  requestKey,
  resolvedLineMoves,
} from '@/features/historicalEvidence/evidenceCache';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type {
  EvidenceCandidate,
  GameMeta,
  HistoricalEvidenceResult,
  PlanSide,
} from '@/features/historicalEvidence/types';
import {
  analyzeHistoricalEvidence,
  fetchHistoricalGame,
  type GameTree,
  type LegalMove,
} from '@/lib/api';
import { useScrollLock } from '@/lib/useScrollLock';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; result: HistoricalEvidenceResult }
  | { kind: 'error'; code: string };

/** How long a variation add may wait for its echo before giving up. */
const VARIATION_ECHO_TIMEOUT_MS = 5000;

/**
 * Whether a candidate is the game being analyzed itself. The corpus may
 * contain the imported game; showing it as "historical evidence" for
 * itself is noise — you are already looking at it. Identified by the PGN
 * headers (players and result), which the corpus meta mirrors. Header
 * fields that differ (or are absent) keep the candidate: a partial match
 * is not enough to hide it.
 */
function isAnalyzedGame(game: GameMeta, headers: Record<string, string>): boolean {
  const white = headers.White;
  const black = headers.Black;
  const result = headers.Result;
  if (white === undefined || black === undefined) {
    return false;
  }
  if (game.white !== white || game.black !== black) {
    return false;
  }
  return result === undefined || game.result === result;
}

function HelpContent() {
  const { t } = useTranslation();

  const sections = [
    ['helpPositionTitle', 'helpPositionBody'],
    ['helpRouteTitle', 'helpRouteBody'],
    ['helpFamiliesTitle', 'helpFamiliesBody'],
    ['helpHistoricalTitle', 'helpHistoricalBody'],
    ['helpFlagsTitle', 'helpFlagsBody'],
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      {sections.map(([titleKey, bodyKey]) => (
        <div key={titleKey} className="flex flex-col gap-0.5">
          <h4 className="m-0 text-note font-semibold text-ink">{t(`evidence.${titleKey}`)}</h4>
          <p className="m-0 text-note text-muted">{t(`evidence.${bodyKey}`)}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The historical-examples browser (replaces the Examples tab, ADR-0030):
 * a modal carousel over the candidates for the cursor's position. The
 * corpus query runs privately on open — nothing is shared with the room
 * until the user picks a candidate, and a pick is the existing
 * `set_game` / `add_line` op, so only picked games become everyone's.
 *
 * One slide per candidate: a static board at the candidate position plus
 * the facts card with its pick actions. Picks never auto-advance — the
 * button flips to "Added ✓" and the user browses on (a candidate can be
 * added as a game AND as a variation without navigating back and forth).
 * Finished analyses are remembered per request (session cache), so a
 * close-and-reopen for the same position never re-runs the query.
 */
export default function HistoricalEvidenceDialog({
  fen,
  route = null,
  refPly = null,
  gameHeaders = {},
  onClose,
  onAddGame,
  onAddVariation,
  variationState,
  addedGids,
}: {
  /** The board cursor's position when the dialog was opened (fixed). */
  fen: string | null;
  /** The SAN path from the game start to the position (null when unknown). */
  route?: string[] | null;
  /** The position's ply in the game. */
  refPly?: number | null;
  /**
   * The analyzed game's PGN headers — candidates that ARE this game are
   * filtered out (the corpus may contain the imported game itself).
   */
  gameHeaders?: Record<string, string>;
  onClose: () => void;
  /** Add a historical game to the room as another game (cursor at `ply`). */
  onAddGame?: (tree: GameTree, ply: number, gid: number) => void;
  /** Add the historical continuation as a variation under the viewed node. */
  onAddVariation?: (fen: string, sans: string[], exact: boolean) => void;
  /**
   * Per-candidate button state from the orchestrator: whether the planned
   * line is playable from the viewed node and whether the tree already
   * contains it — the card's "Added ✓" state is echo-proven, never
   * guessed. `moves` is the pre-resolved candidate line.
   */
  variationState?: (
    fen: string,
    moves: LegalMove[],
    exact: boolean,
  ) => { addable: boolean; exists: boolean };
  /**
   * Corpus game ids already in the room (host-tracked): the card shows
   * "Added ✓" without another round trip.
   */
  addedGids?: ReadonlySet<number>;
}) {
  const { t } = useTranslation();
  useScrollLock();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [addingGid, setAddingGid] = useState<number | null>(null);
  const [addFailed, setAddFailed] = useState(false);
  /** The candidate whose variation add is awaiting its echo. */
  const [pendingVariation, setPendingVariation] = useState<string | null>(null);
  const pendingTimer = useRef<number | null>(null);

  // The query runs once per dialog open, privately — the captured fen/route
  // never change while the dialog is up, so there is no stale state to
  // track (the modal blocks cursor navigation).
  useEffect(() => {
    // Focus the dialog on open: the arrow keys then belong to the carousel
    // instead of whatever held focus (a focused move-list option captures
    // them itself, and the board keyboard is suspended while the dialog is
    // open).
    panelRef.current?.focus();
    if (fen === null) {
      setStatus({ kind: 'error', code: 'invalid_fen' });
      return;
    }
    const key = requestKey(fen, route ?? null, refPly ?? null);
    const cached = cachedResult(key);
    if (cached !== undefined) {
      setStatus({ kind: 'ready', result: cached });
      return;
    }
    let cancelled = false;
    analyzeHistoricalEvidence(fen, {
      route: route ?? undefined,
      refPly: refPly ?? undefined,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        rememberResult(key, result);
        // Resolve the candidates' lines now, under the "Searching…" note:
        // the SAN resolution is ~0.8s of chess.js work for 20+ candidates,
        // and doing it before the results appear keeps the first render
        // cheap. The cache is module-wide, so later opens stay cheap too.
        for (const candidate of result.candidates) {
          resolvedLineMoves(
            candidate.strategy === 'exact' ? fen : candidate.fen,
            candidate.continuation.moves,
          );
        }
        setStatus({ kind: 'ready', result });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ kind: 'error', code: 'unknown' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fen, route, refPly]);

  useEffect(() => {
    return () => {
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
      }
    };
  }, []);

  /** Candidates minus the analyzed game itself (headers identify it). */
  const visibleCandidates = useMemo(() => {
    if (status.kind !== 'ready') {
      return [];
    }
    return status.result.candidates.filter(
      (candidate) => !isAnalyzedGame(candidate.game, gameHeaders),
    );
  }, [status, gameHeaders]);

  // Plan id → per-side actions, from the top member of each family in the
  // decision menu (members are sorted by occurrence count).
  const plans = useMemo(() => {
    if (status.kind !== 'ready') {
      return new Map<number, PlanSide>();
    }
    const map = new Map<number, PlanSide>();
    for (const family of status.result.reference.families) {
      const top = family.members[0];
      if (top !== undefined) {
        map.set(family.id, { white: top.white, black: top.black });
      }
    }
    return map;
  }, [status]);

  /**
   * Candidate id → resolved continuation moves, computed once per result
   * (the FEN is fixed while the dialog is open), with the deterministic
   * resolution cached module-wide (and warmed while the corpus query runs).
   */
  const candidateMoves = useMemo(() => {
    if (status.kind !== 'ready' || fen === null) {
      return null;
    }
    return status.result.candidates.map((candidate) => ({
      candidate,
      moves:
        candidate.strategy === 'exact'
          ? resolvedLineMoves(fen, candidate.continuation.moves)
          : resolvedLineMoves(candidate.fen, candidate.continuation.moves),
    }));
  }, [status, fen]);

  /** Candidate id → variation button state, computed once per result. */
  const variationStates = useMemo(() => {
    if (candidateMoves === null || variationState === undefined) {
      return null;
    }
    const map = new Map<string, { addable: boolean; exists: boolean }>();
    for (const { candidate, moves } of candidateMoves) {
      map.set(candidate.id, variationState(candidate.fen, moves, candidate.strategy === 'exact'));
    }
    return map;
  }, [candidateMoves, variationState]);

  // The pending add resolves the moment the echo lands in the tree — the
  // button's exists state flips and "Adding…" becomes "Added ✓".
  useEffect(() => {
    if (pendingVariation !== null && variationStates?.get(pendingVariation)?.exists === true) {
      setPendingVariation(null);
    }
  }, [pendingVariation, variationStates]);

  const count = visibleCandidates.length;
  const countRef = useRef(count);
  countRef.current = count;

  const clampedIndex = count === 0 ? 0 : Math.min(index, count - 1);
  const slide = count === 0 ? null : visibleCandidates[clampedIndex];

  // Esc closes; the arrow keys page through the carousel.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft') {
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === 'ArrowRight') {
        setIndex((current) => Math.min(countRef.current - 1, current + 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fetch the corpus game and hand it to the room as another game. The
  // host records the gid (its `addedGids` set feeds back into this dialog),
  // so the button flips to "Added ✓" whether the game was added now or is
  // a duplicate the host skipped.
  const addGame = useCallback(
    async (gid: number, ply: number) => {
      setAddingGid(gid);
      setAddFailed(false);
      try {
        const { tree } = await fetchHistoricalGame(gid);
        onAddGame?.(tree, ply, gid);
      } catch {
        setAddFailed(true);
      } finally {
        setAddingGid(null);
      }
    },
    [onAddGame],
  );

  const addVariation = useCallback(
    (candidate: EvidenceCandidate) => {
      setPendingVariation(candidate.id);
      // The op has no rejection callback — if the echo never lands (a
      // rejected op), give the "Adding…" state up after a grace period.
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
      }
      pendingTimer.current = window.setTimeout(() => {
        setPendingVariation((pending) => (pending === candidate.id ? null : pending));
      }, VARIATION_ECHO_TIMEOUT_MS);
      onAddVariation?.(candidate.fen, candidate.continuation.moves, candidate.strategy === 'exact');
    },
    [onAddVariation],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('evidence.dialogTitle')}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close; Esc closes too */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes too (see the keydown listener below) */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        data-testid="historical-evidence-backdrop"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-2xl flex-col gap-3 rounded-panel border border-line bg-surface p-4 shadow-panel outline-none"
        data-testid="historical-evidence-dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="m-0 text-lead font-semibold text-ink">{t('evidence.dialogTitle')}</h3>
            <HelpPopover label={t('evidence.helpTitle')}>
              <HelpContent />
            </HelpPopover>
          </div>
          <button
            type="button"
            className={button({ intent: 'ghost', size: 'icon' })}
            aria-label={t('evidence.close')}
            onClick={onClose}
            data-testid="historical-evidence-close"
          >
            ×
          </button>
        </header>

        {status.kind === 'loading' ? (
          <p
            className="m-0 flex items-center justify-center gap-2 py-6 text-note text-muted"
            role="status"
          >
            <span className={statusDot({ tone: 'warn', pulse: true })} />
            {t('evidence.searching')}
          </p>
        ) : status.kind === 'error' ? (
          <p className="m-0 py-6 text-center text-note text-danger" role="alert">
            {status.code === 'invalid_fen' ? t('evidence.invalidFen') : t('evidence.error')}
          </p>
        ) : (
          <>
            <p className="m-0 shrink-0 text-center text-note text-faint tabular-nums">
              {t('evidence.examples', { count })} · {status.result.timings.total_ms} ms
            </p>
            {addFailed && (
              <p className="m-0 shrink-0 text-center text-note text-danger">
                {t('evidence.openError')}
              </p>
            )}
            {count === 0 ? (
              <p className="m-0 py-6 text-center text-note text-faint">
                {t('evidence.noCandidates')}
              </p>
            ) : slide === null ? null : (
              <>
                <div className="flex h-[min(60dvh,34rem)] flex-col items-center gap-3 overflow-y-auto">
                  {/* Fixed slide height: the carousel frame must not resize
                      between candidates — a taller card scrolls inside
                      instead of growing the dialog under the user's
                      prev/next finger. */}
                  {/* The sized wrapper, not the board itself, is what the
                      column centers: the board carries `self-start` (the
                      main layout needs it), which would otherwise pin it
                      to the left edge while the card below centers. */}
                  <div className="w-[220px] shrink-0">
                    <Board
                      position={parseFen(slide.fen)}
                      flipped={slide.stm === 'b'}
                      label={`${slide.game.white} — ${slide.game.black}`}
                      width={220}
                    />
                  </div>
                  <HistoricalEvidenceCard
                    candidate={slide}
                    plans={plans}
                    adding={addingGid === slide.gid}
                    addedToRoom={addedGids?.has(slide.gid) ?? false}
                    variationState={variationStates?.get(slide.id) ?? null}
                    addingVariation={pendingVariation === slide.id}
                    onAddGame={
                      onAddGame !== undefined ? () => addGame(slide.gid, slide.ply) : undefined
                    }
                    onAddVariation={
                      onAddVariation !== undefined ? () => addVariation(slide) : undefined
                    }
                  />
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    className={button({ intent: 'secondary', size: 'sm' })}
                    disabled={clampedIndex === 0}
                    aria-label={t('evidence.previous')}
                    onClick={() => setIndex((current) => Math.max(0, current - 1))}
                    data-testid="historical-evidence-prev"
                  >
                    ← {t('evidence.previous')}
                  </button>
                  <span className="text-note text-muted tabular-nums" aria-live="polite">
                    {t('evidence.counter', { index: clampedIndex + 1, total: count })}
                  </span>
                  <button
                    type="button"
                    className={button({ intent: 'secondary', size: 'sm' })}
                    disabled={clampedIndex === count - 1}
                    aria-label={t('evidence.next')}
                    onClick={() =>
                      setIndex((current) => Math.min(countRef.current - 1, current + 1))
                    }
                    data-testid="historical-evidence-next"
                  >
                    {t('evidence.next')} →
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
