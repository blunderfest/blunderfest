import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activity, games, members, nodes, rooms } from "@/db/schema";
import { makeRoomCode, Role } from "@/lib/identity";
import type { ActivityDto, GameDto, MemberDto, NodeDto, RoomState } from "@/lib/types";
import type { Viewer } from "./identity";
import { summarize, type ParsedGame } from "@/lib/pgn";
import { START_FEN } from "@/lib/chess";

const ONLINE_WINDOW_MS = 45_000;

export async function createRoom(viewer: Viewer, title?: string) {
  let code = makeRoomCode();
  for (let attempt = 0; attempt < 6; attempt++) {
    const clash = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (clash.length === 0) break;
    code = makeRoomCode();
  }
  const [room] = await db
    .insert(rooms)
    .values({
      code,
      title: title?.trim() || "Untitled study",
      ownerId: viewer.id,
      presenterId: viewer.id,
    })
    .returning();

  await db.insert(members).values({
    roomId: room.id,
    userId: viewer.id,
    name: viewer.name,
    role: "owner",
  });
  await log(room.id, viewer, "join", "created the room");
  return room;
}

export async function log(
  roomId: number,
  viewer: Viewer,
  kind: ActivityDto["kind"],
  detail: string,
) {
  await db.insert(activity).values({
    roomId,
    kind,
    actorId: viewer.id,
    actorName: viewer.name,
    detail,
  });
}

export async function findRoom(code: string) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, code.toLowerCase()))
    .limit(1);
  return room ?? null;
}

export async function touchMember(roomId: number, viewer: Viewer, ownerId: string) {
  const [existing] = await db
    .select()
    .from(members)
    .where(and(eq(members.roomId, roomId), eq(members.userId, viewer.id)))
    .limit(1);

  if (!existing) {
    await db.insert(members).values({
      roomId,
      userId: viewer.id,
      name: viewer.name,
      role: viewer.id === ownerId ? "owner" : "collaborator",
    });
    await log(roomId, viewer, "join", "joined the room");
    return;
  }
  const stale = Date.now() - new Date(existing.lastSeen).getTime() > 5 * 60_000;
  await db
    .update(members)
    .set({ lastSeen: new Date(), name: viewer.name })
    .where(eq(members.id, existing.id));
  if (stale) await log(roomId, viewer, "join", "came back");
}

export async function getRoomState(
  code: string,
  viewer: Viewer,
  options: { join?: boolean } = {},
): Promise<RoomState | null> {
  const room = await findRoom(code);
  if (!room) return null;
  if (options.join) await touchMember(room.id, viewer, room.ownerId);

  const memberRows = await db
    .select()
    .from(members)
    .where(eq(members.roomId, room.id))
    .orderBy(asc(members.id));

  const gameRows = await db
    .select()
    .from(games)
    .where(eq(games.roomId, room.id))
    .orderBy(asc(games.id));

  const activeGameId =
    room.activeGameId ?? (gameRows.length ? gameRows[0].id : null);

  const nodeRows = activeGameId
    ? await db
        .select()
        .from(nodes)
        .where(eq(nodes.gameId, activeGameId))
        .orderBy(asc(nodes.ply), asc(nodes.orderIdx), asc(nodes.id))
    : [];

  const allCounts = await db
    .select({
      gameId: nodes.gameId,
      total: sql<number>`count(*)::int`,
      maxPly: sql<number>`coalesce(max(${nodes.ply}), 0)::int`,
    })
    .from(nodes)
    .groupBy(nodes.gameId);

  const countMap = new Map(allCounts.map((c) => [c.gameId, c]));

  const activityRows = await db
    .select()
    .from(activity)
    .where(eq(activity.roomId, room.id))
    .orderBy(desc(activity.id))
    .limit(40);

  const now = Date.now();
  const memberDtos: MemberDto[] = memberRows.map((m) => ({
    userId: m.userId,
    name: m.name,
    role: m.role as Role,
    lastSeen: m.lastSeen.toISOString(),
    cursorNodeId: m.cursorNodeId,
    online: now - new Date(m.lastSeen).getTime() < ONLINE_WINDOW_MS,
  }));

  const gameDtos: GameDto[] = gameRows.map((g) => ({
    id: g.id,
    white: g.white,
    black: g.black,
    event: g.event,
    site: g.site,
    date: g.date,
    result: g.result,
    eco: g.eco,
    opening: g.opening,
    startFen: g.startFen,
    source: g.source,
    plies: countMap.get(g.id)?.maxPly ?? 0,
    nodeCount: countMap.get(g.id)?.total ?? 0,
  }));

  const nodeDtos: NodeDto[] = nodeRows.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    ply: n.ply,
    san: n.san,
    uci: n.uci,
    fen: n.fen,
    comment: n.comment,
    authorName: n.authorName,
    orderIdx: n.orderIdx,
  }));

  const activityDtos: ActivityDto[] = activityRows
    .map((a) => ({
      id: a.id,
      kind: a.kind as ActivityDto["kind"],
      actorId: a.actorId,
      actorName: a.actorName,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    }))
    .reverse();

  const you = memberDtos.find((m) => m.userId === viewer.id);
  const version =
    (activityDtos.length ? activityDtos[activityDtos.length - 1].id : 0) * 1000 +
    nodeDtos.length +
    memberDtos.filter((m) => m.online).length;

  return {
    room: {
      code: room.code,
      title: room.title,
      ownerId: room.ownerId,
      presenterId: room.presenterId,
      activeGameId,
      createdAt: room.createdAt.toISOString(),
    },
    you: {
      id: viewer.id,
      name: viewer.name,
      role: you?.role ?? (room.ownerId === viewer.id ? "owner" : "viewer"),
    },
    members: memberDtos,
    games: gameDtos,
    nodes: nodeDtos,
    activity: activityDtos,
    version,
  };
}

/** Flattens a parsed PGN tree into rows and stores it. */
export async function storeGame(
  roomId: number,
  parsed: ParsedGame,
  viewer: Viewer,
  source: string,
) {
  const meta = summarize(parsed);
  const [game] = await db
    .insert(games)
    .values({
      roomId,
      white: meta.white,
      black: meta.black,
      event: meta.event,
      site: meta.site,
      date: meta.date,
      result: meta.result,
      eco: meta.eco,
      opening: meta.opening,
      startFen: parsed.headers["FEN"] ?? START_FEN,
      source,
    })
    .returning();

  interface Pending {
    node: (typeof parsed.root)[number];
    parentId: number | null;
    ply: number;
    order: number;
  }
  const queue: Pending[] = parsed.root.map((node, i) => ({
    node,
    parentId: null,
    ply: 1,
    order: i,
  }));

  while (queue.length) {
    const item = queue.shift() as Pending;
    const [row] = await db
      .insert(nodes)
      .values({
        gameId: game.id,
        parentId: item.parentId,
        ply: item.ply,
        san: item.node.san,
        uci: item.node.uci,
        fen: item.node.fen,
        comment: item.node.comment,
        authorId: viewer.id,
        authorName: viewer.name,
        orderIdx: item.order,
      })
      .returning();
    item.node.children.forEach((child, i) =>
      queue.push({ node: child, parentId: row.id, ply: item.ply + 1, order: i }),
    );
  }

  await db.update(rooms).set({ activeGameId: game.id }).where(eq(rooms.id, roomId));
  await log(
    roomId,
    viewer,
    "import",
    `imported ${meta.white} – ${meta.black} (${parsed.plies} plies)`,
  );
  return game;
}
