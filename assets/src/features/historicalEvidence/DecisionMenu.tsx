import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NextMoveRow } from '@/features/historicalEvidence/types';

/** How many moves show before the "Show N more" toggle. */
const COLLAPSE_AT = 6;

/**
 * The historical decision menu (product experiment 01): the position's
 * next-move distribution with **independent-game** counts, shown before the
 * example carousel. Purely informational — no interactivity, no eval-like
 * markers; each row is "move @count games" sorted by count desc, tie-broken
 * by move name (the backend's stable order). Renders nothing when the
 * response carries no moves.
 */
export default function DecisionMenu({
  fen,
  nextMoves,
}: {
  fen: string;
  /** The backend's additive `next_moves` field; optional for older cached shapes. */
  nextMoves?: NextMoveRow[] | null;
}) {
  const { t } = useTranslation();
  // Side to move from the reference FEN's stm field — never hard-coded.
  const side = fen.split(' ')[1] === 'b' ? 'black' : 'white';
  // Tolerate a response without the additive `next_moves` field (an older
  // cached entry from before the experiment): treat as empty, render nothing.
  const moves = nextMoves ?? [];
  const initial = moves.slice(0, COLLAPSE_AT);
  const rest = moves.slice(COLLAPSE_AT);
  const [expanded, setExpanded] = useState(false);

  if (moves.length === 0) {
    return null;
  }

  return (
    <section
      className="flex shrink-0 flex-col items-center gap-1 border-b border-line pb-3 text-center"
      data-testid="evidence-decision-menu"
    >
      <h4 className="m-0 text-note font-semibold text-ink">
        {t(`evidence.menuWhat`, { side: t(`evidence.menuSide.${side}`) })}
      </h4>
      <ul className="m-0 flex w-full max-w-xs list-none flex-col gap-0.5 p-0 text-note">
        {initial.map((row) => (
          <li
            key={row.move}
            className="flex items-baseline justify-between gap-3 text-left text-ink"
            data-testid="evidence-menu-row"
          >
            <span className="font-mono text-ink">{row.move}</span>
            <span className="text-muted">
              {t(`evidence.menuGame${row.games === 1 ? '' : 's'}`, { count: row.games })}
            </span>
          </li>
        ))}
        {expanded &&
          rest.map((row) => (
            <li
              key={row.move}
              className="flex items-baseline justify-between gap-3 text-left text-ink"
              data-testid="evidence-menu-row"
            >
              <span className="font-mono text-ink">{row.move}</span>
              <span className="text-muted">
                {t(`evidence.menuGame${row.games === 1 ? '' : 's'}`, { count: row.games })}
              </span>
            </li>
          ))}
      </ul>
      {rest.length > 0 && !expanded ? (
        <button
          type="button"
          className="m-0 text-note text-muted underline-offset-2 hover:underline"
          onClick={() => setExpanded(true)}
          data-testid="evidence-menu-toggle"
        >
          {t('evidence.menuShowMore', { count: rest.length })}
        </button>
      ) : null}
    </section>
  );
}
