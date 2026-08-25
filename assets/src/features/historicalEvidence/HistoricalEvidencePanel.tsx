import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HelpPopover from '@/components/HelpPopover';
import { button } from '@/components/ui';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type { HistoricalEvidenceResult, PlanSide } from '@/features/historicalEvidence/types';
import {
  analyzeHistoricalEvidence,
  createRoom,
  fetchHistoricalGame,
  withDeviceRetry,
} from '@/lib/api';
import { generateRoomCode } from '@/lib/roomCode';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: HistoricalEvidenceResult }
  | { kind: 'error'; code: string };

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
}: {
  /** The board cursor's position (null when no game). */
  fen: string | null;
  /** The SAN path from the game start to the position (null when unknown). */
  route: string[] | null;
  /** The position's ply in the game. */
  refPly: number | null;
  /** Editors only (the demo room and viewers are read-only). */
  canAnalyze?: boolean;
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
  const [openingGid, setOpeningGid] = useState<number | null>(null);
  const [openFailed, setOpenFailed] = useState(false);

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

  // Open the full corpus game in a fresh room (the library flow): fetch
  // the tree, seed a room with it, and jump there.
  const openGame = useCallback(async (gid: number) => {
    setOpeningGid(gid);
    setOpenFailed(false);
    try {
      const { tree } = await fetchHistoricalGame(gid);
      const slug = generateRoomCode();
      await withDeviceRetry((device) => createRoom(slug, tree, device));
      window.location.hash = `#/r/${slug}`;
    } catch {
      setOpeningGid(null);
      setOpenFailed(true);
    }
  }, []);

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
      {openFailed && (
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
              opening={openingGid === candidate.gid}
              onOpenGame={() => openGame(candidate.gid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
