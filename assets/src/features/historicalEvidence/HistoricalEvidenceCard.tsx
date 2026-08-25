import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import type { EvidenceCandidate, PlanSide } from '@/features/historicalEvidence/types';

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

/**
 * The headline describes the *positional* relationship only — typed facts,
 * never a fused verdict about the game. Continuation conclusions live in
 * their own per-side lines, and raw numbers under Comparison details.
 */
function headline(candidate: EvidenceCandidate, t: TFunction): string {
  const d = candidate.position.dims;
  const placement = d.piece_placement;

  if (d.pawn_structure !== 'same') {
    return t('evidence.headlineDifferentPawns');
  }
  if (placement.matches === placement.ref_pieces && d.side_to_move === 'same') {
    return t('evidence.headlineSamePosition');
  }
  if (placement.matches === placement.ref_pieces) {
    return t('evidence.headlineTempoTwin');
  }
  if (placement.mismatches === 2 && d.side_to_move === 'same') {
    return t('evidence.headlineOnePieceDiffers');
  }
  if (placement.mismatches === 2) {
    return t('evidence.headlineOnePieceAndTempo');
  }
  if (d.material !== 'same') {
    return t('evidence.headlineMaterialDiffers');
  }
  if (d.king_position !== 'same') {
    return t('evidence.headlineKingDiffers');
  }
  return t('evidence.headlineSamePawns');
}

/**
 * The candidate's own continuation, split per side (the side to move at
 * the position plays first). Shows what was played — not an
 * interpretation of it.
 */
function bySide(moves: string[], stm: 'w' | 'b'): { white: string[]; black: string[] } {
  const white: string[] = [];
  const black: string[] = [];
  moves.forEach((move, index) => {
    const mover = index % 2 === 0 ? stm : stm === 'w' ? 'b' : 'w';
    if (mover === 'w') {
      white.push(move);
    } else {
      black.push(move);
    }
  });
  return { white, black };
}

/**
 * Per-side continuation verdict — shown only when the analysis can
 * support it: a high-confidence membership in a recurring family.
 */
function sideVerdict(
  side: EvidenceCandidate['families']['skeleton']['white'],
  t: TFunction,
): string | null {
  if (side.status === 'member' && (side.sim ?? 0) >= 0.8 && (side.family_games ?? 0) >= 2) {
    if (side.family_id === 1) {
      return t('evidence.followedMostCommon');
    }
    return t('evidence.followedSameContinuation', { games: side.family_games });
  }
  if (side.status === 'none') {
    return t('evidence.followedDifferent');
  }
  return null;
}

function countText(candidate: EvidenceCandidate, t: TFunction): string {
  const { occurrences, games, same_game_only: sameGame } = candidate.historical;

  if (games === 1 && sameGame) {
    return t('evidence.oneGameRepeat', { count: occurrences });
  }
  if (games === 1) {
    return t('evidence.oneGame');
  }
  if (occurrences !== games) {
    return t('evidence.gamesAndOccurrences', { games, occurrences });
  }
  return t('evidence.nGames', { count: games });
}

/**
 * One historical example: the evidence that lets the user decide whether
 * this game is interesting — position, route, continuation, counts — with
 * the raw comparison numbers tucked behind a disclosure.
 */
