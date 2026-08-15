import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
import type { GameTree } from '@/lib/api';

/**
 * The viewed game's metadata. The actions (Export PGN, Save to library)
 * live on the Moves tab — see GameActions.
 */
export default function GameInfo({ tree }: { tree: GameTree }) {
  const { t } = useTranslation();

  return (
    <section className={panel({ layout: 'none', pad: 'none' })}>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-1 p-3 text-ui">
        {tree.headers.Event && (
          <>
            <dt className="m-0 text-faint">{t('import.event')}</dt>
            <dd className="m-0 text-ink">{tree.headers.Event}</dd>
          </>
        )}
        {tree.headers.Date && (
          <>
            <dt className="m-0 text-faint">{t('import.date')}</dt>
            <dd className="m-0 text-ink">{tree.headers.Date}</dd>
          </>
        )}
        <dt className="m-0 text-faint">{t('import.result')}</dt>
        <dd className="m-0 text-ink">{tree.result}</dd>
        <dt className="m-0 text-faint">{t('import.plies')}</dt>
        <dd className="m-0 text-ink tabular-nums">{tree.mainline_ply_count}</dd>
        <dt className="m-0 text-faint">{t('import.variations')}</dt>
        <dd className="m-0 text-ink tabular-nums">{tree.node_count}</dd>
      </dl>
    </section>
  );
}
