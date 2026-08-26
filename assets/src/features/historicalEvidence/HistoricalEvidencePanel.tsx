import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button, statusDot } from '@/components/ui';
import { sanLineToMoves } from '@/features/analysis/legalMoves';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type {
  EvidenceCandidate,
  GameMeta,
  HistoricalEvidenceResult,
  PlanSide,
} from '@/features/historicalEvidence/types';
import type { GameTree, LegalMove } from '@/lib/api';
import { analyzeHistoricalEvidence, fetchHistoricalGame } from '@/lib/api';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: HistoricalEvidenceResult }
  | { kind: 'error'; code: string };

/** How long a variation add may wait for its echo before giving up. */
const VARIATION_ECHO_TIMEOUT_MS = 5000;

/**
 * Resolved SAN→moves lines, keyed by FEN + SAN list. The resolution
 * (chess.js legal-move generation) is deterministic per input and the
 * expensive part of the variation button's state check — which runs for
 * every candidate whenever the viewer lands on an analyzed position.
 * Caching it keeps re-landings cheap; the cap bounds memory.
 */
const MOVES_CACHE = new Map<string, LegalMove[]>();
const MOVES_CACHE_LIMIT = 200;

function resolvedLineMoves(fen: string, sans: string[]): LegalMove[] {
  const key = `${fen}\n${sans.join(' ')}`;
  const cached = MOVES_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const moves = sanLineToMoves(fen, sans);
  MOVES_CACHE.set(key, moves);
  if (MOVES_CACHE.size > MOVES_CACHE_LIMIT) {
    const oldest = MOVES_CACHE.keys().next().value;
    if (oldest !== undefined) {
      MOVES_CACHE.delete(oldest);
    }
  }
  return moves;
}

/**
 * Finished analyses, keyed by their request (position + route + ply), kept
 * for the session. The panel unmounts on every game switch — without this,
 * switching back to a game would throw a finished analysis away and force a
 * re-run. A re-run always re-fetches (the corpus may change between
 * deploys); the cache only restores the last result for a position.
 */
const RESULT_CACHE = new Map<string, HistoricalEvidenceResult>();
const RESULT_CACHE_LIMIT = 20;

function requestKey(fen: string, route: string[] | null, refPly: number | null): string {
  return JSON.stringify([fen, route ?? null, refPly ?? null]);
}

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

