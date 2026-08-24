import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import HistoricalEvidenceCard from '@/features/historicalEvidence/HistoricalEvidenceCard';
import type { HistoricalEvidenceResult } from '@/features/historicalEvidence/types';
import { analyzeHistoricalEvidence } from '@/lib/api';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: HistoricalEvidenceResult }
  | { kind: 'error'; code: string };

/**
 * The Analyze interaction (design brief §20): one button, then evidence
 * cards. The parent supplies the board cursor's FEN and the SAN route that
 * reached it, so the analysis carries the user's own move order.
 */
export default function HistoricalEvidencePanel({
  fen,
  route,
  refPly,
}: {
  /** The board cursor's position (null when no game). */
  fen: string | null;
  /** The SAN path from the game start to the position (null when unknown). */
  route: string[] | null;
  /** The position's ply in the game. */
  refPly: number | null;
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

  // Re-analyze when the cursor moved to a different position (after a
  // successful run). Errors stay visible until the user retries.
  useEffect(() => {
    if (fen !== null && status.kind === 'ready' && ranFor !== fen) {
      run();
    }
  }, [fen, ranFor, run, status.kind]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2" data-testid="historical-evidence-panel">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-control bg-gold px-3 py-1.5 text-ui font-semibold text-surface-hi transition-colors not-disabled:hover:bg-gold-hi disabled:opacity-50"
          disabled={fen === null || status.kind === 'loading'}
          onClick={run}
          data-testid="historical-evidence-run"
        >
          {t('evidence.run')}
        </button>
        {status.kind === 'ready' && (
          <span className="text-note text-faint tabular-nums">
            {t('evidence.examples', { count: status.result.candidates.length })} ·{' '}
            {status.result.timings.total_ms} ms
          </span>
        )}
      </div>

      {fen === null ? (
        <p className="m-0 text-note text-faint">{t('analysis.noGame')}</p>
      ) : status.kind === 'idle' ? (
        <p className="m-0 text-note text-faint">{t('evidence.empty')}</p>
      ) : status.kind === 'loading' ? (
        <p className="m-0 text-note text-faint">…</p>
      ) : status.kind === 'error' ? (
        <p className="m-0 text-note text-danger">
          {status.code === 'invalid_fen' ? t('evidence.invalidFen') : t('evidence.error')}
        </p>
      ) : status.result.candidates.length === 0 ? (
        <p className="m-0 text-note text-faint">{t('evidence.noCandidates')}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {status.result.candidates.map((candidate) => (
            <HistoricalEvidenceCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      )}
    </div>
  );
}
