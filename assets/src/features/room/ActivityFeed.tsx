import type { TFunction } from 'i18next';
import { useRef } from 'react';
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
    case 'add_arrow':
      return t('room.arrow', { ply: op.payload.ply });
    case 'add_highlight':
      return t('room.highlight', { ply: op.payload.ply });
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
    default:
      return '•';
  }
}

export default function ActivityFeed({
  ops,
  presence,
}: {
  ops: Op[];
  presence: Record<string, PresenceMember>;
}) {
  const { t } = useTranslation();

  /**
   * Ops replayed on join are not "arrivals" — only ops seen for the first
   * time after mount get the arrive flash. The set is marked at render time,
   * so the class survives re-renders until the animation completes.
   */
  const seenRef = useRef<Set<number> | null>(null);
  if (seenRef.current === null) {
    seenRef.current = new Set(ops.map((op) => op.seq));
  }
  const seen = seenRef.current;

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
              const arrived = !seen.has(op.seq);
              if (arrived) {
                seen.add(op.seq);
              }
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
                    {presence[op.author]?.name ?? op.author}
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
