import type { Channel } from 'phoenix';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { button, chip, panel, statusDot } from '@/components/ui';
import Analysis from '@/features/analysis/Analysis';
import ImportDialog from '@/features/import/ImportDialog';
import ActivityFeed from '@/features/room/ActivityFeed';
import GameList from '@/features/room/GameList';
import MemberList from '@/features/room/MemberList';
import { useRoomChannel } from '@/features/room/useRoomChannel';
import { emptyGameTree, type GameTree } from '@/lib/api';
import type { CommentAtPlyOp, MemberRole, MoveAtPlyOp, SetPositionOp } from '@/protocol/ops';
import { useAppSelector } from '@/store';
import type { BoardAnnotations } from '@/store/room';
import {
  selectActivityOps,
  selectCanEdit,
  selectFirstGameId,
  selectLastPlayed,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  selectRoleOf,
  selectSortedMembers,
} from '@/store/room';

/**
 * Shared empty fallback for the annotations lookup below. Allocating `{}`
 * inside the selector would return a new reference on every dispatch,
 * causing spurious re-renders (and react-redux dev warnings).
 */
const NO_ANNOTATIONS: Record<number, BoardAnnotations> = {};

export default function RoomView({
  slug,
  onLeave,
  selfId = null,
  selfName = null,
  channelFactory,
}: {
  slug: string;
  onLeave: () => void;
  selfId?: string | null;
  selfName?: string | null;
  channelFactory?: (topic: string, params?: Record<string, string>) => Channel;
}) {
  const { t } = useTranslation();
  const { joined, joinError, sendOp, sendRole } = useRoomChannel(
    slug,
    selfId,
    selfName,
    channelFactory,
  );
  const storePresence = useAppSelector((state) => state.room.presence);
  const names = useAppSelector((state) => state.room.names);
  const members = useAppSelector((state) => selectSortedMembers(state.room));
  const roles = useAppSelector((state) => state.room.roles);
  const games = useAppSelector((state) => state.room.games);
  const presenter = useAppSelector((state) => selectPresenter(state.room));
  const presenterGameId = useAppSelector((state) => selectPresenterGameId(state.room));
  const presenterCursor = useAppSelector((state) => selectPresenterCursor(state.room));
  const activityOps = useAppSelector((state) => selectActivityOps(state.room));
  const myRole: MemberRole = useAppSelector((state) => selectRoleOf(state.room, selfId));
  const canEdit = useAppSelector((state) => selectCanEdit(state.room, selfId));
  const readOnly = useAppSelector((state) => state.room.readOnly);
  const firstGameId = useAppSelector((state) => selectFirstGameId(state.room));
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [showImport, setShowImport] = useState(false);

  const amPresenter = selfId !== null && presenter?.id === selfId;

  /**
   * Follow whenever someone else presents, until the viewer explicitly
   * follows or breaks away (`followOverride`).
   */
  const following =
    followOverride ?? (presenter !== null && (selfId === null || selfId !== presenter.id));

  /**
   * The game shown: the presenter's while following, otherwise the viewer's
   * own selection, defaulting to the first imported game.
   */
  const effectiveGameId = following
    ? (presenterGameId ?? firstGameId)
    : (activeGameId ?? firstGameId);
  const game = effectiveGameId === null ? null : (games[effectiveGameId] ?? null);
  const lastPlayedId = useAppSelector((state) => selectLastPlayed(state.room, effectiveGameId));
  const gameAnnotations = useAppSelector((state) =>
    effectiveGameId !== null
      ? (state.room.annotations[effectiveGameId] ?? NO_ANNOTATIONS)
      : NO_ANNOTATIONS,
  );

  const handleCursorChange = useCallback(
    (nodeId: number) => {
      // Read-only rooms (the demo) reject every op — don't even send cursor
      // updates; navigation is purely local there.
      if (!readOnly) {
        sendOp({ type: 'set_cursor', payload: { node_id: nodeId } });
      }
    },
    [sendOp, readOnly],
  );

  const handlePlayMove = useCallback(
    (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>, onError?: () => void) => {
      if (effectiveGameId !== null) {
        sendOp({ type: 'move_at_ply', payload: { game_id: effectiveGameId, ...payload } }, onError);
      }
    },
    [sendOp, effectiveGameId],
  );

  const handleComment = useCallback(
    (payload: Omit<CommentAtPlyOp['payload'], 'game_id'>) => {
      if (effectiveGameId !== null) {
        sendOp({ type: 'comment_at_ply', payload: { game_id: effectiveGameId, ...payload } });
      }
    },
    [sendOp, effectiveGameId],
  );

  const handleSetPosition = useCallback(
    (payload: Omit<SetPositionOp['payload'], 'game_id'>, onError?: () => void) => {
      if (effectiveGameId !== null) {
        sendOp(
          { type: 'set_position', payload: { game_id: effectiveGameId, ...payload } },
          onError,
        );
      }
    },
    [sendOp, effectiveGameId],
  );

  const handleAnnotations = useCallback(
    (set: BoardAnnotations, nodeId: number) => {
      if (effectiveGameId !== null) {
        sendOp({
          type: 'set_annotations',
          payload: {
            game_id: effectiveGameId,
            node_id: nodeId,
            arrows: set.arrows,
            highlights: set.highlights,
          },
        });
      }
    },
    [sendOp, effectiveGameId],
  );

  const handleImported = useCallback(
    (tree: GameTree) => {
      setFollowOverride(false);
      const gameId = crypto.randomUUID();
      sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
      setActiveGameId(gameId);
      setShowImport(false);
    },
    [sendOp],
  );

  function handleNewGame() {
    setFollowOverride(false);
    const gameId = crypto.randomUUID();
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree: emptyGameTree() } });
    setActiveGameId(gameId);
    setShowImport(false);
  }

  function handleSelectGame(gameId: string) {
    setFollowOverride(false);
    setActiveGameId(gameId);
    if (amPresenter) {
      sendOp({ type: 'select_game', payload: { game_id: gameId } });
    }
  }

  function handleSetRole(memberId: string, role: MemberRole) {
    sendRole(memberId, role);
  }

  const noGames = Object.keys(games).length === 0;

  if (joinError !== null) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div
          className={`${panel({ layout: 'none', pad: 'lg' })} flex w-full max-w-[min(100%,24rem)] animate-pop flex-col items-center gap-4 text-center`}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-raised">
            <span className="text-3xl text-bad-hi">⚠</span>
          </div>
          <h2 className="m-0 text-display font-bold">{t('room.notFoundTitle')}</h2>
          <p className="m-0 text-body text-muted">{t('room.notFound')}</p>
          <code className="w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-center font-mono text-lead tracking-[0.5em] text-faint">
            {slug.toUpperCase()}
          </code>
          <button type="button" className={button({ intent: 'secondary' })} onClick={onLeave}>
            {t('room.backHome')}
          </button>
        </div>
      </div>
    );
  }

  // Until the join reply arrives there is nothing to show yet — no roles,
  // no ops. Rendering the room now would flash the viewer's "Nothing to
  // analyse yet" empty state at the room's owner (and at joiners of rooms
  // that have games), so show a connecting state instead.
  if (!joined) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="m-0 flex items-center gap-2 text-body text-muted" role="status">
          <span className={statusDot({ tone: 'warn', pulse: true })} />
          {t('room.connecting')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-stretch gap-3 p-3">
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[236px_1fr]">
        {/*
          On wide screens the rail is pinned to the board's height: Games
          caps at a share of it, Members sizes to content, and Activity takes
          what is left — each scrolls inside its own panel, so the page never
          grows a body scrollbar.
        */}
        <aside className="flex flex-col gap-3 xl:h-[min(90vw,34rem)]">
          <GameList
            games={games}
            activeGameId={effectiveGameId}
            presenterGameId={presenterGameId}
            canEdit={canEdit}
            onSelectGame={handleSelectGame}
            onAddGame={() => setShowImport(true)}
            onNewGame={handleNewGame}
          />
          {!readOnly && (
            <MemberList
              members={members}
              roles={roles}
              presenterId={presenter?.id ?? null}
              myRole={myRole}
              selfId={selfId}
              onSetRole={handleSetRole}
            />
          )}
          <ActivityFeed ops={activityOps} presence={storePresence} names={names} />
        </aside>

        <section className="order-first flex flex-col items-center gap-4 md:order-none">
          {noGames ? (
            canEdit ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <div
                  className={`${panel({ layout: 'none', pad: 'lg' })} flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-4 text-center`}
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-raised">
                    <span className="text-3xl text-muted">♟</span>
                  </div>
                  <h2 className="m-0 text-display font-bold">{t('room.emptyTitle')}</h2>
                  <p className="m-0 text-body text-muted">{t('room.emptyOwner')}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      id="empty-import-button"
                      className={button({ intent: 'primary' })}
                      onClick={() => setShowImport(true)}
                    >
                      {t('room.emptyImport')}
                    </button>
                    <button
                      type="button"
                      id="empty-new-game-button"
                      className={button({ intent: 'secondary' })}
                      onClick={handleNewGame}
                    >
                      {t('room.emptyFresh')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8">
                <div
                  className={`${panel({ layout: 'none', pad: 'lg' })} flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-4 text-center`}
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-raised">
                    <span className="text-3xl text-muted">⏳</span>
                  </div>
                  <h2 className="m-0 text-display font-bold">{t('room.emptyViewerTitle')}</h2>
                  <p id="viewer-waiting" className="m-0 text-body text-muted">
                    {t('room.viewerWaiting')}
                  </p>
                  <span className={chip({ tone: 'gold' })}>
                    <span className={statusDot({ tone: 'warn', pulse: true })} />
                    {t('room.listening')}
                  </span>
                </div>
              </div>
            )
          ) : (
            <Analysis
              key={effectiveGameId ?? 'none'}
              tree={game}
              presenterId={presenter?.id ?? null}
              selfId={selfId}
              presenterCursorId={presenterCursor}
              following={following}
              canEdit={canEdit}
              onFollowChange={setFollowOverride}
              onCursorChange={handleCursorChange}
              onPlayMove={handlePlayMove}
              lastPlayedId={lastPlayedId}
              onComment={handleComment}
              onSetPosition={handleSetPosition}
              annotations={gameAnnotations}
              onAnnotations={handleAnnotations}
            />
          )}
        </section>
      </div>

      {showImport && (
        <ImportDialog onImported={handleImported} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
