"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { EngineReadout, EvalBar, useEngine } from "@/components/Engine";
import { ImportDialog } from "@/components/ImportDialog";
import { MoveList } from "@/components/MoveList";
import { Wordmark } from "@/components/Brand";
import {
  ActivityPanel,
  CommentPanel,
  GameInfoPanel,
  GameListPanel,
  MembersPanel,
  PanelShell,
} from "@/components/panels";
import { START_FEN, parseFen } from "@/lib/chess";
import { hueOf, ROLE_META, type Role } from "@/lib/identity";
import type { RoomState } from "@/lib/types";
import { buildTree, mainLine, pathTo, uciSquares } from "@/lib/tree";
import { button, chip, panelTitle, statusDot } from "@/ui/variants";

const POLL_MS = 2500;

export function RoomClient({ initial }: { initial: RoomState }) {
  const [state, setState] = useState<RoomState>(initial);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [follow, setFollow] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [recent, setRecent] = useState<number[]>([]);
  const [connection, setConnection] = useState<"live" | "retry">("live");
  const [engineOn, setEngineOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const knownNodes = useRef<Set<number>>(new Set(initial.nodes.map((n) => n.id)));

  const code = state.room.code;
  const role = state.you.role;
  const canEdit = role === "owner" || role === "collaborator";
  const isOwner = role === "owner";

  /* ----------------------------- live sync ------------------------------ */
  const merge = useCallback((next: RoomState) => {
    // Diff against what we already knew so remote moves can flash on arrival.
    const arrivals = next.nodes
      .map((n) => n.id)
      .filter((id) => !knownNodes.current.has(id));
    knownNodes.current = new Set(next.nodes.map((n) => n.id));
    if (arrivals.length) {
      setRecent(arrivals);
      window.setTimeout(() => setRecent([]), 1400);
    }
    setState(next);
  }, []);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        if (!response.ok) throw new Error("bad status");
        const data: RoomState = await response.json();
        if (!alive) return;
        setConnection("live");
        merge(data);
      } catch {
        if (alive) setConnection("retry");
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    tick();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [code, merge]);

  const act = useCallback(
    async (payload: Record<string, unknown>) => {
      setBusy(true);
      try {
        const response = await fetch(`/api/rooms/${code}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data?.state) merge(data.state as RoomState);
        return data;
      } finally {
        setBusy(false);
      }
    },
    [code, merge],
  );

  /* ------------------------------ derived ------------------------------- */
  const activeGame = useMemo(
    () => state.games.find((g) => g.id === state.room.activeGameId) ?? null,
    [state.games, state.room.activeGameId],
  );
  const tree = useMemo(() => buildTree(state.nodes), [state.nodes]);
  const nodeMap = useMemo(() => new Map(state.nodes.map((n) => [n.id, n])), [state.nodes]);
  const currentNode = currentId ? (nodeMap.get(currentId) ?? null) : null;
  const fen = currentNode?.fen ?? activeGame?.startFen ?? START_FEN;
  const position = useMemo(() => parseFen(fen), [fen]);
  const lastMove = currentNode ? uciSquares(currentNode.uci) : null;
  const path = useMemo(() => pathTo(state.nodes, currentId), [state.nodes, currentId]);
  const line = useMemo(() => mainLine(tree), [tree]);
  const { evaluation, status: engineStatus } = useEngine(fen, engineOn);

  const presenter = state.members.find((m) => m.userId === state.room.presenterId) ?? null;
  const presenting = Boolean(presenter && presenter.userId === state.you.id);

  const cursors = useMemo(() => {
    const map: Record<number, { name: string; hue: number }[]> = {};
    for (const member of state.members) {
      if (!member.online || !member.cursorNodeId || member.userId === state.you.id) continue;
      (map[member.cursorNodeId] ??= []).push({
        name: member.name,
        hue: hueOf(member.userId),
      });
    }
    return map;
  }, [state.members, state.you.id]);

  /* --------------------------- follow presenter -------------------------- */
  useEffect(() => {
    if (!follow || !presenter || presenter.userId === state.you.id) return;
    if (presenter.cursorNodeId !== currentId) setCurrentId(presenter.cursorNodeId);
  }, [follow, presenter, currentId, state.you.id]);

  /* ---------------------------- publish cursor --------------------------- */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch(`/api/rooms/${code}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "cursor", nodeId: currentId }),
      }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [code, currentId]);

  /* ----------------------------- navigation ------------------------------ */
  const goPrev = useCallback(() => {
    if (!currentNode) return;
    setCurrentId(currentNode.parentId);
  }, [currentNode]);

  const goNext = useCallback(() => {
    if (!currentId) {
      setCurrentId(tree[0]?.id ?? null);
      return;
    }
    const node = state.nodes.find((n) => n.parentId === currentId);
    if (node) setCurrentId(node.id);
  }, [currentId, state.nodes, tree]);

  const goFirst = useCallback(() => setCurrentId(null), []);
  const goLast = useCallback(() => {
    // follow the current path to its end, preferring the line we are on
    let cursor = currentId;
    let guard = 0;
    while (guard++ < 600) {
      const child = state.nodes.find((n) => n.parentId === cursor);
      if (!child) break;
      cursor = child.id;
    }
    setCurrentId(cursor ?? line[line.length - 1]?.id ?? null);
  }, [currentId, state.nodes, line]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [role='grid']")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "Home") {
        goFirst();
      } else if (event.key === "End") {
        goLast();
      } else if (event.key.toLowerCase() === "f") {
        setOrientation((o) => (o === "white" ? "black" : "white"));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, goFirst, goLast]);

  /* ------------------------------- actions ------------------------------- */
  async function playMove(from: string, to: string, promotion?: string) {
    if (!activeGame || !canEdit) return;
    const result = await act({
      type: "move",
      gameId: activeGame.id,
      parentId: currentId,
      from,
      to,
      promotion,
    });
    if (result?.nodeId) {
      setCurrentId(result.nodeId as number);
      setFollow(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${code}`,
      );
      setCopied(true);
      setAnnounce(`Room link for ${code} copied`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setAnnounce("Copy failed — select the code manually");
    }
  }

  const hasGame = Boolean(activeGame);

  /* -------------------------------- render ------------------------------- */
  return (
    <div className="flex min-h-screen flex-col bg-void xl:h-screen xl:overflow-hidden">
      {/* ------------------------------ header ----------------------------- */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
        <Wordmark size="sm" />
        <span className="hidden h-5 w-px bg-line-strong sm:block" />
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-ui font-semibold text-ink">{state.room.title}</h1>
          {activeGame && (
            <span className="hidden truncate text-note text-faint md:inline">
              {activeGame.white} – {activeGame.black}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/library" className={button({ intent: "ghost", size: "sm" })}>
            Library
          </Link>
          {isOwner ? (
            <div className="flex items-center gap-1 rounded-control border border-line-strong bg-raised pl-2">
              <span className="text-micro uppercase tracking-[0.1em] text-faint">code</span>
              <code className="font-mono text-ui font-bold tracking-[0.24em] text-gold-hi">
                {code}
              </code>
              <button
                type="button"
                onClick={copyCode}
                className={button({ intent: "ghost", size: "icon" })}
                aria-label={`Copy invite link for room ${code}`}
              >
                {copied ? <span className="text-ok-hi">✓</span> : "⧉"}
              </button>
            </div>
          ) : (
            <span className={chip({ tone: "outline" })}>room {code}</span>
          )}
          <span className="flex items-center gap-1.5 rounded-control border border-line bg-panel px-2 py-1">
            <span
              className={statusDot({
                tone: connection === "live" ? "ok" : "warn",
                pulse: connection !== "live",
              })}
            />
            <span className="max-w-[150px] truncate text-note text-muted">
              {state.you.name}
            </span>
            <span
              className={`text-[13px] leading-none ${ROLE_META[role].tone}`}
              title={ROLE_META[role].label}
            >
              {ROLE_META[role].glyph}
            </span>
          </span>
        </div>
      </header>

      {/* ------------------------------- body ------------------------------ */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 xl:grid-cols-[236px_minmax(560px,1fr)_340px]">
        {/* ------------------------- left rail ------------------------- */}
        <div className="order-2 grid min-h-0 grid-cols-1 gap-3 xl:order-1 xl:grid-rows-[minmax(120px,0.85fr)_minmax(120px,1fr)_minmax(120px,1.15fr)]">
          <GameListPanel
            games={state.games}
            activeId={state.room.activeGameId}
            canEdit={canEdit}
            onImport={() => setImportOpen(true)}
            onSelect={(id) => {
              setCurrentId(null);
              act({ type: "setGame", gameId: id });
            }}
          />
          <MembersPanel
            members={state.members}
            ownerId={state.room.ownerId}
            presenterId={state.room.presenterId}
            youId={state.you.id}
            canManage={isOwner}
            onRole={(userId, nextRole: Role) => act({ type: "role", userId, role: nextRole })}
          />
          <ActivityPanel activity={state.activity} youId={state.you.id} />
        </div>

        {/* --------------------------- board --------------------------- */}
        <main className="order-1 flex min-h-0 flex-col gap-2 xl:order-2">
          <div className="flex min-h-0 flex-1 justify-center">
            <div
              className="flex min-h-0 gap-2"
              style={{ width: "min(100%, calc(100vh - 11.5rem))" }}
            >
              <EvalBar evaluation={evaluation} status={engineStatus} />
              <div className="relative min-w-0 flex-1">
                <Board
                  fen={fen}
                  orientation={orientation}
                  lastMove={lastMove}
                  interactive={canEdit && hasGame}
                  onMove={playMove}
                  onAnnounce={setAnnounce}
                />
                {!hasGame && <EmptyBoardOverlay isOwner={isOwner} canEdit={canEdit} onImport={() => setImportOpen(true)} onBlank={() => act({ type: "blank" })} />}
              </div>
            </div>
          </div>

          <EngineReadout
            evaluation={evaluation}
            status={engineStatus}
            turn={position.turn}
            fullmove={position.full}
            onRetry={() => setEngineOn(true)}
          />

          {/* ------------------------ controls ------------------------ */}
          <nav
            aria-label="Board navigation"
            className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 rounded-panel border border-line bg-panel p-1.5"
          >
            <button type="button" onClick={goFirst} className={button({ size: "icon", intent: "ghost" })} aria-label="Go to start position" title="Start (Home)">⏮</button>
            <button type="button" onClick={goPrev} className={button({ size: "icon", intent: "ghost" })} aria-label="Previous move" title="Previous (←)">◀</button>
            <span className="tnum min-w-[86px] px-1 text-center text-note text-muted" aria-live="off">
              {path.length ? `ply ${path.length}/${line.length}` : "start"}
            </span>
            <button type="button" onClick={goNext} className={button({ size: "icon", intent: "ghost" })} aria-label="Next move" title="Next (→)">▶</button>
            <button type="button" onClick={goLast} className={button({ size: "icon", intent: "ghost" })} aria-label="Go to last move" title="End (End)">⏭</button>
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
              className={button({ size: "sm", intent: "ghost" })}
              aria-label={`Flip board, currently ${orientation} at the bottom`}
              title="Flip (F)"
            >
              ⇅ Flip
            </button>
            {isOwner ? (
              <button
                type="button"
                onClick={() => act({ type: "present", on: !presenting })}
                className={button({ size: "sm", intent: "ghost", active: presenting })}
                aria-pressed={presenting}
              >
                ◉ {presenting ? "Presenting" : "Present"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFollow((f) => !f)}
                className={button({ size: "sm", intent: "ghost", active: follow && Boolean(presenter) })}
                aria-pressed={follow}
                disabled={!presenter}
                title={presenter ? `Follow ${presenter.name}` : "Nobody is presenting"}
              >
                ⇢ {follow ? "Following" : "Follow"}
              </button>
            )}
            <span className="mx-1 h-5 w-px bg-line" />
            <button
              type="button"
              onClick={() => setEngineOn((e) => !e)}
              className={button({ size: "sm", intent: "ghost", active: engineOn })}
              aria-pressed={engineOn}
              title="Toggle the engine"
            >
              ♟ Engine
            </button>
          </nav>
        </main>

        {/* -------------------------- sidebar -------------------------- */}
        <aside className="order-3 flex min-h-0 flex-col gap-3">
          <CommentPanel
            node={currentNode}
            canEdit={canEdit}
            onSave={(nodeId, text) => act({ type: "comment", nodeId, comment: text })}
          />

          <PanelShell
            title="Moves"
            className="min-h-[220px] max-h-[45vh] flex-1 xl:max-h-none"
            action={
              <span className="flex items-center gap-1.5">
                <span className="text-micro text-faint tnum">{state.nodes.length} nodes</span>
                <button type="button" className={button({ intent: "ghost", size: "xs" })} title="Engine lines dock here next">
                  + Lines
                </button>
              </span>
            }
            bodyClassName="min-h-0"
          >
            <MoveList
              tree={tree}
              currentId={currentId}
              recentIds={recent}
              cursors={cursors}
              onSelect={(id) => {
                setCurrentId(id);
                setFollow(false);
              }}
            />
          </PanelShell>

          <GameInfoPanel
            game={activeGame}
            nodeCount={state.nodes.length}
            plies={line.length}
          />
        </aside>
      </div>

      {/* screen-reader live region for board + room events */}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <ImportDialog
        open={importOpen}
        busy={busy}
        onClose={() => setImportOpen(false)}
        onImport={async (pgn, source) => {
          await act({ type: "import", pgn, source });
          setImportOpen(false);
          setCurrentId(null);
        }}
      />
    </div>
  );
}

function EmptyBoardOverlay({
  isOwner,
  canEdit,
  onImport,
  onBlank,
}: {
  isOwner: boolean;
  canEdit: boolean;
  onImport: () => void;
  onBlank: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center rounded-[6px] bg-void/80 p-6 backdrop-blur-[3px]">
      <div className="max-w-[320px] text-center">
        <p className={panelTitle()}>{isOwner ? "Empty room" : "Nothing to analyse yet"}</p>
        <p className="mt-2 text-body text-muted">
          {canEdit
            ? "Import a PGN or a Lichess game, or start from the initial position and just play."
            : "Waiting for the owner to share a game. You'll see it appear here the moment they do."}
        </p>
        {canEdit && (
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={onImport} className={button({ intent: "primary", size: "sm" })}>
              Import a game
            </button>
            <button type="button" onClick={onBlank} className={button({ intent: "secondary", size: "sm" })}>
              Fresh board
            </button>
          </div>
        )}
        {!canEdit && (
          <p className="mt-4 flex items-center justify-center gap-2 text-note text-faint">
            <span className={statusDot({ tone: "warn", pulse: true })} /> listening for updates
          </p>
        )}
      </div>
    </div>
  );
}
