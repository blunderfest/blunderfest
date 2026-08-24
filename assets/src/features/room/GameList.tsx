import { useTranslation } from 'react-i18next';
import { button, chip, listRow, panel, panelHeader, statusDot } from '@/components/ui';
import type { GameTree } from '@/lib/api';

function gameTitle(tree: GameTree, t: (key: string) => string): string {
  const white = tree.headers.White;
  const black = tree.headers.Black;
  if (white && black) {
    return `${white} – ${black}`;
  }
  return white ?? black ?? t('room.untitledGame');
}

/** Bring games in — the header's import icon (heroicons arrow-up-tray). */
function ImportIcon() {
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
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

/** A fresh board — the header's new-game icon (heroicons plus). */
function NewGameIcon() {
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
      <path d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export default function GameList({
  games,
  activeGameId,
  presenterGameId,
  canEdit,
  onSelectGame,
  onAddGame,
  onNewGame,
}: {
  games: Record<string, GameTree>;
  activeGameId: string | null;
  presenterGameId: string | null;
  canEdit: boolean;
  onSelectGame: (id: string) => void;
  onAddGame: () => void;
  onNewGame: () => void;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(games);

  return (
    <section
      className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-col xl:max-h-[45%]`}
      data-tour="game-list"
    >
      {/*
        The actions live in the header as icon buttons (the game header's
        export/bookmark pattern) — a bottom button row wrapped at the
        rail's width and wasted vertical space.
      */}
      <div className={panelHeader()}>
        <h2 className="m-0">{t('room.games')}</h2>
        <div className="flex items-center gap-1">
          <span className="text-faint tabular-nums">{entries.length}</span>
          {canEdit && (
            <>
              <button
                type="button"
                id="add-game-button"
                className={button({ intent: 'ghost', size: 'icon' })}
                aria-label={t('room.addGame')}
                title={t('room.addGame')}
                onClick={onAddGame}
              >
                <ImportIcon />
              </button>
              <button
                type="button"
                id="new-game-button"
                className={button({ intent: 'ghost', size: 'icon' })}
                aria-label={t('room.newGame')}
                title={t('room.newGame')}
                onClick={onNewGame}
              >
                <NewGameIcon />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {entries.length === 0 ? (
          <p className="m-0 p-2 text-ui text-faint">{t('room.emptyGames')}</p>
        ) : (
          <ul className="m-0 flex flex-col gap-0.5 p-0">
            {entries.map(([id, tree]) => (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={id === activeGameId}
                  aria-current={id === activeGameId ? 'true' : undefined}
                  className={`${listRow({ state: id === activeGameId ? 'selected' : 'default' })} rounded-control`}
                  onClick={() => onSelectGame(id)}
                >
                  <span className="min-w-0 flex-1 truncate">{gameTitle(tree, t)}</span>
                  {presenterGameId === id && (
                    <span
                      role="img"
                      aria-label={t('room.presenting')}
                      title={t('room.presenting')}
                      className={statusDot({ tone: 'warn' })}
                    />
                  )}
                  {tree.result !== '*' && (
                    <span className={chip({ tone: 'outline' })}>{tree.result}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
