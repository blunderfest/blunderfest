import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip } from '@/components/ui';
import GameList from '@/features/room/GameList';
import type { GameTree } from '@/lib/api';
import { formatRegion } from '@/lib/region';
import { useAppSelector } from '@/store';

/**
 * The sidebar's Room tab (ADR-0031): the room's games with the import/new
 * actions, then the room itself — the share code with copy, the leave
 * action, the demo badge for read-only rooms (ADR-0014), and the compact
 * region/lag readout. Presence lives in the app-bar strip, chat in its own
 * tab.
 */
export default function RoomTab({
  slug,
  games,
  activeGameId,
  presenterGameId,
  canEdit,
  onSelectGame,
  onAddGame,
  onNewGame,
  onLeave,
}: {
  slug: string;
  games: Record<string, GameTree>;
  activeGameId: string | null;
  presenterGameId: string | null;
  canEdit: boolean;
  onSelectGame: (id: string) => void;
  onAddGame: () => void;
  onNewGame: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const region = useAppSelector((state) => state.room.region);
  const roomRegion = useAppSelector((state) => state.room.roomRegion);
  const lagMs = useAppSelector((state) => state.room.lagMs);
  const readOnly = useAppSelector((state) => state.room.readOnly);

  /** The connection summary: region(s) plus the measured round-trip. */
  const connectionText =
    region === null
      ? null
      : roomRegion !== null && roomRegion !== region
        ? t('room.connectionSplit', {
            you: formatRegion(region) ?? region,
            room: formatRegion(roomRegion) ?? roomRegion,
          })
        : (formatRegion(region) ?? region);

  async function handleCopy() {
    if (!navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions etc.) — nothing to show
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      <GameList
        games={games}
        activeGameId={activeGameId}
        presenterGameId={presenterGameId}
        canEdit={canEdit}
        onSelectGame={onSelectGame}
        onAddGame={onAddGame}
        onNewGame={onNewGame}
      />
      <section
        className="mt-1 border-t border-line px-3 pt-2 pb-2"
        aria-label={t('room.panelTitle')}
      >
        <div className="flex items-center gap-2">
          <code className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-sm tracking-widest">
            <span className="sr-only">{t('room.codeLabel')} </span>
            {slug.toUpperCase()}
          </code>
          <button
            type="button"
            id="copy-code-button"
            aria-label={t('room.copy')}
            title={t('room.copy')}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-muted transition-colors hover:border-white/30 hover:text-ink"
            onClick={() => void handleCopy()}
          >
            <span className="relative block h-4 w-4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`absolute inset-0 h-4 w-4 transition-all duration-200 ${
                  copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
                }`}
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`absolute inset-0 h-4 w-4 text-ok-hi transition-all duration-200 ${
                  copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}
              >
                <path d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
            <span className="sr-only" aria-live="polite">
              {copied ? t('room.copied') : t('room.copy')}
            </span>
          </button>
          {readOnly && (
            <span className={chip({ tone: 'gold' })} title={t('room.demoHint')}>
              {t('room.demoBadge')}
            </span>
          )}
          <button
            type="button"
            id="leave-room-button"
            className={`${button({ intent: 'ghost', size: 'sm' })} ml-auto`}
            onClick={onLeave}
          >
            {t('room.leave')}
          </button>
        </div>
        {(connectionText !== null || lagMs !== null) && (
          <div
            className="mt-1.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-muted"
            data-testid="connection"
            title={t('room.regionLabel')}
          >
            {connectionText !== null && (
              <span className="truncate" data-testid="region-chip">
                {connectionText}
              </span>
            )}
            {lagMs !== null && (
              <span className="ml-auto shrink-0 tabular-nums text-faint" data-testid="lag-ms">
                {t('room.lag', { ms: lagMs })}
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
