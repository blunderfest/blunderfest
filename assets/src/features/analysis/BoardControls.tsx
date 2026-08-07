import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

/**
 * Board-level actions shown under the board: flip, follow/present state,
 * comment, position editing, engine toggle. Move navigation lives in the
 * move list footer.
 */
export default function BoardControls({
  flipped,
  presenterActive,
  amPresenter,
  following,
  onFlip,
  onFollowChange,
  onOpenComment,
  onToggleEdit,
  editing = false,
  engineOn,
  onToggleEngine,
}: {
  flipped: boolean;
  presenterActive: boolean;
  amPresenter: boolean;
  following: boolean;
  onFlip: () => void;
  onFollowChange: (following: boolean) => void;
  onOpenComment?: () => void;
  onToggleEdit?: () => void;
  editing?: boolean;
  engineOn?: boolean;
  onToggleEngine?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
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
      {onToggleEdit !== undefined && (
        <button
          type="button"
          id="analysis-edit-button"
          className={button({ intent: 'ghost', size: 'sm', active: editing })}
          aria-label={t('analysis.editPosition')}
          aria-pressed={editing}
          onClick={onToggleEdit}
        >
          ✎ {t('analysis.editPosition')}
        </button>
      )}
      {onToggleEngine !== undefined && (
        <button
          type="button"
          id="analysis-engine-button"
          className={button({ intent: 'ghost', size: 'sm', active: engineOn })}
          aria-label={t('analysis.engineToggle')}
          aria-pressed={engineOn}
          onClick={onToggleEngine}
        >
          ♟ {t('analysis.engineToggle')}
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
