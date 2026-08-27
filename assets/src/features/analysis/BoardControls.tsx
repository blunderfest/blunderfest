import { useTranslation } from 'react-i18next';
import { DRAW_COLORS } from '@/components/board';
import { button } from '@/components/ui';

/**
 * The board's action cluster, riding the toolbar next to the move
 * navigation: flip, comment, edit position, the drawing colors, clear
 * drawings — all direct icon buttons, nothing behind a menu (a menu's
 * backdrop swallows the next board gesture, and the color picker is too
 * frequent to hide).
 *
 * Hidden while the position editor owns the board — the edit toolbar's
 * Done/Cancel cover the exits.
 */
export default function BoardControls({
  flipped,
  onFlip,
  onOpenComment,
  onToggleEdit,
  onFindExamples,
  drawColorPicker,
  clearDrawings,
}: {
  flipped: boolean;
  onFlip: () => void;
  onOpenComment?: () => void;
  onToggleEdit?: () => void;
  /** Opens the historical-examples browser for the cursor position (editors). */
  onFindExamples?: () => void;
  /** When set (editors only), the drawing-color picker is shown. */
  drawColorPicker?: { current: string; onChange: (color: string) => void };
  /** When set (editors only), a clear-all-drawings button is shown. */
  clearDrawings?: { disabled: boolean; onClear: () => void };
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
      <button
        type="button"
        id="analysis-flip-button"
        className={button({ intent: 'ghost', size: 'icon' })}
        aria-label={t('analysis.flip')}
        title={t('analysis.flip')}
        aria-pressed={flipped}
        aria-keyshortcuts="f"
        onClick={onFlip}
      >
        ⇅
      </button>
      {onOpenComment !== undefined && (
        <button
          type="button"
          id="analysis-comment-button"
          className={button({ intent: 'ghost', size: 'icon' })}
          aria-label={t('analysis.commentTitle')}
          title={t('analysis.commentTitle')}
          aria-keyshortcuts="c"
          onClick={onOpenComment}
        >
          💬
        </button>
      )}
      {onFindExamples !== undefined && (
        <button
          type="button"
          id="find-examples-button"
          data-testid="find-examples-button"
          className={button({ intent: 'ghost', size: 'icon' })}
          aria-label={t('evidence.run')}
          title={t('evidence.run')}
          onClick={onFindExamples}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </button>
      )}
      {onToggleEdit !== undefined && (
        <button
          type="button"
          id="analysis-edit-button"
          className={button({ intent: 'ghost', size: 'icon' })}
          aria-label={t('analysis.editPosition')}
          title={t('analysis.editPosition')}
          onClick={onToggleEdit}
        >
          ✎
        </button>
      )}
      {drawColorPicker !== undefined && (
        <fieldset
          className="m-0 flex min-w-0 items-center gap-1.5 border-none p-0"
          data-testid="draw-color-picker"
        >
          <legend className="sr-only">{t('analysis.drawColor')}</legend>
          {DRAW_COLORS.map((color, index) => (
            <button
              key={color}
              type="button"
              aria-pressed={drawColorPicker.current === color}
              aria-label={t(`analysis.colors.${index}`)}
              title={t(`analysis.colors.${index}`)}
              className={`h-5 w-5 rounded-full transition-transform ${
                drawColorPicker.current === color
                  ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => drawColorPicker.onChange(color)}
            />
          ))}
        </fieldset>
      )}
      {clearDrawings !== undefined && (
        <button
          type="button"
          data-testid="clear-drawings-button"
          className={button({ intent: 'ghost', size: 'icon' })}
          aria-label={t('analysis.clearDrawings')}
          title={t('analysis.clearDrawings')}
          disabled={clearDrawings.disabled}
          onClick={clearDrawings.onClear}
        >
          ⌫
        </button>
      )}
    </div>
  );
}
