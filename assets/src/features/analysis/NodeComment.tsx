import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, panel } from '@/components/ui';

/**
 * Comment on the current position. Editors get a textarea to write or edit
 * the comment (an empty save clears it); viewers only see the text.
 */
export default function NodeComment({
  comment,
  canEdit,
  onSave,
}: {
  comment: string | null;
  canEdit: boolean;
  onSave: (text: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(comment ?? '');

  useEffect(() => {
    setDraft(comment ?? '');
  }, [comment]);

  if (!canEdit && comment === null) {
    return null;
  }

  return (
    <section className={panel({ width: 'lg' })}>
      {!canEdit && comment !== null && (
        <p data-testid="node-comment" className="m-0 text-sm text-ink">
          {comment}
        </p>
      )}
      {canEdit && (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            data-testid="comment-editor"
            aria-label={t('analysis.commentPlaceholder')}
            placeholder={t('analysis.commentPlaceholder')}
            rows={3}
            className="w-full resize-y rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-white/40 focus:outline-none"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="button"
            data-testid="save-comment"
            className={button({ variant: 'primary', size: 'sm' })}
            onClick={() => onSave(draft.trim())}
          >
            {t('analysis.saveComment')}
          </button>
        </div>
      )}
    </section>
  );
}
