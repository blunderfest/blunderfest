import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { panel, panelHeader } from '@/components/ui';
import type { Op, PresenceMember } from '@/protocol/ops';

function opLabel(t: TFunction, op: Op): string {
  switch (op.type) {
    case 'set_game':
      return t('room.game');
    case 'move_at_ply':
      return t('room.move', { ply: op.payload.ply, san: op.payload.san });
    case 'comment_at_ply':
      return t('room.comment', { ply: op.payload.ply, text: op.payload.text });
    case 'replace_line':
      return t('room.line', { ply: op.payload.ply });
    case 'set_annotations':
      return t('room.annotate');
    case 'set_position':
      return t('room.setup');
    default:
      return '';
  }
}

function opIcon(op: Op): string {
  switch (op.type) {
    case 'set_game':
      return '📥';
    case 'move_at_ply':
      return '♟';
    case 'comment_at_ply':
      return '💬';
    case 'set_position':
      return '⚙';
    case 'set_annotations':
      return '✏️';
    default:
      return '•';
  }
}

export default function ActivityFeed({
  ops,
  presence,
  names,
}: {
  ops: Op[];
  presence: Record<string, PresenceMember>;
  names: Record<string, string>;
}) {
  const { t } = useTranslation();

  /**
   * Ops replayed on join are not "arrivals" — only ops with a seq beyond
   * the join replay get the arrive flash. The baseline is captured once, on
   * mount, via a lazy initializer: pure render, so it behaves under
   * StrictMode (no ref mutation during render).
   */
  const [joinedAtSeq] = useState(() => ops.reduce((max, op) => Math.max(max, op.seq), 0));

  return (
    <section
      className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-col xl:flex-1`}
    >
      <div className={panelHeader()}>
        <h2 className="m-0">{t('room.activity')}</h2>
      </div>
      {ops.length === 0 ? (
        <p className="m-0 p-3 text-ui text-faint">{t('room.emptyActivity')}</p>
      ) : (
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <ul className="m-0 flex flex-col gap-0.5 p-2">
            {[...ops].reverse().map((op) => {
              const arrived = op.seq > joinedAtSeq;
              return (
                <li
                  key={op.seq}
                  className={`flex items-baseline gap-2 rounded-control px-2 py-1 text-note hover:bg-raised ${
                    arrived ? 'animate-arrive' : ''
                  }`}
                >
                  <span aria-hidden="true">{opIcon(op)}</span>
                  <span className="min-w-0 flex-1 text-muted">{opLabel(t, op)}</span>
                  <span className="shrink-0 text-info">
                    {presence[op.author]?.name ?? names[op.author] ?? op.author}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
