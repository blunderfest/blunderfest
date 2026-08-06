import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
import type { GameTree } from '@/lib/api';

export default function GameInfo({ tree }: { tree: GameTree }) {
  const { t } = useTranslation();

  return (
    <section className={panel({ width: 'lg' })}>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {tree.headers.Event && (
          <>
            <dt className="m-0 text-muted">{t('import.event')}</dt>
            <dd className="m-0 text-ink">{tree.headers.Event}</dd>
          </>
        )}
        {tree.headers.Date && (
          <>
            <dt className="m-0 text-muted">{t('import.date')}</dt>
            <dd className="m-0 text-ink">{tree.headers.Date}</dd>
          </>
        )}
        <dt className="m-0 text-muted">{t('import.plies')}</dt>
        <dd className="m-0 text-ink">{tree.mainline_ply_count}</dd>
        <dt className="m-0 text-muted">{t('import.variations')}</dt>
        <dd className="m-0 text-ink">{tree.node_count}</dd>
      </dl>
    </section>
  );
}
