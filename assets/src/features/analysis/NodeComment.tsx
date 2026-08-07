import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, panel, panelHeader, textarea } from '@/components/ui';

/**
 * Comment on the current position. Editors get a textarea (⌘↵ saves; an
 * empty save clears the comment); viewers see the text read-only.
 *
 * Draft protection: a dirty draft is never clobbered — not by a remote save
 * and not by switching nodes. A clean editor follows the current node.
 */
export default function NodeComment({
  comment,
  moveLabel,
  canEdit,
  onSave,
}: {
  comment: string | null;
  moveLabel: string | null;
  canEdit: boolean;
  onSave: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(comment ?? '');
  const [synced, setSynced] = useState(comment);

  /**
   * Re-sync when the applied comment changes (a remote echo, a node switch,
   * or our own save landing). Render-time adjustment — no effect.
   */
  if (comment !== synced) {
    const wasClean = draft === (synced ?? '');
    setSynced(comment);
    if (wasClean) {
      setDraft(comment ?? '');
    }
  }

  const dirty = draft !== (comment ?? '');

  function save() {
    onSave(draft.trim());
  }

  return (
    <section className={panel({ layout: 'none', pad: 'none' })}>
      <div className={panelHeader()}>
        <h2 className="m-0">{t('analysis.commentTitle')}</h2>
        {moveLabel !== null && (
          <span className="normal-case tracking-normal text-gold-hi tabular-nums">{moveLabel}</span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3">
        {!canEdit && comment !== null && (
          <p data-testid="node-comment" className="m-0 text-body text-ink">
            {comment}
          </p>
        )}
        {!canEdit && comment === null && (
          <p className="m-0 text-ui text-faint">{t('analysis.noCommentYet')}</p>
        )}
        {canEdit && (
          <>
            <textarea
              value={draft}
              data-testid="comment-editor"
              aria-label={t('analysis.commentPlaceholder')}
              placeholder={t('analysis.commentPlaceholder')}
              rows={3}
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
                      onSave('');
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
          </>
        )}
      </div>
    </section>
  );
}
