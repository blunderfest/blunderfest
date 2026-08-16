import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import LichessMark from '@/components/LichessMark';
import { lichessAuthStart, type Profile, unlinkLichess } from '@/lib/api';
import { loadDevice } from '@/lib/device';

const menuItem =
  'block w-full rounded-md px-2.5 py-1.5 text-left text-ui text-ink transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * The app-bar account menu (ADR-0022): the fun name opens a small menu
 * showing the identity state (anonymous device or linked Lichess account)
 * and the link/recover actions. The linkage is a recovery key, never a
 * persona — the fun name stays the display identity everywhere.
 */
export default function AccountMenu({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  // The unlink result, applied optimistically — the menu is the only
  // consumer of the accounts list today, and the server is the source of
  // truth on the next load.
  const [unlinked, setUnlinked] = useState(false);
  const lichess = unlinked
    ? null
    : (profile.accounts?.find((account) => account.type === 'lichess') ?? null);

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

  async function startFlow() {
    const device = loadDevice();
    if (device === null || starting) {
      return;
    }
    setStarting(true);
    try {
      const { url } = await lichessAuthStart(device);
      window.location.assign(url);
    } catch {
      setStarting(false);
    }
  }

  async function handleUnlink() {
    const device = loadDevice();
    if (device === null || busy) {
      return;
    }
    setBusy(true);
    try {
      await unlinkLichess(device);
      setUnlinked(true);
    } catch {
      // The link is still there; the menu keeps showing it.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        id="account-menu-button"
        aria-label={t('account.menu')}
        title={t('account.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="m-0 hidden cursor-pointer rounded-control border border-transparent px-1.5 py-0.5 text-ui text-muted transition-colors hover:border-line hover:text-ink md:block"
        onClick={() => setOpen((value) => !value)}
      >
        {profile.name}
      </button>
      {open && (
        <>
          {/* Click-to-close backdrop (aria-hidden; Esc closes the menu too). */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            aria-label={t('account.menu')}
            className="absolute top-full right-0 z-50 mt-1 w-64 rounded-control border border-line-strong bg-overlay p-1 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]"
          >
            <p className="m-0 flex items-center gap-1.5 px-2.5 py-1.5 text-note text-faint">
              {lichess !== null && <LichessMark />}
              {lichess !== null
                ? t('account.lichessLinked', { username: lichess.username })
                : t('account.anonymous')}
            </p>
            {lichess === null && (
              <button
                type="button"
                role="menuitem"
                className={`${menuItem} flex items-center gap-1.5`}
                disabled={starting}
                onClick={() => void startFlow()}
              >
                <LichessMark />
                {starting ? t('account.signingIn') : t('account.signIn')}
              </button>
            )}
            {lichess !== null && (
              <button
                type="button"
                role="menuitem"
                className={menuItem}
                disabled={busy}
                onClick={() => void handleUnlink()}
              >
                {busy ? t('account.signingOut') : t('account.signOut')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
