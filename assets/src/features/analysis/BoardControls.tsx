import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

export default function BoardControls({
  targets,
  flipped,
  presenterActive,
  amPresenter,
  following,
  onNavigate,
  onFlip,
  onFollowChange,
}: {
  targets: { first: number; prev: number | null; next: number | null; last: number | null };
  flipped: boolean;
  presenterActive: boolean;
  amPresenter: boolean;
  following: boolean;
  onNavigate: (id: number) => void;
  onFlip: () => void;
  onFollowChange: (following: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        id="analysis-first-button"
        className={button({ variant: 'ghost', size: 'sm', disabled: 'faint' })}
        aria-keyshortcuts="Home"
        onClick={() => onNavigate(targets.first)}
      >
        ⏮ {t('analysis.first')}
      </button>
      <button
        type="button"
        id="analysis-prev-button"
        className={button({ variant: 'ghost', size: 'sm', disabled: 'faint' })}
        disabled={targets.prev === null}
        aria-keyshortcuts="ArrowLeft"
        onClick={() => targets.prev !== null && onNavigate(targets.prev)}
      >
        ◀ {t('analysis.prev')}
      </button>
      <button
        type="button"
        id="analysis-next-button"
        className={button({ variant: 'ghost', size: 'sm', disabled: 'faint' })}
        disabled={targets.next === null}
        aria-keyshortcuts="ArrowRight"
        onClick={() => targets.next !== null && onNavigate(targets.next)}
      >
        {t('analysis.next')} ▶
      </button>
      <button
        type="button"
        id="analysis-last-button"
        className={button({ variant: 'ghost', size: 'sm', disabled: 'faint' })}
        disabled={targets.last === null}
        aria-keyshortcuts="End"
        onClick={() => targets.last !== null && onNavigate(targets.last)}
      >
        {t('analysis.last')} ⏭
      </button>
      <button
        type="button"
        id="analysis-flip-button"
        className={button({ variant: 'ghost', size: 'sm', disabled: 'faint' })}
        aria-pressed={flipped}
        aria-keyshortcuts="f"
        onClick={onFlip}
      >
        {t('analysis.flip')}
      </button>
      {presenterActive && !amPresenter && (
        <button
          type="button"
          id="analysis-follow-button"
          className={button({ variant: 'ghost', size: 'sm', disabled: 'faint' })}
          aria-pressed={following}
          onClick={() => onFollowChange(!following)}
        >
          {following ? t('analysis.following') : t('analysis.follow')}
        </button>
      )}
      {amPresenter && (
        <p className="m-0 text-xs text-muted" role="status">
          {t('analysis.presenting')}
        </p>
      )}
    </div>
  );
}
