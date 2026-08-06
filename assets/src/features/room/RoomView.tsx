import type { TFunction } from 'i18next';
import type { Channel } from 'phoenix';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Analysis from '@/features/analysis/Analysis';
import ImportForm from '@/features/import/ImportForm';
import { useRoomChannel } from '@/features/room/useRoomChannel';
import { emptyGameTree, type GameTree } from '@/lib/api';
import type { Op } from '@/protocol/ops';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectActiveGame,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  setActiveGame,
} from '@/store/room';

function opLabel(t: TFunction, op: Op): string {
  switch (op.type) {
    case 'set_game':
      return t('room.game');
    case 'move_at_ply':
      return t('room.move', { ply: op.payload.ply, san: op.payload.san });
    case 'comment_at_ply':
      return t('room.comment', { ply: op.payload.ply, text: op.payload.text });
    case 'replace_line':
      return t('room.line', { ply: op.payload.ply });
    case 'add_arrow':
      return t('room.arrow', { ply: op.payload.ply });
    case 'add_highlight':
      return t('room.highlight', { ply: op.payload.ply });
    default:
      return '';
  }
}

export default function RoomView({
  slug,
  onLeave,
  selfId = null,
  channelFactory,
}: {
  slug: string;
  onLeave: () => void;
  selfId?: string | null;
  channelFactory?: (topic: string) => Channel;
}) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { joined, presence, sendOp } = useRoomChannel(slug, channelFactory);
  const ops = useAppSelector((state) => state.room.ops);
  const storePresence = useAppSelector((state) => state.room.presence);
  const games = useAppSelector((state) => state.room.games);
  const activeGameId = useAppSelector((state) => state.room.activeGameId);
  const game = useAppSelector((state) => selectActiveGame(state.room));
  const presenter = useAppSelector((state) => selectPresenter(state.room));
  const presenterGameId = useAppSelector((state) => selectPresenterGameId(state.room));
  const presenterCursor = useAppSelector((state) => selectPresenterCursor(state.room));
  const [copied, setCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [following, setFollowing] = useState(false);

  const amPresenter = selfId !== null && presenter?.id === selfId;

  const handleCursorChange = useCallback(
    (nodeId: number) => sendOp({ type: 'set_cursor', payload: { node_id: nodeId } }),
    [sendOp],
  );

  const activityOps = ops.filter((op) => op.type !== 'set_cursor' && op.type !== 'select_game');

  /**
   * Follow the presenter: default on whenever someone else presents.
   */
  useEffect(() => {
    if (presenter === null || (selfId !== null && selfId === presenter.id)) {
      setFollowing(false);
      return;
    }
    setFollowing(true);
  }, [presenter, selfId]);

  /**
   * Snap to the presenter's game while following.
   */
  useEffect(() => {
    if (following && presenterGameId !== null && presenterGameId !== activeGameId) {
      dispatch(setActiveGame(presenterGameId));
    }
  }, [following, presenterGameId, activeGameId, dispatch]);

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

  function handleImported(tree: GameTree) {
    setFollowing(false);
    const gameId = crypto.randomUUID();
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
    dispatch(setActiveGame(gameId));
    setShowImport(false);
  }

  function handleNewGame() {
    setFollowing(false);
    const gameId = crypto.randomUUID();
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree: emptyGameTree() } });
    dispatch(setActiveGame(gameId));
    setShowImport(false);
  }

  function handleSelectGame(gameId: string) {
    setFollowing(false);
    dispatch(setActiveGame(gameId));
    if (amPresenter) {
      sendOp({ type: 'select_game', payload: { game_id: gameId } });
    }
  }

  function gameTitle(tree: GameTree): string {
    const white = tree.headers.White;
    const black = tree.headers.Black;
    if (white && black) {
      return `${white} – ${black}`;
    }
    return white ?? black ?? t('room.untitledGame');
  }

  const showImportForm = Object.keys(games).length === 0 || showImport;

  return (
    <main className="flex flex-1 flex-col items-stretch gap-6 p-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="m-0 text-2xl tracking-[-0.02em]">{t('room.codeLabel')}</h1>
          <code className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-lg tracking-widest">
            {slug.toUpperCase()}
          </code>
          <button
            type="button"
            id="copy-code-button"
            className="rounded-lg border border-white/10 px-3 py-1 text-sm text-muted transition-colors hover:border-white/30 hover:text-ink"
            onClick={() => void handleCopy()}
          >
            {copied ? t('room.copied') : t('room.copy')}
          </button>
          {!joined && <p className="m-0 text-sm text-warn">{t('room.connecting')}</p>}
        </div>
        <button
          type="button"
          id="leave-room-button"
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-white/30"
          onClick={onLeave}
        >
          {t('room.leave')}
        </button>
      </section>

      <div className="grid flex-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
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
                      onClick={() => handleSelectGame(id)}
                    >
                      <span className="min-w-0 truncate text-sm">{gameTitle(tree)}</span>
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
              <button
                type="button"
                id="add-game-button"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink transition-colors hover:border-white/30"
                onClick={() => setShowImport(true)}
              >
                {t('room.addGame')}
              </button>
              <button
                type="button"
                id="new-game-button"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-ink transition-colors hover:border-white/30"
                onClick={handleNewGame}
              >
                {t('room.newGame')}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.members')}</h2>
            <ul className="m-0 flex flex-col gap-2 p-0">
              {presence.map((member) => (
                <li key={member.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 rounded-full bg-ok" />
                  {member.name}
                  {member.id === presenter?.id && (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-muted">
                      {t('room.presenting')}
                    </span>
                  )}
                </li>
              ))}
              {presence.length === 0 && <li className="text-sm text-muted">…</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="m-0 mb-3 text-sm font-semibold text-muted">{t('room.activity')}</h2>
            {activityOps.length === 0 ? (
              <p className="m-0 text-sm text-muted">{t('room.emptyActivity')}</p>
            ) : (
              <ul className="m-0 flex max-h-96 flex-col gap-1 overflow-y-auto p-0">
                {activityOps.map((op) => (
                  <li
                    key={op.seq}
                    className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1 text-sm hover:bg-white/5"
                  >
                    <span>
                      <span className="text-muted">#{op.seq} </span>
                      {opLabel(t, op)}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {storePresence[op.author]?.name ?? op.author}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="flex flex-col items-center gap-4">
          {showImportForm ? (
            <ImportForm onImported={handleImported} />
          ) : (
            <Analysis
              tree={game}
              presenterId={presenter?.id ?? null}
              selfId={selfId}
              presenterCursorId={presenterCursor}
              following={following}
              onFollowChange={setFollowing}
              onCursorChange={handleCursorChange}
            />
          )}
        </section>
      </div>
    </main>
  );
}
