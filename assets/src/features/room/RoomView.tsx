import type { Channel } from 'phoenix';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pieceSrc } from '@/components/board';
import { button, chip, panel, statusDot } from '@/components/ui';
import Analysis from '@/features/analysis/Analysis';
import ImportDialog from '@/features/import/ImportDialog';
import ChatPanel from '@/features/room/ChatPanel';
import GameList from '@/features/room/GameList';
import MemberList from '@/features/room/MemberList';
import RoomPanel from '@/features/room/RoomPanel';
import { useRoomChannel } from '@/features/room/useRoomChannel';
import { emptyGameTree, type GameTree } from '@/lib/api';
import type {
  AddLineOp,
  CommentAtPlyOp,
  MemberRole,
  MoveAtPlyOp,
  SetNagsOp,
  SetPositionOp,
} from '@/protocol/ops';
import { useAppSelector } from '@/store';
import type { BoardAnnotations } from '@/store/room';
import {
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
  lichessLinked = false,
  channelFactory,
}: {
  slug: string;
  onLeave: () => void;
  selfId?: string | null;
  selfName?: string | null;
  /** Shows the "My Lichess studies" source in the import dialog (ADR-0022). */
  lichessLinked?: boolean;
  channelFactory?: (topic: string, params?: Record<string, string>) => Channel;
}) {
  const { t } = useTranslation();
  const { joined, joinError, sendOp, sendRole, sendPresenter, sendAnalyze } = useRoomChannel(
    slug,
    selfId,
    selfName,
    channelFactory,
  );
  const members = useAppSelector((state) => selectSortedMembers(state.room));
  const roles = useAppSelector((state) => state.room.roles);
  const games = useAppSelector((state) => state.room.games);
  const presenter = useAppSelector((state) => selectPresenter(state.room));
  const presenterGameId = useAppSelector((state) => selectPresenterGameId(state.room));
  const presenterCursor = useAppSelector((state) => selectPresenterCursor(state.room));
  const myRole: MemberRole = useAppSelector((state) => selectRoleOf(state.room, selfId));
  const canEdit = useAppSelector((state) => selectCanEdit(state.room, selfId));
  const readOnly = useAppSelector((state) => state.room.readOnly);
  const analysisProgress = useAppSelector((state) => state.room.analysisProgress);
  const firstGameId = useAppSelector((state) => selectFirstGameId(state.room));
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [showImport, setShowImport] = useState(false);
  /** The game just imported here — it opens on the initial position. */
  const [freshImportId, setFreshImportId] = useState<string | null>(null);
  /**
   * Added historical games, keyed by room game id → the candidate's ply:
   * when such a game is opened it starts on the candidate's move, so it
   * can be compared against the analyzed position directly.
   */
  const [openAtPly, setOpenAtPly] = useState<ReadonlyMap<string, number>>(new Map());

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
  const analysis = useAppSelector((state) =>
    effectiveGameId === null ? undefined : state.room.analysis[effectiveGameId],
  );
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

  const handleAddLine = useCallback(
    (payload: Omit<AddLineOp['payload'], 'game_id'>) => {
      if (effectiveGameId !== null) {
        sendOp({ type: 'add_line', payload: { game_id: effectiveGameId, ...payload } });
      }
    },
    [sendOp, effectiveGameId],
  );

  const handleChatSend = useCallback(
    (text: string) => {
      sendOp({ type: 'chat', payload: { text } });
    },
    [sendOp],
  );

  /** Chat moderation (ADR-0023): the owner deletes a message by its op seq. */
  const handleChatDelete = useCallback(
    (seq: number) => {
      sendOp({ type: 'delete_chat', payload: { seq } });
    },
    [sendOp],
  );

  const handleSetNags = useCallback(
    (payload: Omit<SetNagsOp['payload'], 'game_id'>) => {
      if (effectiveGameId !== null) {
        sendOp({ type: 'set_nags', payload: { game_id: effectiveGameId, ...payload } });
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
    (trees: GameTree[]) => {
      setFollowOverride(false);
      let firstId: string | null = null;
      for (const tree of trees) {
        const gameId = crypto.randomUUID();
        firstId ??= gameId;
        sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
      }
      if (firstId !== null) {
        // The op log leaves the presenter focus on the LAST set_game — so
        // after a multi-game import the room would watch game N while the
        // importer looks at game 1, unless the presenter re-points it.
        if (amPresenter && trees.length > 1) {
          sendOp({ type: 'select_game', payload: { game_id: firstId } });
        }
        setActiveGameId(firstId);
        setFreshImportId(firstId);
      }
      setShowImport(false);
    },
    [sendOp, amPresenter],
  );

  function handleNewGame() {
    setFollowOverride(false);
    const gameId = crypto.randomUUID();
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree: emptyGameTree() } });
    setActiveGameId(gameId);
    setFreshImportId(null);
    setShowImport(false);
  }

  function handleSelectGame(gameId: string) {
    setFollowOverride(false);
    setActiveGameId(gameId);
    setFreshImportId(null);
    if (amPresenter) {
      sendOp({ type: 'select_game', payload: { game_id: gameId } });
    }
  }

  // The Examples tab's "add to room": the historical game joins the room
  // as another game without stealing the view — the adder may want to
  // collect several games before looking at any of them. The game appears
  // in the Games panel; opening it starts on the candidate's move. A
  // presenting adder must re-point the room at the game being viewed:
  // `selectPresenterGameId` counts the presenter's own `set_game` as
  // focus, so without the restore the whole room would follow the add.
  function handleAddHistoricalGame(tree: GameTree, ply: number) {
    const gameId = crypto.randomUUID();
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
    setOpenAtPly((current) => new Map(current).set(gameId, ply));
    if (amPresenter && effectiveGameId !== null) {
      sendOp({ type: 'select_game', payload: { game_id: effectiveGameId } });
    }
  }

  function handleSetRole(memberId: string, role: MemberRole) {
    sendRole(memberId, role);
  }

  /**
   * Server-side analysis (ADR-0009): positions arrive computed from
   * Analysis — the mainline for whole-game (re-)analysis, an off-mainline
   * segment for "Analyze line". Forwarded to the engine pool as-is.
   */
  function handleAnalyze(positions: { ply: number; fen: string; node_id?: number }[]) {
    if (effectiveGameId === null) {
      return;
    }
    sendAnalyze(effectiveGameId, positions);
  }

  const analyzing =
    analysisProgress !== null && analysisProgress.gameId === effectiveGameId
      ? analysisProgress
      : null;

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
      <div className="relative grid flex-1 grid-cols-1 gap-3 md:grid-cols-[236px_1fr]">
        {/*
          On wide screens the rail is pinned to the analysis sidebar's
          height (board + nav/controls, the same +13rem the sidebar uses):
          Games caps at a share of it, Members sizes to content — each
          scrolls inside its own panel, so the page never grows a body
          scrollbar. The page is already that tall via the main column, so
          the taller rail spends dead space below it rather than growing
          the page. Chat never shrinks (shrink-0): a squeezed input row
          overflows its panel's bottom border.
        */}
        <aside className="flex flex-col gap-3 xl:h-[calc(min(90vw,34rem)+13rem)]">
          <RoomPanel slug={slug} onLeave={onLeave} />
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
              following={following}
              onFollowChange={setFollowOverride}
              onSetRole={handleSetRole}
              onSetPresenter={sendPresenter}
            />
          )}
          {!readOnly && (
            <ChatPanel
              onSend={handleChatSend}
              onDelete={handleChatDelete}
              canChat={canEdit}
              canModerate={myRole === 'owner'}
            />
          )}
        </aside>

        <section className="order-first flex flex-col items-center gap-4 md:order-none">
          {noGames ? (
            canEdit ? (
              // A lone call-to-action centers across the whole content area
              // on wide screens (lg+), not within the main column — the rail
              // stays clickable behind it. In-flow in the column below lg.
              <div className="flex flex-1 items-center justify-center p-8 lg:pointer-events-none lg:absolute lg:inset-0">
                <div
                  className={`${panel({ layout: 'none', pad: 'lg' })} flex w-full max-w-[min(100%,24rem)] animate-pop flex-col items-center gap-4 text-center lg:pointer-events-auto`}
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-raised">
                    <img src={pieceSrc({ color: 'w', kind: 'p' })} alt="" className="h-10 w-10" />
                  </div>
                  <h2 className="m-0 text-display font-bold">{t('room.emptyTitle')}</h2>
                  <p className="m-0 text-body text-muted">{t('room.emptyOwner')}</p>
                  <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:justify-center sm:self-auto">
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
              // Same centering as the owner's empty state: page-wide on lg+.
              <div className="flex flex-1 items-center justify-center p-8 lg:pointer-events-none lg:absolute lg:inset-0">
                <div
                  className={`${panel({ layout: 'none', pad: 'lg' })} flex w-full max-w-[min(100%,24rem)] flex-col items-center gap-4 text-center lg:pointer-events-auto`}
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
              startAtRoot={effectiveGameId !== null && effectiveGameId === freshImportId}
              initialNodeId={
                effectiveGameId !== null ? (openAtPly.get(effectiveGameId) ?? null) : null
              }
              onFollowChange={setFollowOverride}
              onCursorChange={handleCursorChange}
              onPlayMove={handlePlayMove}
              lastPlayedId={lastPlayedId}
              onComment={handleComment}
              onSetPosition={handleSetPosition}
              onAddLine={handleAddLine}
              onSetNags={handleSetNags}
              annotations={gameAnnotations}
              onAnnotations={handleAnnotations}
              onAnalyze={canEdit ? handleAnalyze : undefined}
              onAddHistoricalGame={canEdit ? handleAddHistoricalGame : undefined}
              analyzing={analyzing}
              analysis={analysis?.evals ?? null}
            />
          )}
        </section>
      </div>

      {showImport && (
        <ImportDialog
          onImported={handleImported}
          onClose={() => setShowImport(false)}
          lichessLinked={lichessLinked}
        />
      )}
    </div>
  );
}
