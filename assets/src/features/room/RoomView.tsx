import type { Channel } from 'phoenix';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { pieceSrc } from '@/components/board';
import { button, chip, panel, statusDot } from '@/components/ui';
import Analysis from '@/features/analysis/Analysis';
import { gameToPgn } from '@/features/analysis/pgnExport';
import ImportDialog from '@/features/import/ImportDialog';
import ChatPanel from '@/features/room/ChatPanel';
import GameRail from '@/features/room/GameRail';
import PresenceStrip from '@/features/room/PresenceStrip';
import RegionChip from '@/features/room/RegionChip';
import RoomCodeChip from '@/features/room/RoomCodeChip';
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
import { RoomStoreProvider, useRoomSelector } from '@/store/roomContext';
import type { BoardAnnotations } from '@/store/roomStore';
import {
  selectCanEdit,
  selectEvidenceGids,
  selectFirstGameId,
  selectGameEntries,
  selectLastPlayed,
  selectLastPlayedBy,
  selectNextGameNumber,
  selectPresenter,
  selectPresenterCursor,
  selectPresenterGameId,
  selectRoleOf,
  selectSortedMembers,
} from '@/store/roomStore';

/**
 * Shared empty fallback for the annotations lookup below. Allocating `{}`
 * inside the selector would return a new reference on every update, causing
 * spurious re-renders.
 */
const NO_ANNOTATIONS: Record<number, BoardAnnotations> = {};

export default function RoomView({
  slug,
  onLeave,
  selfId = null,
  selfName = null,
  lichessLinked = false,
  channelFactory,
  headerSlot = null,
}: {
  slug: string;
  onLeave: () => void;
  selfId?: string | null;
  selfName?: string | null;
  /** Shows the "My Lichess studies" source in the import dialog (ADR-0022). */
  lichessLinked?: boolean;
  channelFactory?: (topic: string, params?: Record<string, string>) => Channel;
  /**
   * The app bar's room slot (ADR-0031): the Share button and presence strip
   * portal into it. Optional — tests render the room without the app shell.
   */
  headerSlot?: HTMLElement | null;
}) {
  const { joined, joinError, store, sendOp, sendRole, sendPresenter, sendAnalyze } = useRoomChannel(
    slug,
    selfId,
    selfName,
    channelFactory,
  );

  return (
    <RoomStoreProvider value={store}>
      <RoomViewInner
        slug={slug}
        onLeave={onLeave}
        selfId={selfId}
        lichessLinked={lichessLinked}
        headerSlot={headerSlot}
        joined={joined}
        joinError={joinError}
        sendOp={sendOp}
        sendRole={sendRole}
        sendPresenter={sendPresenter}
        sendAnalyze={sendAnalyze}
      />
    </RoomStoreProvider>
  );
}

