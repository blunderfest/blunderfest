import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DRAW_COLORS } from '@/components/board';
import { button } from '@/components/ui';

const menuItem =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-ui text-ink transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * The board's action cluster, riding the toolbar next to the move
 * navigation: flip and comment as icon buttons, the rarer tools (position
 * editing, drawing colors, clearing drawings) in an overflow menu. One row
 * of chrome under the board instead of two (ADR-0031).
 *
 * Hidden while the position editor owns the board — the edit toolbar's
 * Done/Cancel cover the exits.
 */
export default function BoardControls({
  flipped,
  onFlip,
  onOpenComment,
  onToggleEdit,
  drawColorPicker,
  clearDrawings,
}: {
  flipped: boolean;
  onFlip: () => void;
  onOpenComment?: () => void;
  onToggleEdit?: () => void;
  /** When set (editors only), a drawing-color picker lives in the menu. */
  drawColorPicker?: { current: string; onChange: (color: string) => void };
  /** When set (editors only), a clear-all-drawings item lives in the menu. */
  clearDrawings?: { disabled: boolean; onClear: () => void };
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex items-center gap-1">
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
      {(onToggleEdit !== undefined ||
        drawColorPicker !== undefined ||
        clearDrawings !== undefined) && (
        <div className="relative">
          <button
            type="button"
            id="board-menu-button"
            className={button({ intent: 'ghost', size: 'icon' })}
            aria-label={t('analysis.boardMenu')}
            title={t('analysis.boardMenu')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              {/* Click-to-close backdrop (Esc closes the menu too). */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <div
                role="menu"
                aria-label={t('analysis.boardMenu')}
                className="absolute top-full right-0 z-50 mt-1 w-56 rounded-control border border-line-strong bg-overlay p-1 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]"
              >
                {onToggleEdit !== undefined && (
                  <button
                    type="button"
                    role="menuitem"
                    id="analysis-edit-button"
                    className={menuItem}
                    aria-label={t('analysis.editPosition')}
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleEdit();
                    }}
                  >
                    <span aria-hidden="true">✎</span> {t('analysis.editPosition')}
                  </button>
                )}
                {drawColorPicker !== undefined && (
                  <fieldset
                    className="m-0 flex items-center justify-between gap-2 border-none px-2.5 py-1.5"
                    data-testid="draw-color-picker"
                  >
                    <legend className="sr-only">{t('analysis.drawColor')}</legend>
                    <span className="text-ui text-muted" aria-hidden="true">
                      {t('analysis.drawColor')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {DRAW_COLORS.map((color, index) => (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={drawColorPicker.current === color}
                          aria-label={t(`analysis.colors.${index}`)}
                          className={`h-5 w-5 rounded-full transition-transform ${
                            drawColorPicker.current === color
                              ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-overlay'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => drawColorPicker.onChange(color)}
                        />
                      ))}
                    </span>
                  </fieldset>
                )}
                {clearDrawings !== undefined && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="clear-drawings-button"
                    className={menuItem}
                    aria-label={t('analysis.clearDrawings')}
                    disabled={clearDrawings.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      clearDrawings.onClear();
                    }}
                  >
                    <span aria-hidden="true">⌫</span> {t('analysis.clearDrawings')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
