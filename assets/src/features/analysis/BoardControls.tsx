import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

export default function BoardControls({
  targets,
  currentPly,
  totalPly,
  flipped,
  presenterActive,
  amPresenter,
  following,
  onNavigate,
  onFlip,
  onFollowChange,
  onOpenComment,
}: {
  targets: { first: number; prev: number | null; next: number | null; last: number | null };
  currentPly: number;
  totalPly: number;
  flipped: boolean;
  presenterActive: boolean;
  amPresenter: boolean;
  following: boolean;
  onNavigate: (id: number) => void;
  onFlip: () => void;
  onFollowChange: (following: boolean) => void;
  onOpenComment?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          id="analysis-first-button"
          className={button({ intent: 'secondary', size: 'icon' })}
          aria-label={t('analysis.first')}
          aria-keyshortcuts="Home"
          onClick={() => onNavigate(targets.first)}
        >
          ⏮
        </button>
        <button
          type="button"
          id="analysis-prev-button"
          className={button({ intent: 'secondary', size: 'icon' })}
          disabled={targets.prev === null}
          aria-label={t('analysis.prev')}
          aria-keyshortcuts="ArrowLeft"
          onClick={() => targets.prev !== null && onNavigate(targets.prev)}
        >
          ◀
        </button>
        <span className="px-2 text-ui text-muted tabular-nums" data-testid="ply-counter">
          {t('analysis.position', { ply: currentPly, total: totalPly })}
        </span>
        <button
          type="button"
          id="analysis-next-button"
          className={button({ intent: 'secondary', size: 'icon' })}
          disabled={targets.next === null}
          aria-label={t('analysis.next')}
          aria-keyshortcuts="ArrowRight"
          onClick={() => targets.next !== null && onNavigate(targets.next)}
        >
          ▶
        </button>
        <button
          type="button"
          id="analysis-last-button"
          className={button({ intent: 'secondary', size: 'icon' })}
          disabled={targets.last === null}
          aria-label={t('analysis.last')}
          aria-keyshortcuts="End"
          onClick={() => targets.last !== null && onNavigate(targets.last)}
        >
          ⏭
        </button>
      </div>
      <button
        type="button"
        id="analysis-flip-button"
        className={button({ intent: 'ghost', size: 'sm' })}
        aria-label={t('analysis.flip')}
        aria-pressed={flipped}
        aria-keyshortcuts="f"
        onClick={onFlip}
      >
        ⇅ {t('analysis.flip')}
      </button>
      {presenterActive && !amPresenter && (
        <button
          type="button"
          id="analysis-follow-button"
          className={button({ intent: 'ghost', size: 'sm', active: following })}
          aria-label={following ? t('analysis.following') : t('analysis.follow')}
          aria-pressed={following}
          onClick={() => onFollowChange(!following)}
        >
          {following ? `⇢ ${t('analysis.following')}` : t('analysis.follow')}
        </button>
      )}
      {onOpenComment !== undefined && (
        <button
          type="button"
          id="analysis-comment-button"
          className={button({ intent: 'ghost', size: 'sm' })}
          aria-label={t('analysis.commentTitle')}
          aria-keyshortcuts="c"
          onClick={onOpenComment}
        >
          💬 {t('analysis.commentTitle')}
        </button>
      )}
      {amPresenter && (
        <p className="m-0 text-note text-muted" role="status">
          ◉ {t('analysis.presenting')}
        </p>
      )}
    </div>
  );
}
