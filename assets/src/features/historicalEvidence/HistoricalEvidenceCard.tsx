import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { EvidenceCandidate } from '@/features/historicalEvidence/types';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h4 className="m-0 text-micro font-semibold uppercase tracking-[0.11em] text-muted">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-note text-muted">{label}</span>
      <span className="text-right text-note text-ink tabular-nums">{value}</span>
    </div>
  );
}

function dimsText(dims: EvidenceCandidate['position']['dims']): ReactNode {
  const lines: ReactNode[] = [];
  lines.push(
    <Fact
      key="pawn"
      label="Pawn structure"
      value={dims.pawn_structure === 'same' ? 'same' : `differs (${dims.pawn_structure[1]})`}
    />,
  );
  lines.push(
    <Fact
      key="material"
      label="Material"
      value={dims.material === 'same' ? 'same' : `differs (${dims.material[1]})`}
    />,
  );
  lines.push(
    <Fact
      key="pieces"
      label="Piece placement"
      value={`${dims.piece_placement.matches}/${dims.piece_placement.ref_pieces} match`}
    />,
  );
  lines.push(
    <Fact
      key="stm"
      label="Side to move"
      value={dims.side_to_move === 'same' ? 'same' : 'differs'}
    />,
  );
  lines.push(
    <Fact key="castling" label="Castling" value={dims.castling === 'same' ? 'same' : 'differs'} />,
  );
  return <div className="flex flex-col">{lines}</div>;
}

function sideText(side: EvidenceCandidate['families']['skeleton']['white']): string {
  if (side.status === 'member') {
    return `plan ${side.family_id} · ${Math.round((side.sim ?? 0) * 100)}% match`;
  }
  if (side.sim !== null) {
    return `no match (nearest plan ${side.family_id})`;
  }
  return '—';
}

/**
 * One historical example (design brief §15): position, route, continuation
 * families and counts — evidence only, no relevance score.
 */
export default function HistoricalEvidenceCard({ candidate }: { candidate: EvidenceCandidate }) {
  const { t } = useTranslation();
  const fam = candidate.families;

  return (
    <article
      className="flex flex-col gap-2 rounded-control border border-line bg-surface/50 p-2.5"
      data-testid="historical-evidence-card"
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="truncate text-ui font-semibold text-ink">
          {candidate.game.white} — {candidate.game.black}
        </span>
        <span className="shrink-0 text-micro text-muted tabular-nums">
          {candidate.game.eco} · {candidate.game.result}
        </span>
      </header>

      <Section title={t('evidence.position')}>{dimsText(candidate.position.dims)}</Section>

      {candidate.route.shared_plies > 0 && (
        <Section title={t('evidence.route')}>
          <Fact label={t('evidence.routeShared')} value={`${candidate.route.shared_plies} plies`} />
          {candidate.route.diverged_ply !== null && candidate.route.ref_move !== null && (
            <Fact
              label={t('evidence.routeDivergence')}
              value={`ply ${candidate.route.diverged_ply}: ${candidate.route.ref_move} → ${candidate.route.cand_move}`}
            />
          )}
          {candidate.route.ply_gap !== 0 && (
            <Fact
              label={t('evidence.routePlyGap')}
              value={
                candidate.route.ply_gap > 0
                  ? `+${candidate.route.ply_gap}`
                  : String(candidate.route.ply_gap)
              }
            />
          )}
        </Section>
      )}

      <Section title={t('evidence.continuation')}>
        <Fact
          label={t('evidence.contMoves')}
          value={candidate.continuation.moves.join(' ') || '—'}
        />
        <Fact label={t('evidence.familyWhite')} value={sideText(fam.skeleton.white)} />
        <Fact label={t('evidence.familyBlack')} value={sideText(fam.skeleton.black)} />
      </Section>

      <Section title={t('evidence.historical')}>
        <Fact label={t('evidence.occurrences')} value={candidate.historical.occurrences} />
        <Fact label={t('evidence.games')} value={candidate.historical.games} />
        {candidate.historical.same_game_only && (
          <Fact label={t('evidence.sameGame')} value={t('evidence.sameGameOnly')} />
        )}
      </Section>

      {candidate.flags.length > 0 && (
        <footer className="flex flex-wrap gap-1">
          {candidate.flags.map((flag) => (
            <span key={flag} className="rounded-full bg-raised px-2 py-0.5 text-micro text-muted">
              {flag.replaceAll('_', ' ')}
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}
