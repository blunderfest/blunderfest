"use client";

import { useState } from "react";
import { ROLE_META, hueOf, initialsOf, type Role } from "@/lib/identity";
import type { ActivityDto, GameDto, MemberDto, NodeDto } from "@/lib/types";
import {
  avatar,
  button,
  chip,
  listRow,
  panelHeader,
  panelTitle,
  statusDot,
  textarea,
} from "@/ui/variants";

export function PanelShell({
  title,
  action,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex min-h-0 flex-col rounded-panel border border-line bg-panel ${className}`}
    >
      <header className={panelHeader()}>
        <h2 className={panelTitle()}>{title}</h2>
        {action}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* --------------------------------- games --------------------------------- */

export function GameListPanel({
  games,
  activeId,
  onSelect,
  onImport,
  canEdit,
}: {
  games: GameDto[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onImport: () => void;
  canEdit: boolean;
}) {
  return (
    <PanelShell
      title={`Games (${games.length})`}
      action={
        canEdit ? (
          <button
            type="button"
            onClick={onImport}
            className={button({ intent: "ghost", size: "xs" })}
          >
            + Import
          </button>
        ) : null
      }
      bodyClassName="scroll-y"
    >
      {games.length === 0 ? (
        <p className="px-3 py-3 text-note text-faint">
          No games in this room yet.
        </p>
      ) : (
        <ul>
          {games.map((game) => (
            <li key={game.id}>
              <button
                type="button"
                onClick={() => onSelect(game.id)}
                aria-current={game.id === activeId ? "true" : undefined}
                className={listRow({
                  state: game.id === activeId ? "selected" : "default",
                })}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-semibold text-ink">
                    {game.white} <span className="text-faint">vs</span> {game.black}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-micro text-faint">
                    <span className="truncate">{game.event}</span>
                    <span aria-hidden>·</span>
                    <span className="tnum shrink-0">{game.plies} ply</span>
                    {game.nodeCount > game.plies && (
                      <span className="tnum shrink-0 text-info">
                        +{game.nodeCount - game.plies}
                      </span>
                    )}
                  </span>
                </span>
                <span className={chip({ tone: game.result === "*" ? "neutral" : "outline" })}>
                  {game.result}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

/* -------------------------------- members -------------------------------- */

export function MembersPanel({
  members,
  ownerId,
  presenterId,
  youId,
  canManage,
  onRole,
}: {
  members: MemberDto[];
  ownerId: string;
  presenterId: string | null;
  youId: string;
  canManage: boolean;
  onRole: (userId: string, role: Role) => void;
}) {
  const online = members.filter((m) => m.online).length;
  return (
    <PanelShell
      title={`Members (${online}/${members.length})`}
      action={
        <span className="flex items-center gap-1.5 text-micro text-faint">
          <span className={statusDot({ tone: "ok", pulse: true })} />
          live
        </span>
      }
      bodyClassName="scroll-y"
    >
      <ul>
        {members.map((member) => {
          const meta = ROLE_META[member.role];
          const presenting = presenterId === member.userId;
          return (
            <li
              key={member.userId}
              className={listRow({ state: "default" }) + " cursor-default"}
            >
              <span
                className={avatar({ presenting, away: !member.online })}
                style={{
                  background: `hsl(${hueOf(member.userId)} 45% 22%)`,
                  color: `hsl(${hueOf(member.userId)} 80% 78%)`,
                }}
                aria-hidden
              >
                {initialsOf(member.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span
                    className={`shrink-0 text-[15px] leading-none ${meta.tone}`}
                    title={`${meta.label} — ${meta.hint}`}
                    aria-label={meta.label}
                  >
                    {meta.glyph}
                  </span>
                  <span
                    className={`truncate text-ui ${
                      member.userId === youId ? "font-semibold text-ink" : "text-ink/90"
                    }`}
                  >
                    {member.name}
                  </span>
                  {member.userId === youId && (
                    <span className={chip({ tone: "outline" })}>you</span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-micro text-faint">
                  {presenting ? (
                    <span className={chip({ tone: "gold" })}>presenting</span>
                  ) : (
                    <span>{member.online ? "active" : "away"}</span>
                  )}
                </span>
              </span>
              {canManage && member.userId !== ownerId && (
                <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {member.role === "viewer" ? (
                    <button
                      type="button"
                      onClick={() => onRole(member.userId, "collaborator")}
                      className={button({ intent: "quiet", size: "xs" })}
                      title="Promote to collaborator"
                    >
                      Promote
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRole(member.userId, "viewer")}
                      className={button({ intent: "quiet", size: "xs" })}
                      title="Demote to viewer"
                    >
                      Demote
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}

/* -------------------------------- activity -------------------------------- */

const ACTIVITY_GLYPH: Record<ActivityDto["kind"], string> = {
  join: "\u2192",
  leave: "\u2190",
  move: "\u265E",
  comment: "\u201C",
  import: "\u2913",
  role: "\u2654",
  present: "\u25C9",
};

export function ActivityPanel({
  activity,
  youId,
}: {
  activity: ActivityDto[];
  youId: string;
}) {
  return (
    <PanelShell title="Activity" bodyClassName="scroll-y" className="min-h-0">
      <ol className="flex flex-col-reverse justify-end p-1" aria-live="polite">
        {activity
          .slice()
          .reverse()
          .map((event) => (
            <li
              key={event.id}
              className="flex items-start gap-2 rounded-chip px-2 py-1 text-note hover:bg-raised/70"
            >
              <span
                aria-hidden
                className={`mt-px w-3 shrink-0 text-center text-micro ${
                  event.kind === "move"
                    ? "text-gold"
                    : event.kind === "comment"
                      ? "text-info"
                      : "text-faint"
                }`}
              >
                {ACTIVITY_GLYPH[event.kind]}
              </span>
              <span className="min-w-0 flex-1 leading-snug text-muted">
                <span
                  className={
                    event.actorId === youId ? "font-semibold text-ink" : "text-ink/85"
                  }
                >
                  {event.actorId === youId ? "You" : event.actorName}
                </span>{" "}
                {event.detail}
              </span>
              <time
                className="shrink-0 tnum text-micro text-faint"
                dateTime={event.createdAt}
              >
                {new Date(event.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        {activity.length === 0 && (
          <li className="px-2 py-2 text-note text-faint">Nothing has happened yet.</li>
        )}
      </ol>
    </PanelShell>
  );
}

/* -------------------------------- comment --------------------------------- */

export function CommentPanel({
  node,
  canEdit,
  onSave,
}: {
  node: NodeDto | null;
  canEdit: boolean;
  onSave: (nodeId: number, text: string) => void;
}) {
  const [draft, setDraft] = useState(node?.comment ?? "");
  const [dirty, setDirty] = useState(false);
  const [synced, setSynced] = useState(`${node?.id ?? "none"}:${node?.comment ?? ""}`);

  // Re-sync during render (no effect): switching moves resets the editor, and a
  // remote edit lands immediately unless you have unsaved text of your own.
  const signature = `${node?.id ?? "none"}:${node?.comment ?? ""}`;
  if (signature !== synced) {
    const switchedMove = !synced.startsWith(`${node?.id ?? "none"}:`);
    if (switchedMove || !dirty) {
      setSynced(signature);
      setDraft(node?.comment ?? "");
      setDirty(false);
    }
  }

  const heading = node
    ? `${Math.ceil(node.ply / 2)}${node.ply % 2 === 1 ? "." : "\u2026"} ${node.san}`
    : "Start position";

  return (
    <PanelShell
      title="Comment"
      action={
        <span className="tnum text-micro text-faint">
          {node ? heading : "no move selected"}
        </span>
      }
      bodyClassName="p-2.5"
    >
      {!node ? (
        <p className="text-note text-faint">
          Select a move to write a note about it. Comments are shared instantly
          with the room.
        </p>
      ) : canEdit ? (
        <>
          <label className="sr-only" htmlFor="comment-editor">
            Comment on {heading}
          </label>
          <textarea
            id="comment-editor"
            rows={3}
            value={draft}
            placeholder={`Why is ${node.san} interesting?`}
            onChange={(event) => {
              setDraft(event.target.value);
              setDirty(true);
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                onSave(node.id, draft);
                setDirty(false);
              }
            }}
            className={textarea()}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-micro text-faint">
              {dirty ? "Unsaved · ⌘↵ to save" : "Saved for everyone"}
            </span>
            <span className="flex gap-1.5">
              {node.comment && (
                <button
                  type="button"
                  onClick={() => {
                    onSave(node.id, "");
                    setDraft("");
                    setDirty(false);
                  }}
                  className={button({ intent: "ghost", size: "sm" })}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                disabled={!dirty}
                onClick={() => {
                  onSave(node.id, draft);
                  setDirty(false);
                }}
                className={button({ intent: "primary", size: "sm" })}
              >
                Save
              </button>
            </span>
          </div>
        </>
      ) : (
        <p className="rounded-control border border-line bg-surface p-2.5 text-body text-muted">
          {node.comment || "No comment on this move yet."}
        </p>
      )}
    </PanelShell>
  );
}

/* ------------------------------- game info -------------------------------- */

export function GameInfoPanel({
  game,
  nodeCount,
  plies,
}: {
  game: GameDto | null;
  nodeCount: number;
  plies: number;
}) {
  if (!game)
    return (
      <PanelShell title="Game info" bodyClassName="p-3">
        <p className="text-note text-faint">No game loaded.</p>
      </PanelShell>
    );
  const rows: [string, string][] = [
    ["Event", game.event],
    ["Date", game.date ?? "—"],
    ["Result", game.result],
    ["Opening", game.opening ? `${game.eco ?? ""} ${game.opening}`.trim() : game.eco ?? "—"],
    ["Plies", `${plies} main · ${nodeCount} nodes`],
    ["Source", game.source],
  ];
  return (
    <PanelShell
      title="Game info"
      action={
        <button className={button({ intent: "ghost", size: "xs" })} type="button">
          Export PGN
        </button>
      }
      bodyClassName="p-3"
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-note">
        {rows.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-faint">{key}</dt>
            <dd className="truncate text-right text-muted tnum" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </PanelShell>
  );
}