/** Clears remembered results and resolved lines (tests). */
export function resetHistoricalEvidenceCache(): void {
  RESULT_CACHE.clear();
  MOVES_CACHE.clear();
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
 * The Analyze interaction (design brief §20): one button, then evidence
 * cards for the board cursor's position. The analysis is deliberately
 * manual — each run is a heavy corpus query (~0.8s), so it re-runs only
 * on demand; a stale result (the cursor moved) is flagged, never shown.
 * Finished analyses are remembered for the session (per request), so a
 * game switch — which unmounts the panel — never throws a result away.
 *
 * The action follows the engine analysis rule: read-only rooms (the demo)
 * and viewers can't request an analysis.
 */
export default function HistoricalEvidencePanel({
  fen,
  route,
  refPly,
  canAnalyze = true,
  onAddGame,
  onAddVariation,
  variationState,
  addedGids,
  gameHeaders = {},
  sharedEvidenceRun = null,
  onEvidenceRun,
}: {
  /** The board cursor's position (null when no game). */
  fen: string | null;
  /** The SAN path from the game start to the position (null when unknown). */
  route: string[] | null;
  /** The position's ply in the game. */
  refPly: number | null;
  /** Editors only (the demo room and viewers are read-only). */
  canAnalyze?: boolean;
  /** Add a historical game to the room as another game (cursor at `ply`). */
  onAddGame?: (tree: GameTree, ply: number, gid: number) => void;
  /**
   * Add the historical continuation as a variation under the viewed node:
   * a plain line for exact candidates, otherwise the candidate's position
   * is attached as a setup child first.
   */
  onAddVariation?: (fen: string, sans: string[], exact: boolean) => void;
  /**
   * Per-candidate button state from the orchestrator: whether the planned
   * line is playable from the viewed node and whether the tree already
   * contains it — the card's "Added ✓" state is echo-proven, never
   * guessed. `moves` is the pre-resolved candidate line (the panel
   * resolves and caches it — the orchestrator only walks the tree).
   */
  variationState?: (
    fen: string,
    moves: LegalMove[],
    exact: boolean,
  ) => { addable: boolean; exists: boolean };
  /**
   * Corpus game ids already in the room (host-tracked, survives panel
   * remounts): the card shows "Added ✓" without another round trip.
   */
  addedGids?: ReadonlySet<number>;
  /**
   * The analyzed game's PGN headers — candidates that ARE this game are
   * filtered out (the corpus may contain the imported game itself).
   */
  gameHeaders?: Record<string, string>;
  /**
   * Another member's Examples analysis request (transient broadcast):
   * when the cursor is on that position, this panel runs the same query
   * so one member's examples become everyone's.
   */
  sharedEvidenceRun?: { fen: string; route: string[] | null; refPly: number | null } | null;
  /** Shares this viewer's own analysis request with the room (button runs only). */
  onEvidenceRun?: (run: { fen: string; route: string[] | null; refPly: number | null }) => void;
}) {
  const { t } = useTranslation();
  // A finished analysis for the viewed position survives remounts (game
  // switches) via the session cache; otherwise the panel starts idle.
  const [status, setStatus] = useState<Status>(() => {
    if (fen === null) {
      return { kind: 'idle' };
    }
    const cached = RESULT_CACHE.get(requestKey(fen, route, refPly));
    return cached !== undefined ? { kind: 'ready', result: cached } : { kind: 'idle' };
  });
  const [ranFor, setRanFor] = useState<string | null>(() =>
    fen !== null && RESULT_CACHE.has(requestKey(fen, route, refPly)) ? fen : null,
  );

  /**
   * Runs the query without sharing it — the auto-run path must not
   * re-broadcast (that would ping-pong between clients). The button path
   * (`run`) shares first, then calls this.
   */
  const runQuery = useCallback(
    (query: { fen: string; route: string[] | null; refPly: number | null }) => {
      setStatus({ kind: 'loading' });

      analyzeHistoricalEvidence(query.fen, {
        route: query.route ?? undefined,
        refPly: query.refPly ?? undefined,
      })
        .then((result) => {
          const key = requestKey(query.fen, query.route, query.refPly);
          RESULT_CACHE.set(key, result);
          if (RESULT_CACHE.size > RESULT_CACHE_LIMIT) {
            const oldest = RESULT_CACHE.keys().next().value;
            if (oldest !== undefined) {
              RESULT_CACHE.delete(oldest);
            }
          }
          // Resolve the candidates' lines now, under the "Searching…" note:
          // the SAN resolution is ~0.8s of chess.js work for 20+ candidates,
          // and doing it before the results appear keeps the first render
          // (and every later landing — the cache is module-wide) cheap.
          for (const candidate of result.candidates) {
            resolvedLineMoves(
              candidate.strategy === 'exact' ? query.fen : candidate.fen,
              candidate.continuation.moves,
            );
          }
          setStatus({ kind: 'ready', result });
          setRanFor(query.fen);
        })
        .catch(() => {
          setStatus({ kind: 'error', code: 'unknown' });
        });
    },
    [],
  );

  const run = useCallback(() => {
    if (fen === null) {
      return;
    }
    onEvidenceRun?.({ fen, route: route ?? null, refPly: refPly ?? null });
    runQuery({ fen, route: route ?? null, refPly: refPly ?? null });
  }, [fen, route, refPly, onEvidenceRun, runQuery]);

  const stale = status.kind === 'ready' && ranFor !== fen;
  // The results for the viewed position are already shown — re-running
  // would just repeat the same corpus query. The button re-enables when
  // the cursor moves (stale) or a run fails.
  const disabled =
    fen === null || status.kind === 'loading' || !canAnalyze || (status.kind === 'ready' && !stale);

  // Another member ran the analysis for the viewed position: run the same
  // query (once per position per mount) so the examples are shared. The
  // viewer's own route/ply are preferred — the FEN is what matters.
  // Deliberately NOT gated on canAnalyze: viewers can't initiate a run,
  // but seeing an editor's shared results is a read-only view of them.
  const lastAutoRun = useRef<string | null>(null);
  useEffect(() => {
    if (
      sharedEvidenceRun !== null &&
      fen !== null &&
      sharedEvidenceRun.fen === fen &&
      !(status.kind === 'ready' && !stale)
    ) {
      if (lastAutoRun.current !== sharedEvidenceRun.fen) {
        lastAutoRun.current = sharedEvidenceRun.fen;
        runQuery({
          fen,
          route: route ?? sharedEvidenceRun.route,
          refPly: refPly ?? sharedEvidenceRun.refPly,
        });
      }
    }
  }, [sharedEvidenceRun, fen, route, refPly, status, stale, runQuery]);

  const [addingGid, setAddingGid] = useState<number | null>(null);
  const [addFailed, setAddFailed] = useState(false);
  /** The candidate whose variation add is awaiting its echo. */
  const [pendingVariation, setPendingVariation] = useState<string | null>(null);
  const pendingTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimer.current !== null) {
        window.clearTimeout(pendingTimer.current);
      }
    };
  }, []);

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

  /** Candidates minus the analyzed game itself (headers identify it). */
  const visibleCandidates = useMemo(() => {
    if (status.kind !== 'ready') {
      return [];
    }
    return status.result.candidates.filter(
      (candidate) => !isAnalyzedGame(candidate.game, gameHeaders),
    );
  }, [status, gameHeaders]);

  /**
   * Candidate id → resolved continuation moves. Computed once per current
   * result (the FEN is fixed while the results are current), with the
   * deterministic resolution cached module-wide (and warmed while the
   * corpus query runs) — re-landing on the same position costs tree walks
   * only.
   */
  const candidateMoves = useMemo(() => {
    if (status.kind !== 'ready' || stale || fen === null) {
      return null;
    }
    return status.result.candidates.map((candidate) => ({
      candidate,
      moves:
        candidate.strategy === 'exact'
          ? resolvedLineMoves(fen, candidate.continuation.moves)
          : resolvedLineMoves(candidate.fen, candidate.continuation.moves),
    }));
  }, [status, stale, fen]);

  /**
   * Candidate id → variation button state. Only computed while the cards
   * are actually shown (a current, non-stale result): navigating the game
   * re-renders this panel on every cursor move, and planning 20+ candidate
   * lines per move made navigation sluggish for nothing — stale results
   * are hidden anyway.
   */
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

  // Fetch the corpus game and hand it to the room as another game. The
  // host records the gid (its `addedGids` set feeds back into this panel),
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
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2" data-testid="historical-evidence-panel">
      <div className="flex shrink-0 items-center justify-center gap-2">
        <button
          type="button"
          className={button({ intent: 'primary', size: 'sm' })}
          disabled={disabled}
          title={!canAnalyze ? t('evidence.editorsRun') : undefined}
          onClick={run}
          data-testid="historical-evidence-run"
        >
          {t('evidence.run')}
        </button>
        <HelpPopover label={t('evidence.helpTitle')}>
          <HelpContent />
        </HelpPopover>
      </div>
      {status.kind === 'ready' && !stale && (
        <p className="m-0 shrink-0 text-center text-note text-faint tabular-nums">
          {t('evidence.examples', { count: visibleCandidates.length })} ·{' '}
          {status.result.timings.total_ms} ms
        </p>
      )}
      {addFailed && (
        <p className="m-0 shrink-0 text-center text-note text-danger">{t('evidence.openError')}</p>
      )}

      {/*
        Viewers render the same states as editors — the cards are visible
        to everyone. Only the action buttons and the run button are gated
        on edit rights (the card hides its actions when the callbacks are
        absent), so a viewer reads the shared examples but can't add them.
      */}
      {fen === null ? (
        <p className="m-0 text-note text-faint">{t('analysis.noGame')}</p>
      ) : status.kind === 'loading' ? (
        <p
          className="m-0 flex items-center justify-center gap-2 text-note text-muted"
          role="status"
        >
          <span className={statusDot({ tone: 'warn', pulse: true })} />
          {t('evidence.searching')}
        </p>
      ) : status.kind === 'error' ? (
        <p className="m-0 text-note text-danger">
          {status.code === 'invalid_fen' ? t('evidence.invalidFen') : t('evidence.error')}
        </p>
      ) : status.kind === 'idle' || stale ? (
        <p className="m-0 text-note text-faint">
          {stale ? t('evidence.positionChanged') : t('evidence.empty')}
        </p>
      ) : visibleCandidates.length === 0 ? (
        <p className="m-0 text-note text-faint">{t('evidence.noCandidates')}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {visibleCandidates.map((candidate) => (
            <HistoricalEvidenceCard
              key={candidate.id}
              candidate={candidate}
              plans={plans}
              adding={addingGid === candidate.gid}
              addedToRoom={addedGids?.has(candidate.gid) ?? false}
              variationState={variationStates?.get(candidate.id) ?? null}
              addingVariation={pendingVariation === candidate.id}
              onAddGame={
                onAddGame !== undefined ? () => addGame(candidate.gid, candidate.ply) : undefined
              }
              onAddVariation={
                onAddVariation !== undefined ? () => addVariation(candidate) : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
