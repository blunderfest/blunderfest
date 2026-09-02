import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button } from '@/components/ui';
import { placeTooltip, type Spot } from '@/features/tour/placement';
import type { TourStepDef } from '@/features/tour/steps';

/** Breathing room around the spotlighted element. */
const PAD = 8;

/**
 * The guided tour: a spotlight (a ring whose giant box-shadow dims the rest
 * of the page) plus a tooltip card stepping through the screen's landmarks.
 * Hand-rolled on purpose — it is one rect, one shadow and one card, and a
 * library's styling would fight the design tokens.
 *
 * Steps resolve once when the tour opens (targets absent from the DOM are
 * dropped); Esc / a click on the dim / Skip all close it.
 */
export default function Tour({ steps, onClose }: { steps: TourStepDef[]; onClose: () => void }) {
  const { t } = useTranslation();
  // Steps resolve after mount, not during render: querySelector must see
  // the already-committed DOM (siblings rendered in the same commit aren't
  // in the document yet at render time).
  const [resolved, setResolved] = useState<TourStepDef[] | null>(null);
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    setResolved(
      steps.filter((step) => step.target === null || document.querySelector(step.target) !== null),
    );
  }, [steps]);

  const step = resolved !== null && index < resolved.length ? resolved[index] : undefined;
  const last = resolved !== null && index === resolved.length - 1;

  // Esc closes; arrows walk the steps. Functional updates keep the handler
  // free of stale state.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight') {
        setIndex((i) => Math.min(i + 1, (resolved?.length ?? 1) - 1));
      } else if (event.key === 'ArrowLeft') {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, resolved?.length]);

  // Find and track the step's target. scrollIntoView happens only on the
  // step change itself — doing it inside `measure` would loop on the
  // scroll events it fires.
  useLayoutEffect(() => {
    if (step === undefined) {
      return;
    }
    const el = step.target !== null ? document.querySelector(step.target) : null;
    if (el !== null && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
    function measure() {
      if (el === null) {
        setSpot(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setSpot({
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + 2 * PAD,
        height: rect.height + 2 * PAD,
      });
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  // Place the tooltip near the spotlight, always inside the viewport
  // (zoomed viewports and oversized targets included). Null spot =
  // centered (handled with CSS classes, no measurement needed).
  useLayoutEffect(() => {
    if (spot === null) {
      setTipPos(null);
      return;
    }
    const tipEl = tipRef.current;
    if (tipEl === null) {
      return;
    }
    setTipPos(
      placeTooltip(
        spot,
        { width: tipEl.offsetWidth, height: tipEl.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [spot]);

  // Keyboard focus follows the tour so Enter advances and Esc always lands.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-focus on every step change
  useEffect(() => {
    actionRef.current?.focus();
  }, [index]);

  if (resolved === null || step === undefined) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Click-blocker (aria-hidden, click-to-close; Esc closes too); when
          there is no spotlight it also dims the page. */}
      <div
        className={`absolute inset-0 ${spot === null ? 'bg-void/75' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {spot !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.72)] outline-2 outline-accent"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      )}
      <div
        ref={tipRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(step.titleKey)}
        className={`absolute w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-dialog border border-line-strong bg-overlay p-4 shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)] ${
          spot === null ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''
        }`}
        style={
          spot === null
            ? { maxHeight: 'calc(100vh - 1rem)' }
            : tipPos !== null
              ? { top: tipPos.top, left: tipPos.left, maxHeight: 'calc(100vh - 1rem)' }
              : { visibility: 'hidden' }
        }
      >
        <h2 className="m-0 text-lead font-semibold">{t(step.titleKey)}</h2>
        <p className="m-0 mt-1 text-ui text-muted">{t(step.bodyKey)}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-note text-faint tabular-nums">
            {t('tour.progress', { current: index + 1, total: resolved.length })}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className={button({ intent: 'ghost', size: 'sm' })}
              onClick={onClose}
            >
              {t('tour.skip')}
            </button>
            {index > 0 && (
              <button
                type="button"
                className={button({ intent: 'secondary', size: 'sm' })}
                onClick={() => setIndex(index - 1)}
              >
                {t('tour.back')}
              </button>
            )}
            <button
              ref={actionRef}
              type="button"
              className={button({ intent: 'primary', size: 'sm' })}
              onClick={() => (last ? onClose() : setIndex(index + 1))}
            >
              {last ? t('tour.done') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