function RoomViewInner({
  slug,
  onLeave,
  selfId = null,
  lichessLinked = false,
  headerSlot = null,
  joined,
  joinError,
  sendOp,
  sendRole,
  sendPresenter,
  sendAnalyze,
}: {
  slug: string;
  onLeave: () => void;
  selfId?: string | null;
  lichessLinked?: boolean;
  headerSlot?: HTMLElement | null;
  joined: boolean;
  joinError: string | null;
  sendOp: ReturnType<typeof useRoomChannel>['sendOp'];
  sendRole: ReturnType<typeof useRoomChannel>['sendRole'];
  sendPresenter: ReturnType<typeof useRoomChannel>['sendPresenter'];
  sendAnalyze: ReturnType<typeof useRoomChannel>['sendAnalyze'];
}) {
  const { t } = useTranslation();
  const members = useRoomSelector(selectSortedMembers);
  const roles = useRoomSelector((ctx) => ctx.roles);
  const games = useRoomSelector((ctx) => ctx.games);
  const gameEntries = useRoomSelector(selectGameEntries);
  const nextGameNumber = useRoomSelector((ctx) => selectNextGameNumber(ctx, t('room.unnamedGame')));
  const presenter = useRoomSelector(selectPresenter);
  const presenterGameId = useRoomSelector(selectPresenterGameId);
  const presenterCursor = useRoomSelector(selectPresenterCursor);
  const myRole: MemberRole = useRoomSelector((ctx) => selectRoleOf(ctx, selfId));
  const canEdit = useRoomSelector((ctx) => selectCanEdit(ctx, selfId));
  const readOnly = useRoomSelector((ctx) => ctx.readOnly);
  const analysisProgress = useRoomSelector((ctx) => ctx.analysisProgress);
  const firstGameId = useRoomSelector(selectFirstGameId);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  const [showImport, setShowImport] = useState(false);
  /**
   * The sidebar's active tab (ADR-0031), lifted here so it survives game
   * switches (Analysis remounts per game) and drives the chat unread badge.
   */
  const [sidebarTab, setSidebarTab] = useState('moves');
  /**
   * The chat read marker (an op seq). Replayed history is not unread — the
   * marker starts at the join-time tail; opening the Chat tab marks read.
   */
  const [chatReadSeq, setChatReadSeq] = useState<number | null>(null);
  const chatMessages = useRoomSelector((ctx) => ctx.chatMessages);
  const maxChatSeq = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1].seq : 0;

  // joined flips true only after the op-log replay lands (useRoomChannel),
  // so maxChatSeq at that moment is the history tail, not a live message.
  // biome-ignore lint/correctness/useExhaustiveDependencies: baseline once, at join
  useEffect(() => {
    if (joined && chatReadSeq === null) {
      setChatReadSeq(maxChatSeq);
    }
  }, [joined, chatReadSeq]);

  useEffect(() => {
    if (sidebarTab === 'chat') {
      setChatReadSeq(maxChatSeq);
    }
  }, [sidebarTab, maxChatSeq]);

  // Your own messages are never unread to you — otherwise the echo would
  // flash a badge on the Chat tab even when you just sent (and are looking
  // at) the message, in every tab that shares your identity.
  const chatUnread =
    chatReadSeq === null
      ? 0
      : chatMessages.reduce(
          (count, message) =>
            message.seq > chatReadSeq && message.author !== selfId ? count + 1 : count,
          0,
        );
  const chatBadge =
    chatUnread > 0 ? (
      <span
        className="rounded-chip bg-info/15 px-1 text-info tabular-nums"
        data-testid="chat-badge"
      >
        {chatUnread > 9 ? '9+' : chatUnread}
      </span>
    ) : undefined;
  /** The game just imported here — it opens on the initial position. */
  const [freshImportId, setFreshImportId] = useState<string | null>(null);
  /**
   * An in-flight multi-game import: the batch's first game (the pinned view)
   * plus all its game ids. Pins the importer's view until every echo lands —
   * `selectPresenterGameId` resolves the presenter's focus to the latest
   * `set_game`, so without the pin the viewed game (and the board) would flip
   * once per imported game. Cleared once the last echo is in the store.
   */
  const [importBatch, setImportBatch] = useState<{ firstId: string; ids: string[] } | null>(null);
  /**
   * Added historical games, keyed by room game id → the candidate's ply:
   * when such a game is opened it starts on the candidate's move, so it
   * can be compared against the analyzed position directly.
   */
  const [openAtPly, setOpenAtPly] = useState<ReadonlyMap<string, number>>(new Map());
  /**
   * The last locally viewed node per game (game id → node id). Analysis
   * unmounts on every game switch, so without this each switch back would
   * reopen the game at the tail — the user's place is per game, and it
   * comes back with them. Local only: never broadcast, never in the store.
   */
  const [cursorByGame, setCursorByGame] = useState<ReadonlyMap<string, number>>(new Map());
  /**
   * Optimistic trees for freshly added games, held until their `set_game`
   * echo lands in the store. Switching to a pending game without this
   * would pass `tree = null` to Analysis for a frame — the empty-state
   * flash seen when clicking "+".
   */
  const [pendingTrees, setPendingTrees] = useState<ReadonlyMap<string, GameTree>>(new Map());
  /**
   * Corpus game ids already in the room via the Examples dialog, derived
   * from the op log (`evidence_gid` on `set_game`) — every client agrees,
   * so a candidate one member picked shows "Added ✓" for everyone.
   */
  const evidenceGids = useRoomSelector(selectEvidenceGids);
  /**
   * Duplicate adds — the game was already in the room via another path
   * (an import, the analyzed game itself): no op is sent, so nothing
   * derives from the log. A local mark still flips the card to
   * "Added ✓" for the clicking client.
   */
  const [dedupedEvidenceGids, setDedupedEvidenceGids] = useState<ReadonlySet<number>>(new Set());
  const addedEvidenceGids = useMemo(
    () => new Set<number>([...evidenceGids, ...dedupedEvidenceGids]),
    [evidenceGids, dedupedEvidenceGids],
  );

  const amPresenter = selfId !== null && presenter?.id === selfId;

  /**
   * Follow whenever someone else presents, until the viewer explicitly
   * follows or breaks away (`followOverride`).
   */
  const following =
    followOverride ?? (presenter !== null && (selfId === null || selfId !== presenter.id));

  /**
   * The game shown: the presenter's while following, otherwise the viewer's
   * own selection, defaulting to the first imported game. During a multi-game
   * import the importer's view is pinned to the batch's first game
   * (`importAnchorId`): `selectPresenterGameId` resolves the presenter's
   * focus to the latest `set_game`, so without the anchor each echo would
   * flip the viewed game (and remount the board) once per imported game.
   */
  const effectiveGameId = following
    ? (presenterGameId ?? firstGameId)
    : (importBatch?.firstId ?? activeGameId ?? firstGameId);
  const game =
    effectiveGameId === null
      ? null
      : (games[effectiveGameId] ?? pendingTrees.get(effectiveGameId) ?? null);
  const analysis = useRoomSelector((ctx) =>
    effectiveGameId === null ? undefined : ctx.analysis[effectiveGameId],
  );
  const lastPlayedId = useRoomSelector((ctx) => selectLastPlayed(ctx, effectiveGameId));
  const lastPlayedBy = useRoomSelector((ctx) => selectLastPlayedBy(ctx, effectiveGameId));
  // Follow-the-tail only reacts to OTHER members' plays: your own variation
  // inserts (setup + line ops update lastPlayed too) must never yank the
  // cursor off the position being analyzed. The initial cursor on open
  // still uses the unfiltered `lastPlayedId`.
  const remoteLastPlayedId = lastPlayedBy !== null && lastPlayedBy !== selfId ? lastPlayedId : null;
  const gameAnnotations = useRoomSelector((ctx) =>
    effectiveGameId !== null
      ? (ctx.annotations[effectiveGameId] ?? NO_ANNOTATIONS)
      : NO_ANNOTATIONS,
  );

  // Release the import pin once every game in the batch has landed in the
  // store — from then on the normal selection/presenter logic owns the view.
  useEffect(() => {
    if (importBatch === null) {
      return;
    }
    if (importBatch.ids.every((id) => id in games)) {
      setImportBatch(null);
    }
  }, [importBatch, games]);

  // Drop optimistic trees once their echo lands (the store wins from then
  // on); the fallback below never reads them again. A failed op is cleared
  // from the same pass via the pruned id never resolving — harmless either
  // way, since the map only grows for ids that may still come.
  useEffect(() => {
    if (pendingTrees.size === 0) {
      return;
    }
    const landed = [...pendingTrees.keys()].filter((id) => id in games);
    if (landed.length > 0) {
      setPendingTrees((current) => {
        const next = new Map(current);
        for (const id of landed) {
          next.delete(id);
        }
        return next;
      });
    }
  }, [games, pendingTrees]);

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

  // The presenter's broadcast and the local record share the same signal
  // from Analysis; this one is the per-game memory (local only).
  const handleLocalCursor = useCallback(
    (nodeId: number) => {
      if (effectiveGameId === null) {
        return;
      }
      setCursorByGame((current) =>
        current.get(effectiveGameId) === nodeId
          ? current
          : new Map(current).set(effectiveGameId, nodeId),
      );
    },
    [effectiveGameId],
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
      const ids: string[] = [];
      const pending = new Map<string, GameTree>();
      for (const tree of trees) {
        const gameId = crypto.randomUUID();
        ids.push(gameId);
        pending.set(gameId, tree);
        sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
      }
      setPendingTrees((current) => new Map([...current, ...pending]));
      const firstId = ids[0] ?? null;
      if (firstId !== null) {
        // The op log leaves the presenter focus on the LAST set_game — so
        // after a multi-game import the room would watch game N while the
        // importer looks at game 1, unless the presenter re-points it.
        if (amPresenter && trees.length > 1) {
          sendOp({ type: 'select_game', payload: { game_id: firstId } });
        }
        setActiveGameId(firstId);
        setFreshImportId(firstId);
        // Pin the view to the first game until every echo lands, so the
        // board doesn't flip (remount) through each imported game in turn.
        if (trees.length > 1) {
          setImportBatch({ firstId, ids });
        }
      }
      setShowImport(false);
    },
    [sendOp, amPresenter],
  );

  function handleNewGame() {
    setFollowOverride(false);
    const gameId = crypto.randomUUID();
    // Auto-numbered default name, persisted as the tree's initial Title
    // header. The room-scoped counter is monotonic across the whole op log
    // (removed games included), and pending creates bump it too, so a
    // double "+"" never duplicates a number.
    const number = nextGameNumber + pendingTrees.size;
    const tree = {
      ...emptyGameTree(),
      headers: { Title: `${t('room.unnamedGame')} ${number}` },
    };
    sendOp({ type: 'set_game', payload: { game_id: gameId, tree } });
    setPendingTrees((current) => new Map(current).set(gameId, tree));
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

  /**
   * Removes a game from the room (owner/collaborators). The store drops the
   * tree when the echo lands; here we only fix the local selection — a
   * non-presenter viewing the removed game falls back to the next one so the
   * board never shows a game that is gone. Followers of the presenter get
   * the same fallback from `selectPresenterGameId`/`selectFirstGameId`,
   * which scan the applied log.
   */
  function handleRemoveGame(gameId: string) {
    if (!canEdit) {
      return;
    }
    sendOp({ type: 'remove_game', payload: { game_id: gameId } });
    if (activeGameId === gameId) {
      const fallback = Object.keys(games).find((id) => id !== gameId) ?? null;
      setActiveGameId(fallback);
      setFreshImportId((current) => (current === gameId ? null : current));
    }
  }

  /** Title-edit (own/co-owned games) rides the op log like any other edit. */
  function handleRenameGame(gameId: string, title: string) {
    if (!canEdit) {
      return;
    }
    sendOp({ type: 'rename_game', payload: { game_id: gameId, title } });
  }

  // The Examples dialog's "add to room": the historical game joins the
  // room as another game without stealing the view — the adder may want
  // to collect several games before looking at any of them. The game
  // appears in the Games panel; opening it starts on the candidate's
  // move. A game already in the room (imported earlier, or added in an
  // earlier dialog) is never sent again — the fingerprint check makes
  // duplicates a no-op. A presenting adder must re-point the room at the
  // game being viewed: `selectPresenterGameId` counts the presenter's
  // own `set_game` as focus, so without the restore the whole room would
  // follow the add.
  function handleAddHistoricalGame(tree: GameTree, ply: number, gid: number) {
    const fingerprint = gameToPgn(tree);
    if (Object.values(games).some((game) => gameToPgn(game) === fingerprint)) {
      // Already in the room — nothing to send; still mark it so the card
      // reports the truth ("Added ✓") instead of inviting a no-op click.
      setDedupedEvidenceGids((current) => new Set(current).add(gid));
      return;
    }
    const gameId = crypto.randomUUID();
    sendOp({
      type: 'set_game',
      payload: { game_id: gameId, tree, evidence_gid: gid },
    });
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

  const noGames = Object.keys(games).length === 0 && pendingTrees.size === 0;

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

  // The sidebar's Chat tab content (ADR-0031). Its handlers live here; the
  // dock slots it in. Chat is absent in read-only rooms (the demo, ADR-0014).
  const chatContent = readOnly ? undefined : (
    <ChatPanel
      onSend={handleChatSend}
      onDelete={handleChatDelete}
      canChat={canEdit}
      canModerate={myRole === 'owner'}
    />
  );

  // The games rail is hoisted OUT of the board region (empty CTA vs Analysis)
  // so it renders as the same element in the same position whether or not the
  // room has games. Before this, the first game added swapped the whole
  // empty-state tree for Analysis, remounting the rail — the "flicker".
  const rail = (
    <GameRail
      games={gameEntries}
      activeGameId={effectiveGameId}
      presenterGameId={presenterGameId}
      canEdit={canEdit}
      onSelectGame={handleSelectGame}
      onAddGame={() => setShowImport(true)}
      onNewGame={handleNewGame}
      onRemoveGame={handleRemoveGame}
      onRenameGame={handleRenameGame}
      presenterName={presenter?.name ?? null}
    />
  );

  return (
    <div className="flex flex-1 flex-col items-stretch">
      {/*
        The room's app-bar chrome: the code chip (the invite affordance —
        click copies the code), the presence strip, and the region chip —
        all chrome, no panels. Portaled so the handlers stay local to the
        room; the slot is optional so tests can render the room bare.
      */}
      {headerSlot !== null &&
        createPortal(
          <>
            <RoomCodeChip slug={slug} readOnly={readOnly} />
            {!readOnly && (
              <PresenceStrip
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
            <RegionChip />
          </>,
          headerSlot,
        )}

      {/*
        The games rail is rendered once, OUTSIDE the empty/populated branch,
        as the first child of the shared xl row — so adding the first game
        swaps only the board region (CTA ↔ Analysis), never the rail (the
        "flicker" was the rail remounting with the whole tree).
      */}
      <div className="analysis-scope flex w-full max-w-full flex-col">
        <div className="contents xl:flex xl:flex-row xl:items-stretch">
          {rail}
          {noGames ? (
            // No game yet: the board CTA where it will live. The middle slot is
            // the same flex-1 the board column takes — NOT a width derived from
            // --board-size (that var is viewport-height-driven and under-measures
            // the slot, which shoved the dock ~200px left of its populated
            // position). The CTA centers in the middle region so the empty room
            // prefigures the populated layout.
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4 xl:flex-row xl:items-stretch xl:gap-6">
                <div className="flex min-w-0 flex-1 items-center justify-center p-8">
                  {canEdit ? (
                    <div
                      className={`${panel({ layout: 'none', pad: 'lg' })} flex w-full max-w-[min(100%,24rem)] animate-pop flex-col items-center gap-4 text-center`}
                    >
                      <div className="grid h-16 w-16 place-items-center rounded-full border border-line bg-raised">
                        <img
                          src={pieceSrc({ color: 'w', kind: 'p' })}
                          alt=""
                          className="h-10 w-10"
                        />
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
                  ) : (
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
                  )}
                </div>
                {chatContent !== undefined && (
                  <aside
                    className="flex h-[46dvh] w-full max-w-[min(100%,24rem)] flex-col self-center border border-line bg-panel xl:h-[calc(100dvh-3.5rem)] xl:w-[360px] xl:max-w-none xl:self-auto xl:border-l xl:border-y-0 xl:border-r-0 2xl:w-[420px]"
                    data-tour="sidebar"
                    data-testid="room-sidebar"
                  >
                    {/*
                      No games yet: the dock is just the chat — a single
                      panel with a header, not a one-tab strip.
                    */}
                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <div className="flex h-9 shrink-0 items-center border-b border-line px-3 text-micro font-semibold uppercase tracking-[0.11em] text-muted">
                        {t('chat.title')}
                        {chatBadge}
                      </div>
                      {chatContent}
                    </section>
                  </aside>
                )}
              </div>
            </div>
          ) : (
            <Analysis
              key={slug}
              gameId={effectiveGameId}
              tree={game}
              presenterId={presenter?.id ?? null}
              selfId={selfId}
              presenterCursorId={presenterCursor}
              following={following}
              canEdit={canEdit}
              startAtRoot={effectiveGameId !== null && effectiveGameId === freshImportId}
              initialNodeId={
                effectiveGameId !== null
                  ? (cursorByGame.get(effectiveGameId) ?? openAtPly.get(effectiveGameId) ?? null)
                  : null
              }
              onFollowChange={setFollowOverride}
              onCursorChange={handleCursorChange}
              onLocalCursor={handleLocalCursor}
              onPlayMove={handlePlayMove}
              onComment={handleComment}
              onSetPosition={handleSetPosition}
              onAddLine={handleAddLine}
              onSetNags={handleSetNags}
              lastPlayedId={lastPlayedId}
              remoteLastPlayedId={remoteLastPlayedId}
              annotations={gameAnnotations}
              onAnnotations={handleAnnotations}
              onAnalyze={canEdit ? handleAnalyze : undefined}
              onAddHistoricalGame={canEdit ? handleAddHistoricalGame : undefined}
              addedEvidenceGids={addedEvidenceGids}
              analyzing={analyzing}
              analysis={analysis?.evals ?? null}
              activeSidebarTab={sidebarTab}
              onSidebarTabChange={setSidebarTab}
              chatTab={chatContent}
              chatBadge={chatBadge}
            />
          )}
        </div>
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
