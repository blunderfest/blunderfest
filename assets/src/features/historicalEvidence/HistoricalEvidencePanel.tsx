import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button, statusDot } from '@/components/ui';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type {
  EvidenceCandidate,
  GameMeta,
  HistoricalEvidenceResult,
  PlanSide,
} from '@/features/historicalEvidence/types';
import type { GameTree } from '@/lib/api';
import { analyzeHistoricalEvidence, fetchHistoricalGame } from '@/lib/api';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: HistoricalEvidenceResult }
  | { kind: 'error'; code: string };

/** How long a variation add may wait for its echo before giving up. */
const VARIATION_ECHO_TIMEOUT_MS = 5000;

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

/** Clears remembered results (tests). */
export function resetHistoricalEvidenceCache(): void {
  RESULT_CACHE.clear();
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
   * guessed.
   */
  variationState?: (
    fen: string,
    sans: string[],
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

  const run = useCallback(() => {
    if (fen === null) {
      return;
    }

    setStatus({ kind: 'loading' });

    analyzeHistoricalEvidence(fen, { route: route ?? undefined, refPly: refPly ?? undefined })
      .then((result) => {
        const key = requestKey(fen, route, refPly);
        RESULT_CACHE.set(key, result);
        if (RESULT_CACHE.size > RESULT_CACHE_LIMIT) {
          const oldest = RESULT_CACHE.keys().next().value;
          if (oldest !== undefined) {
            RESULT_CACHE.delete(oldest);
          }
        }
        setStatus({ kind: 'ready', result });
        setRanFor(fen);
      })
      .catch(() => {
        setStatus({ kind: 'error', code: 'unknown' });
      });
  }, [fen, route, refPly]);

  const stale = status.kind === 'ready' && ranFor !== fen;
  // The results for the viewed position are already shown — re-running
  // would just repeat the same corpus query. The button re-enables when
  // the cursor moves (stale) or a run fails.
  const disabled =
    fen === null || status.kind === 'loading' || !canAnalyze || (status.kind === 'ready' && !stale);
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
   * Candidate id → variation button state. Recomputed only when the
   * results or the orchestrator's tree view change (`variationState` is
   * referentially stable across engine ticks), so this stays cheap.
   */
  const variationStates = useMemo(() => {
    if (status.kind !== 'ready' || variationState === undefined) {
      return null;
    }
    const map = new Map<string, { addable: boolean; exists: boolean }>();
    for (const candidate of status.result.candidates) {
      map.set(
        candidate.id,
        variationState(candidate.fen, candidate.continuation.moves, candidate.strategy === 'exact'),
      );
    }
    return map;
  }, [status, variationState]);

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

      {fen === null ? (
        <p className="m-0 text-note text-faint">{t('analysis.noGame')}</p>
      ) : !canAnalyze ? (
        <p className="m-0 text-note text-faint">{t('evidence.readOnly')}</p>
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
