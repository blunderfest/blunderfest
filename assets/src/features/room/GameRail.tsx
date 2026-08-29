import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip } from '@/components/ui';
import type { GameTree } from '@/lib/api';
import { gameTitle } from '@/lib/gameTitle';

/**
 * The games rail (ADR-0032): the room's games as chrome — a dedicated,
 * scrollable region with a fixed header ("Boards · N" plus the
 * import/new icons), never buried in a tab. Desktop: a vertical left
 * rail whose list scrolls itself (`min-h-0` + `overflow-y-auto`) so the
 * import actions stay reachable at any game count. Mobile: a horizontal
 * strip under the header (same row grammar). Position-setup games wear a
 * "position" chip instead of an eval badge — a mid-tree setup would lie.
 */

/** Whether the tree is a position setup (ADR-0011) — its setup marker, not
    just a root FEN (every parsed tree carries the root's FEN). */
function isSetup(tree: GameTree): boolean {
  return tree.setup !== null;
}

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
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12M12 16.5V3" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

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

/** Initials for the presenter's sub-row marker. */
function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function GameRail({
  games,
  activeGameId,
  presenterGameId,
  canEdit,
  onSelectGame,
  onAddGame,
  onNewGame,
  onRemoveGame,
  onRenameGame,
  presenterName = null,
}: {
  /** Game entries in deterministic set_game seq order, so "Game N" counts
      the same on every client. */
  games: [string, GameTree][];
  activeGameId: string | null;
  presenterGameId: string | null;
  canEdit: boolean;
  onSelectGame: (id: string) => void;
  onAddGame: () => void;
  onNewGame: () => void;
  onRemoveGame: (id: string) => void;
  onRenameGame: (id: string, title: string) => void;
  presenterName?: string | null;
}) {
  const { t } = useTranslation();
  const entries = games;
  /** Inline rename (double-click the title): the op rides the log, so every
      client — and exports — see the new custom `Title` header. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renamingId]);

  function startRename(id: string, tree: GameTree) {
    if (!canEdit) {
      return;
    }
    setRenamingId(id);
    setDraft(tree.headers.Title?.trim() ?? '');
  }

  function commitRename() {
    if (renamingId === null) {
      return;
    }
    const title = draft.trim().slice(0, 80);
    if (title !== (games.find(([id]) => id === renamingId)?.[1].headers.Title?.trim() ?? '')) {
      onRenameGame(renamingId, title === '' ? '' : title);
    }
    setRenamingId(null);
  }

  return (
    <nav
      aria-label={t('room.games')}
      data-tour="games-rail"
      data-testid="games-rail"
      className="flex w-full shrink-0 items-stretch gap-1.5 overflow-x-auto border-line bg-void max-xl:border-b max-xl:p-1.5 xl:h-[calc(var(--board-size)+7.5rem)] xl:w-[260px] xl:flex-col xl:gap-0 xl:overflow-x-visible xl:border-r"
    >
      {/* Fixed rail header — the import/new icons stay reachable at any
          game count; the list scrolls beneath them. The rail's xl height
          matches the dock's (board + chrome) so the page never scrolls. */}
      <div className="flex shrink-0 items-center justify-between gap-1 border-b border-line px-2 py-1 max-xl:hidden">
        <span className="text-micro font-semibold uppercase tracking-[0.11em] text-muted">
          {t('room.boardsWithCount', { count: entries.length })}
        </span>
        {canEdit && (
          <div className="flex items-center gap-0.5">
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
          </div>
        )}
      </div>

      {/* The scrollable list: vertical on xl, horizontal strip below it. */}
      <div
        className="flex min-h-0 flex-1 items-stretch gap-1 overflow-x-auto p-1 xl:flex-col xl:items-stretch xl:overflow-y-auto xl:overflow-x-hidden"
        data-testid="games-rail-list"
      >
        {entries.length === 0 ? (
          <p className="m-0 p-2 text-ui text-faint max-xl:hidden">{t('room.emptyGames')}</p>
        ) : (
          entries.map(([id, tree]) => {
            const active = id === activeGameId;
            const presenting = presenterGameId === id && presenterName !== null;
            // Names are baked at creation ("Game N" written as the Title
            // header); the rail only derives a fallback for headerless
            // imports.
            const title = gameTitle(tree, t('room.untitledGame'));
            return (
              <div key={id} className="group relative shrink-0 max-xl:w-44">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelectGame(id)}
                  onDoubleClick={() => startRename(id, tree)}
                  className={`flex w-full flex-col rounded-control border px-2 py-1.5 text-left transition-colors ${
                    active
                      ? 'border-gold-hi/60 bg-gold/10'
                      : 'border-transparent hover:border-line hover:bg-raised'
                  }`}
                >
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    {canEdit && renamingId === id ? (
                      <input
                        ref={inputRef}
                        className="min-w-0 flex-1 rounded-control border border-line bg-background text-ui font-semibold text-ink"
                        data-testid={`rename-input-${id}`}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            commitRename();
                          } else if (event.key === 'Escape') {
                            setRenamingId(null);
                          }
                        }}
                        aria-label={t('room.renameGame')}
                      />
                    ) : (
                      <span
                        className={`min-w-0 truncate text-ui font-semibold ${
                          active ? 'text-ink' : 'text-muted'
                        }`}
                      >
                        {title}
                      </span>
                    )}
                    {presenting && (
                      <span
                        role="img"
                        aria-label={t('room.presenting')}
                        title={t('room.presenting')}
                        className="ml-auto inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line text-[7px] font-bold text-gold-hi"
                      >
                        {initialsOf(presenterName)}
                      </span>
                    )}
                    {/* Reserve the remove button's slot on desktop so the
                        title never reflows when it appears on hover. */}
                    {canEdit && !presenting && (
                      <span className="ml-auto w-4 shrink-0 max-xl:hidden" />
                    )}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1">
                    {isSetup(tree) && (
                      <span className={chip({ tone: 'outline' })}>{t('room.positionChip')}</span>
                    )}
                    <span className="min-w-0 truncate text-micro text-faint">
                      {tree.headers.Opening ?? tree.headers.ECO ?? ''}
                    </span>
                    {tree.result !== '*' && (
                      <span className={`${chip({ tone: 'outline' })} ml-auto shrink-0`}>
                        {tree.result}
                      </span>
                    )}
                  </span>
                </button>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={t('room.removeGame')}
                    title={t('room.removeGame')}
                    data-testid={`remove-game-${id}`}
                    onClick={() => onRemoveGame(id)}
                    className="absolute top-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-faint opacity-0 transition-opacity hover:bg-bad/20 hover:text-bad-hi focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <RemoveIcon />
                  </button>
                )}
              </div>
            );
          })
        )}
        {/* Mobile-only action tiles — the rail header is hidden below xl. */}
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onAddGame}
              className="flex w-28 shrink-0 items-center justify-center gap-1.5 self-stretch rounded-control border border-dashed border-line-strong text-ui font-medium text-faint transition-colors hover:border-gold-hi/60 hover:text-gold-hi xl:hidden"
            >
              <ImportIcon />
              {t('room.addGame')}
            </button>
            <button
              type="button"
              onClick={onNewGame}
              className="flex w-28 shrink-0 items-center justify-center gap-1.5 self-stretch rounded-control border border-dashed border-line-strong text-ui font-medium text-faint transition-colors hover:border-gold-hi/60 hover:text-gold-hi xl:hidden"
            >
              <NewGameIcon />
              {t('room.newGame')}
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
