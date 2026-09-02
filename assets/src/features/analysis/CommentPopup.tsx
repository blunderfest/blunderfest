import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, textarea } from '@/components/ui';
import { QUALITY_NAGS } from '@/features/analysis/nags';
import { useScrollLock } from '@/lib/useScrollLock';

/**
 * The per-move annotation editor, as a small modal: the note plus the
 * quality glyphs (!, ?, ...). Opened from the board controls or the `c`
 * key; Esc or a backdrop click closes it, ⌘↵ saves.
 */
export default function CommentPopup({
  comment,
  nags = [],
  moveLabel,
  onSave,
  onClose,
}: {
  comment: string | null;
  /** The move's current NAG codes (at most one quality glyph is kept). */
  nags?: number[];
  moveLabel: string | null;
  onSave: (text: string, nags: number[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  useScrollLock();
  const [draft, setDraft] = useState(comment ?? '');
  const [selectedNag, setSelectedNag] = useState<number | null>(
    nags.find((code) => QUALITY_NAGS.some((nag) => nag.code === code)) ?? null,
  );
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dirty = draft !== (comment ?? '');

  function save() {
    onSave(draft.trim(), selectedNag === null ? [] : [selectedNag]);
    onClose();
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close; Esc closes too
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes too (see the keydown listener above)
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/75 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('analysis.commentTitle')}
        className="mt-24 w-full max-w-md animate-pop rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="m-0 text-lead font-semibold">{t('analysis.commentTitle')}</h2>
          {moveLabel !== null && (
            <span className="text-ui text-accent tabular-nums">{moveLabel}</span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <fieldset className="m-0 flex items-center gap-1 border-none p-0">
            <legend className="sr-only">{t('analysis.nagGroup')}</legend>
            {QUALITY_NAGS.map((nag) => (
              <button
                key={nag.code}
                type="button"
                aria-pressed={selectedNag === nag.code}
                aria-label={t('analysis.nagLabel', { glyph: nag.glyph })}
                title={t('analysis.nagLabel', { glyph: nag.glyph })}
                data-testid={`nag-${nag.code}`}
                className={`min-w-9 rounded-control border px-2 py-1 text-ui font-bold transition-colors ${
                  selectedNag === nag.code
                    ? 'border-accent/60 bg-accent-muted text-accent'
                    : 'border-line text-muted hover:border-line-strong hover:text-ink'
                }`}
                onClick={() =>
                  setSelectedNag((current) => (current === nag.code ? null : nag.code))
                }
              >
                {nag.glyph}
              </button>
            ))}
          </fieldset>
          <textarea
            ref={inputRef}
            value={draft}
            data-testid="comment-editor"
            aria-label={t('analysis.commentPlaceholder')}
            placeholder={t('analysis.commentPlaceholder')}
            rows={4}
            className={textarea()}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                save();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-note text-faint" role="status">
              {dirty ? t('analysis.unsaved') : comment !== null && t('analysis.savedForEveryone')}
            </span>
            <div className="flex gap-2">
              {(comment !== null || dirty) && (
                <button
                  type="button"
                  data-testid="clear-comment"
                  className={button({ intent: 'quiet', size: 'sm' })}
                  onClick={() => {
                    setDraft('');
                    onSave('', selectedNag === null ? [] : [selectedNag]);
                    onClose();
                  }}
                >
                  {t('analysis.clearComment')}
                </button>
              )}
              <button
                type="button"
                data-testid="save-comment"
                className={button({ intent: 'primary', size: 'sm' })}
                onClick={save}
              >
                {t('analysis.saveComment')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
