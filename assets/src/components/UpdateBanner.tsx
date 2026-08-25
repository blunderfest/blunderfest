import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

/**
 * The deploy banner: shown when the version beacon reports a new build.
 * Reload picks up the new bundle immediately.
 */
export default function UpdateBanner({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-40 flex max-w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-3 rounded-panel border border-line-strong bg-panel px-4 py-2.5 shadow-panel"
    >
      <span className="text-note text-ink">{t('update.available')}</span>
      <button
        type="button"
        className={button({ intent: 'primary', size: 'xs' })}
        onClick={onReload}
      >
        {t('update.reload')}
      </button>
    </div>
  );
}
