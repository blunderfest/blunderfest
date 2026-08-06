import { useTranslation } from 'react-i18next';
import { panel } from '@/components/ui';
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

  return (
    <section className={panel({ layout: 'none', padding: 'tight' })}>
      <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.games')}</h2>
      {Object.keys(games).length === 0 ? (
        <p className="m-0 text-sm text-muted">{t('room.emptyGames')}</p>
      ) : (
        <ul className="m-0 flex flex-col gap-1.5 p-0">
          {Object.entries(games).map(([id, tree]) => (
            <li key={id} className="flex flex-col gap-1">
              <button
                type="button"
                aria-pressed={id === activeGameId}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:bg-white/5 aria-pressed:border-white/20 aria-pressed:bg-white/10"
                onClick={() => onSelectGame(id)}
              >
                <span className="min-w-0 truncate text-sm">{gameTitle(tree, t)}</span>
                {presenterGameId === id && <span className="sr-only">{t('room.presenting')}</span>}
                {tree.result !== '*' && (
                  <span className="shrink-0 text-xs text-muted">{tree.result}</span>
                )}
              </button>
              {presenterGameId === id && (
                <span className="px-2 text-xs text-muted">{t('room.presenting')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-col gap-2">
        {canEdit && (
          <>
            <button
              type="button"
              id="add-game-button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink transition-colors hover:border-white/30"
              onClick={onAddGame}
            >
              {t('room.addGame')}
            </button>
            <button
              type="button"
              id="new-game-button"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink transition-colors hover:border-white/30"
              onClick={onNewGame}
            >
              {t('room.newGame')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
