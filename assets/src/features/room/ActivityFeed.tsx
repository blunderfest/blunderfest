import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
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
    default:
      return '';
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

  return (
    <section className={panel({ layout: 'none', padding: 'tight' })}>
      <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.activity')}</h2>
      {ops.length === 0 ? (
        <p className="m-0 text-sm text-muted">{t('room.emptyActivity')}</p>
      ) : (
        <ul className="m-0 flex max-h-96 flex-col gap-1 overflow-y-auto p-0">
          {ops.map((op) => (
            <li
              key={op.seq}
              className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1 text-sm hover:bg-white/5"
            >
              <span>
                <span className="text-muted">#{op.seq} </span>
                {opLabel(t, op)}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {presence[op.author]?.name ?? op.author}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
