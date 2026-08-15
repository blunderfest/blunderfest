import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';

export type NavTargets = {
  first: number;
  prev: number | null;
  next: number | null;
  last: number | null;
};

/** Uniform nav glyphs — font glyphs like ⏮/◀ render at mismatched sizes. */
function NavIcon({ of }: { of: 'first' | 'prev' | 'next' | 'last' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {of === 'first' && (
        <>
          <polygon points="12,3 5,8 12,13" />
          <rect x="3" y="3" width="2" height="10" />
        </>
      )}
      {of === 'prev' && <polygon points="11,3 4,8 11,13" />}
      {of === 'next' && <polygon points="5,3 12,8 5,13" />}
      {of === 'last' && (
        <>
          <polygon points="4,3 11,8 4,13" />
          <rect x="11" y="3" width="2" height="10" />
        </>
      )}
    </svg>
  );
}

/**
 * The move-navigation row: first/prev/next/last around the ply counter.
 * Lives under the board — one home for navigation, always next to the
 * position, on every viewport size.
 */
export default function NavControls({
  navTargets,
  currentId,
  currentPly,
  totalPly,
  onSelect,
}: {
  navTargets: NavTargets;
  currentId: number;
  currentPly: number;
  totalPly: number;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        id="analysis-first-button"
        className={button({ intent: 'secondary', size: 'icon' })}
        disabled={currentId === navTargets.first}
        aria-label={t('analysis.first')}
        aria-keyshortcuts="Home"
        onClick={() => onSelect(navTargets.first)}
      >
        <NavIcon of="first" />
      </button>
      <button
        type="button"
        id="analysis-prev-button"
        className={button({ intent: 'secondary', size: 'icon' })}
        disabled={navTargets.prev === null}
        aria-label={t('analysis.prev')}
        aria-keyshortcuts="ArrowLeft"
        onClick={() => navTargets.prev !== null && onSelect(navTargets.prev)}
      >
        <NavIcon of="prev" />
      </button>
      <span className="px-2 text-ui text-muted tabular-nums" data-testid="ply-counter">
        {t('analysis.position', { ply: currentPly, total: totalPly })}
      </span>
      <button
        type="button"
        id="analysis-next-button"
        className={button({ intent: 'secondary', size: 'icon' })}
        disabled={navTargets.next === null}
        aria-label={t('analysis.next')}
        aria-keyshortcuts="ArrowRight"
        onClick={() => navTargets.next !== null && onSelect(navTargets.next)}
      >
        <NavIcon of="next" />
      </button>
      <button
        type="button"
        id="analysis-last-button"
        className={button({ intent: 'secondary', size: 'icon' })}
        disabled={navTargets.last === null}
        aria-label={t('analysis.last')}
        aria-keyshortcuts="End"
        onClick={() => navTargets.last !== null && onSelect(navTargets.last)}
      >
        <NavIcon of="last" />
      </button>
    </div>
  );
}
