import { useTranslation } from 'react-i18next';
import { DRAW_COLORS } from '@/components/board';
import { button } from '@/components/ui';

/**
 * Board-level actions shown under the board: flip, comment, position
 * editing, drawing tools. Move navigation lives in the move list footer;
 * the follow/present state lives in the member list.
 */
export default function BoardControls({
  flipped,
  onFlip,
  onOpenComment,
  onToggleEdit,
  editing = false,
  drawColorPicker,
  clearDrawings,
  onShowShortcuts,
}: {
  flipped: boolean;
  onFlip: () => void;
  onOpenComment?: () => void;
  onToggleEdit?: () => void;
  editing?: boolean;
  /** When set (editors only), a drawing-color picker is shown. */
  drawColorPicker?: { current: string; onChange: (color: string) => void };
  /** When set (editors only), a clear-all-drawings button is shown. */
  clearDrawings?: { disabled: boolean; onClear: () => void };
  onShowShortcuts?: () => void;
}) {
  const { t } = useTranslation();

  return (
    // Capped at the board width so label changes (e.g. the follow toggle)
    // wrap inside the row instead of stretching the whole layout. The cap
    // is a max, not the width: a vw-fixed width becomes the flex/grid
    // min-content contribution and would force the md track wider than it
    // is.
    <div className="flex w-full max-w-[min(90vw,34rem)] flex-wrap items-center justify-center gap-2">
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
      {onShowShortcuts !== undefined && (
        <button
          type="button"
          id="analysis-shortcuts-button"
          className={button({ intent: 'ghost', size: 'sm' })}
          aria-label={t('analysis.shortcuts')}
          onClick={onShowShortcuts}
        >
          ?
        </button>
      )}
    </div>
  );
}
