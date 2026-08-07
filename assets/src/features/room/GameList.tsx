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
    <section className={`${panel({ layout: 'none', pad: 'none' })} flex min-h-0 flex-col`}>
      <div className={panelHeader()}>
        <h2 className="m-0">{t('room.games')}</h2>
        <span className="text-faint tabular-nums">{entries.length}</span>
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
      {canEdit && (
        <div className="flex gap-2 border-t border-line p-2">
          <button
            type="button"
            id="add-game-button"
            className={button({ intent: 'quiet', size: 'sm', block: true })}
            onClick={onAddGame}
          >
            {t('room.addGame')}
          </button>
          <button
            type="button"
            id="new-game-button"
            className={button({ intent: 'quiet', size: 'sm', block: true })}
            onClick={onNewGame}
          >
            {t('room.newGame')}
          </button>
        </div>
      )}
    </section>
  );
}
