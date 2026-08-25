import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button } from '@/components/ui';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type {
  EvidenceCandidate,
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
  onAddGame?: (tree: GameTree, ply: number) => void;
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
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [ranFor, setRanFor] = useState<string | null>(null);

  const run = useCallback(() => {
    if (fen === null) {
      return;
    }

    setStatus({ kind: 'loading' });

    analyzeHistoricalEvidence(fen, { route: route ?? undefined, refPly: refPly ?? undefined })
      .then((result) => {
        setStatus({ kind: 'ready', result });
        setRanFor(fen);
      })
      .catch(() => {
        setStatus({ kind: 'error', code: 'unknown' });
      });
  }, [fen, route, refPly]);

  const stale = status.kind === 'ready' && ranFor !== fen;
  const disabled = fen === null || status.kind === 'loading' || !canAnalyze;
  const [addingGid, setAddingGid] = useState<number | null>(null);
  const [addFailed, setAddFailed] = useState(false);
  /** Corpus games already added to the room this session (gid → added). */
  const [addedGames, setAddedGames] = useState<ReadonlySet<number>>(new Set());
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

  // Fetch the corpus game and hand it to the room as another game.
  const addGame = useCallback(
    async (gid: number, ply: number) => {
      setAddingGid(gid);
      setAddFailed(false);
      try {
        const { tree } = await fetchHistoricalGame(gid);
        setAddedGames((previous) => new Set(previous).add(gid));
        onAddGame?.(tree, ply);
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
          {t('evidence.examples', { count: status.result.candidates.length })} ·{' '}
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
        <p className="m-0 text-note text-faint">…</p>
      ) : status.kind === 'error' ? (
        <p className="m-0 text-note text-danger">
          {status.code === 'invalid_fen' ? t('evidence.invalidFen') : t('evidence.error')}
        </p>
      ) : status.kind === 'idle' || stale ? (
        <p className="m-0 text-note text-faint">
          {stale ? t('evidence.positionChanged') : t('evidence.empty')}
        </p>
      ) : status.result.candidates.length === 0 ? (
        <p className="m-0 text-note text-faint">{t('evidence.noCandidates')}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {status.result.candidates.map((candidate) => (
            <HistoricalEvidenceCard
              key={candidate.id}
              candidate={candidate}
              plans={plans}
              adding={addingGid === candidate.gid}
              addedToRoom={addedGames.has(candidate.gid)}
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
