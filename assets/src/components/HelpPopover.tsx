import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

function QuestionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4"
    >
      <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
  );
}

/**
 * A "?" icon button with an anchored explainer popover — the app's
 * always-available reference layer (the guided tour is the one-time
 * orientation; this is the on-demand help for specific features).
 *
 * The popover renders in a portal with viewport-fixed placement, so no
 * ancestor's `overflow-hidden` (sidebar panels, tab sections) can clip it.
 * A click outside, Escape or any scroll closes it.
 */
export default function HelpPopover({
  label,
  children,
}: {
  /** Accessible label for the icon button (and the popover header). */
  label: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const anchor = buttonRef.current?.getBoundingClientRect();
  // Below the button, right-aligned to it, clamped to the viewport.
  const top = anchor ? Math.min(anchor.bottom + 6, window.innerHeight - 16) : 0;
  const right = anchor ? Math.max(window.innerWidth - anchor.right, 8) : 0;
  const maxHeight = Math.min(window.innerHeight - top - 12, 480);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <QuestionIcon />
      </button>

      {open &&
        createPortal(
          <>
            {/* Click-outside backdrop. z-indices sit above the app modals
                (z-50): the popover portaled to document.body would
                otherwise render *under* a dialog like Find examples. */}
            <div className="fixed inset-0 z-[60]" aria-hidden="true" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              aria-label={label}
              className="fixed z-[70] flex w-96 flex-col gap-2 overflow-hidden rounded-panel border border-line bg-panel p-3 shadow-panel"
              style={{ top, right, maxHeight }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2">
                <span className="text-micro font-semibold uppercase tracking-[0.11em] text-muted">
                  {label}
                </span>
                <button
                  type="button"
                  aria-label={t('help.close')}
                  onClick={() => setOpen(false)}
                  className="rounded-full px-1.5 text-note text-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  ×
                </button>
              </div>
              <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