export default function HistoricalEvidenceCard({
  candidate,
  plans,
  adding = false,
  onAddGame,
  onAddVariation,
}: {
  candidate: EvidenceCandidate;
  /** Plan id → per-side actions, from the reference's decision menu. */
  plans?: Map<number, PlanSide>;
  /** The add-to-room request for this card is in flight. */
  adding?: boolean;
  /** Add this historical game to the room as another game. */
  onAddGame?: () => void;
  /** Add the historical continuation as a variation (exact candidates). */
  onAddVariation?: () => void;
}) {
  const { t } = useTranslation();
  const d = candidate.position.dims;
  const fam = candidate.families;
  const route = candidate.route;
  const sides = bySide(candidate.continuation.moves, candidate.stm);

  const whiteVerdict = sideVerdict(fam.skeleton.white, t);
  const blackVerdict = sideVerdict(fam.skeleton.black, t);

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

      <p className="m-0 text-note font-semibold uppercase tracking-[0.06em] text-gold-text">
        {headline(candidate, t)}
      </p>

      <Section title={t('evidence.position')}>
        <Fact
          label={t('evidence.dimPawn')}
          value={d.pawn_structure === 'same' ? t('evidence.same') : t('evidence.different')}
        />
        <Fact
          label={t('evidence.dimMaterial')}
          value={d.material === 'same' ? t('evidence.same') : d.material[1]}
        />
        <Fact
          label={t('evidence.dimPieces')}
          value={`${d.piece_placement.matches}/${d.piece_placement.ref_pieces} ${t('evidence.match')}`}
        />
        <Fact
          label={t('evidence.dimSide')}
          value={d.side_to_move === 'same' ? t('evidence.same') : t('evidence.different')}
        />
        <Fact
          label={t('evidence.dimCastling')}
          value={d.castling === 'same' ? t('evidence.same') : t('evidence.different')}
        />
      </Section>

      {route.ref_ply !== null && (
        <Section title={t('evidence.route')}>
          {route.shared_plies > 0 ? (
            <Fact
              label={t('evidence.routeShared')}
              value={t('evidence.plies', { count: route.shared_plies })}
            />
          ) : (
            <Fact label={t('evidence.routeShared')} value={t('evidence.routeImmediate')} />
          )}
          {route.diverged_ply !== null && route.ref_move !== null && route.cand_move !== null && (
            <Fact
              label={t('evidence.routeDivergence')}
              value={t('evidence.routeDivergenceText', {
                ply: route.diverged_ply,
                side: route.diverged_ply % 2 === 1 ? t('evidence.white') : t('evidence.black'),
                ref: route.ref_move,
                cand: route.cand_move,
              })}
            />
          )}
          {route.ply_gap !== 0 && (
            <Fact
              label={t('evidence.routePlyGap')}
              value={
                route.ply_gap > 0
                  ? t('evidence.plyLater', { count: route.ply_gap })
                  : t('evidence.plyEarlier', { count: -route.ply_gap })
              }
            />
          )}
        </Section>
      )}

      <Section title={t('evidence.continuation')}>
        <div className="flex flex-col gap-0.5">
          <span className="text-note text-muted">{t('evidence.white')}</span>
          <span className="text-note text-ink tabular-nums">{sides.white.join(' · ') || '—'}</span>
          {whiteVerdict !== null && <span className="text-note text-muted">{whiteVerdict}</span>}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-note text-muted">{t('evidence.black')}</span>
          <span className="text-note text-ink tabular-nums">{sides.black.join(' · ') || '—'}</span>
          {blackVerdict !== null && <span className="text-note text-muted">{blackVerdict}</span>}
        </div>
      </Section>

      <Section title={t('evidence.historical')}>
        <p className="m-0 text-note text-ink tabular-nums">{countText(candidate, t)}</p>
      </Section>

      {(onAddGame !== undefined || onAddVariation !== undefined) && (
        <div className="flex shrink-0 justify-end gap-2">
          {onAddVariation !== undefined && (
            <button
              type="button"
              className={button({ intent: 'quiet', size: 'xs' })}
              onClick={onAddVariation}
              data-testid="historical-evidence-add-variation"
            >
              {t('evidence.addVariation')}
            </button>
          )}
          {onAddGame !== undefined && (
            <button
              type="button"
              className={button({ intent: 'quiet', size: 'xs' })}
              disabled={adding}
              onClick={onAddGame}
              data-testid="historical-evidence-add-game"
            >
              {adding ? t('evidence.adding') : t('evidence.addToRoom')}
            </button>
          )}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-micro font-semibold uppercase tracking-[0.11em] text-faint transition-colors hover:text-muted">
          ▸ {t('evidence.details')}
        </summary>
        <div className="mt-1.5 flex flex-col gap-1 border-l border-line pl-2">
          <span className="text-note text-muted">{t('evidence.detailsTyped')}</span>
          {candidate.position.differences.length > 0 ? (
            candidate.position.differences.map((diff) => (
              <span key={diff.type} className="text-note text-faint tabular-nums">
                {diff.detail}
              </span>
            ))
          ) : (
            <span className="text-note text-faint">{t('evidence.detailsNone')}</span>
          )}
          {candidate.continuation.differences.length > 0 && (
            <>
              <span className="text-note text-muted">{t('evidence.detailsContinuation')}</span>
              {candidate.continuation.differences.map((diff) => (
                <span key={diff.type} className="text-note text-faint tabular-nums">
                  {diff.detail}
                </span>
              ))}
            </>
          )}
          <span className="text-note text-muted">{t('evidence.detailsMatching')}</span>
          {(['white', 'black'] as const).map((color) => {
            const side = fam.skeleton[color];
            if (side.status === 'no_menu' || side.sim === null) {
              return null;
            }
            const plan = side.family_id !== null ? plans?.get(side.family_id) : undefined;
            const planMoves = plan?.[color] ?? [];
            const planSuffix = planMoves.length > 0 ? ` · ${planMoves.join(' · ')}` : '';
            return (
              <span key={color} className="text-note text-faint tabular-nums">
                {t('evidence.detailsMatchingLine', {
                  side: t(`evidence.${color}`),
                  id: side.family_id,
                  sim: side.sim.toFixed(2),
                })}
                {planSuffix}
              </span>
            );
          })}
        </div>
      </details>
    </article>
  );
}
