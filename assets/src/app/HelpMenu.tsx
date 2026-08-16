import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ShortcutsDialog from '@/features/analysis/ShortcutsDialog';

const menuItem =
  'block w-full rounded-md px-2.5 py-1.5 text-left text-ui text-ink transition-colors hover:bg-white/5';

/**
 * The app-bar help menu: re-trigger the guided tour, open the keyboard
 * shortcuts. App-level by design — it is available on every screen, which
 * is also what the tour's last step points at. The tour entry is offered
 * in rooms only; the landing page doesn't need one.
 */
export default function HelpMenu({
  onStartTour,
  showTour,
}: {
  onStartTour: () => void;
  showTour: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        id="help-menu-button"
        data-tour="help-menu"
        aria-label={t('help.menu')}
        title={t('help.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-7 w-7 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-ink"
        onClick={() => setOpen((value) => !value)}
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
          <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75" />
          <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          <path d="M12 17.25h.008v.008H12v-.008z" />
        </svg>
      </button>
      {open && (
        <>
          {/* Click-to-close backdrop (aria-hidden; Esc closes the menu too). */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={t('help.menu')}
            className="absolute top-full right-0 z-50 mt-1 w-56 rounded-control border border-line-strong bg-overlay p-1 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]"
          >
            {showTour && (
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                onClick={() => {
                  setOpen(false);
                  onStartTour();
                }}
              >
                {t('help.tour')}
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={menuItem}
              onClick={() => {
                setOpen(false);
                setShortcutsOpen(true);
              }}
            >
              {t('help.shortcuts')}
            </button>
          </div>
        </>
      )}
      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
