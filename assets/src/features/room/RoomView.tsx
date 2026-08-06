import type { Channel } from 'phoenix';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Analysis from '@/features/analysis/Analysis';
import ImportForm from '@/features/import/ImportForm';
import ActivityFeed from '@/features/room/ActivityFeed';
import GameList from '@/features/room/GameList';
import MemberList from '@/features/room/MemberList';
import RoomHeader from '@/features/room/RoomHeader';
import { useRoomChannel } from '@/features/room/useRoomChannel';
import { emptyGameTree, type GameTree } from '@/lib/api';
import type { CommentAtPlyOp, MemberRole, MoveAtPlyOp } from '@/protocol/ops';
import { useAppSelector } from '@/store';
import {
  selectActivityOps,
  selectCanEdit,
  selectFirstGameId,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  selectRoleOf,
  selectSortedMembers,
} from '@/store/room';

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
  const { joined, sendOp, sendRole } = useRoomChannel(slug, selfId, selfName, channelFactory);
  const storePresence = useAppSelector((state) => state.room.presence);
  const members = useAppSelector((state) => selectSortedMembers(state.room));
  const roles = useAppSelector((state) => state.room.roles);
  const games = useAppSelector((state) => state.room.games);
  const presenter = useAppSelector((state) => selectPresenter(state.room));
  const presenterGameId = useAppSelector((state) => selectPresenterGameId(state.room));
  const presenterCursor = useAppSelector((state) => selectPresenterCursor(state.room));
  const activityOps = useAppSelector((state) => selectActivityOps(state.room));
  const myRole: MemberRole = useAppSelector((state) => selectRoleOf(state.room, selfId));
  const canEdit = useAppSelector((state) => selectCanEdit(state.room, selfId));
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

  const handleCursorChange = useCallback(
    (nodeId: number) => sendOp({ type: 'set_cursor', payload: { node_id: nodeId } }),
    [sendOp],
  );

  const handlePlayMove = useCallback(
    (payload: Omit<MoveAtPlyOp['payload'], 'game_id'>) => {
      if (effectiveGameId !== null) {
        sendOp({ type: 'move_at_ply', payload: { game_id: effectiveGameId, ...payload } });
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

  function handleImported(tree: GameTree) {
    setFollowOverride(false);
    const gameId = crypto.randomUUID();
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
    setActiveGameId(gameId);
    setShowImport(false);
  }

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

  const showImportForm = Object.keys(games).length === 0 || showImport;

  return (
    <div className="flex flex-1 flex-col items-stretch gap-6 p-6">
      <RoomHeader slug={slug} joined={joined} onLeave={onLeave} />

      <div className="grid flex-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-6">
          <GameList
            games={games}
            activeGameId={effectiveGameId}
            presenterGameId={presenterGameId}
            canEdit={canEdit}
            onSelectGame={handleSelectGame}
            onAddGame={() => setShowImport(true)}
            onNewGame={handleNewGame}
          />
          {joined && (
            <MemberList
              members={members}
              roles={roles}
              presenterId={presenter?.id ?? null}
              myRole={myRole}
              selfId={selfId}
              onSetRole={handleSetRole}
            />
          )}
          <ActivityFeed ops={activityOps} presence={storePresence} />
        </aside>

        <section className="flex flex-col items-center gap-4">
          {showImportForm ? (
            canEdit ? (
              <ImportForm onImported={handleImported} />
            ) : (
              <p id="viewer-waiting" className="m-0 max-w-md text-center text-sm text-muted">
                {t('room.viewerWaiting')}
              </p>
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
              onComment={handleComment}
            />
          )}
        </section>
      </div>
    </div>
  );
}
