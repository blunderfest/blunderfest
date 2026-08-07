import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { games, members, nodes, rooms } from "@/db/schema";
import { viewerFromRequest } from "@/lib/server/identity";
import { findRoom, getRoomState, log, storeGame } from "@/lib/server/rooms";
import { parsePgn } from "@/lib/pgn";
import {
  applyMove,
  legalMoves,
  parseFen,
  squareIndex,
  START_FEN,
  toFen,
  toSan,
  uciOf,
} from "@/lib/chess";
import type { Role } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const viewer = viewerFromRequest(request);
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const type = String(body?.type ?? "");

  const [me] = await db
    .select()
    .from(members)
    .where(and(eq(members.roomId, room.id), eq(members.userId, viewer.id)))
    .limit(1);
  const role: Role = (me?.role as Role) ?? (room.ownerId === viewer.id ? "owner" : "viewer");
  const canEdit = role === "owner" || role === "collaborator";

  switch (type) {
    case "cursor": {
      const nodeId = body.nodeId === null ? null : Number(body.nodeId);
      if (me) {
        await db
          .update(members)
          .set({ cursorNodeId: Number.isFinite(nodeId) ? nodeId : null, lastSeen: new Date() })
          .where(eq(members.id, me.id));
      }
      break;
    }
    case "present": {
      if (role !== "owner")
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const on = Boolean(body.on);
      await db
        .update(rooms)
        .set({ presenterId: on ? viewer.id : null })
        .where(eq(rooms.id, room.id));
      await log(room.id, viewer, "present", on ? "started presenting" : "stopped presenting");
      break;
    }
    case "role": {
      if (role !== "owner")
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const target = String(body.userId ?? "");
      const next = String(body.role ?? "viewer") as Role;
      if (!["collaborator", "viewer"].includes(next))
        return NextResponse.json({ error: "bad_role" }, { status: 400 });
      const [row] = await db
        .update(members)
        .set({ role: next })
        .where(and(eq(members.roomId, room.id), eq(members.userId, target)))
        .returning();
      if (row) await log(room.id, viewer, "role", `made ${row.name} a ${next}`);
      break;
    }
    case "setGame": {
      const gameId = Number(body.gameId);
      const [game] = await db
        .select()
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.roomId, room.id)))
        .limit(1);
      if (!game) return NextResponse.json({ error: "no_game" }, { status: 404 });
      await db.update(rooms).set({ activeGameId: gameId }).where(eq(rooms.id, room.id));
      break;
    }
    case "blank": {
      if (!canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const [game] = await db
        .insert(games)
        .values({
          roomId: room.id,
          white: "White",
          black: "Black",
          event: body.title ? String(body.title).slice(0, 80) : "Fresh analysis",
          date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
          result: "*",
          startFen: START_FEN,
          source: "blank",
        })
        .returning();
      await db.update(rooms).set({ activeGameId: game.id }).where(eq(rooms.id, room.id));
      await log(room.id, viewer, "import", "started a fresh board");
      break;
    }
    case "import": {
      if (!canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const pgn = String(body.pgn ?? "");
      const parsed = parsePgn(pgn);
      if (!parsed.ok || !parsed.game)
        return NextResponse.json({ error: parsed.error ?? "parse_failed" }, { status: 400 });
      const game = await storeGame(room.id, parsed.game, viewer, String(body.source ?? "pgn"));
      return NextResponse.json({ ok: true, gameId: game.id });
    }
    case "move": {
      if (!canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const gameId = Number(body.gameId);
      const parentId = body.parentId === null ? null : Number(body.parentId);
      const from = String(body.from ?? "");
      const to = String(body.to ?? "");
      const promotion = body.promotion ? String(body.promotion) : undefined;

      const [game] = await db
        .select()
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.roomId, room.id)))
        .limit(1);
      if (!game) return NextResponse.json({ error: "no_game" }, { status: 404 });

      let parentFen = game.startFen;
      let ply = 1;
      if (parentId) {
        const [parent] = await db
          .select()
          .from(nodes)
          .where(and(eq(nodes.id, parentId), eq(nodes.gameId, gameId)))
          .limit(1);
        if (!parent) return NextResponse.json({ error: "no_parent" }, { status: 404 });
        parentFen = parent.fen;
        ply = parent.ply + 1;
      }

      const position = parseFen(parentFen);
      const fromIdx = squareIndex(from);
      const toIdx = squareIndex(to);
      const move = legalMoves(position, fromIdx).find(
        (m) => m.to === toIdx && (!m.promotion || m.promotion === (promotion ?? "q")),
      );
      if (!move) return NextResponse.json({ error: "illegal_move" }, { status: 400 });

      const san = toSan(position, move);
      const uci = uciOf(move);
      const fen = toFen(applyMove(position, move));

      const siblings = await db
        .select()
        .from(nodes)
        .where(
          and(
            eq(nodes.gameId, gameId),
            parentId === null
              ? sql`${nodes.parentId} is null`
              : eq(nodes.parentId, parentId),
          ),
        )
        .orderBy(asc(nodes.orderIdx));

      const existing = siblings.find((s) => s.uci === uci);
      if (existing) return NextResponse.json({ ok: true, nodeId: existing.id, existed: true });

      const [row] = await db
        .insert(nodes)
        .values({
          gameId,
          parentId,
          ply,
          san,
          uci,
          fen,
          authorId: viewer.id,
          authorName: viewer.name,
          orderIdx: siblings.length,
        })
        .returning();

      await log(
        room.id,
        viewer,
        "move",
        `${Math.ceil(ply / 2)}${ply % 2 === 1 ? "." : "..."} ${san}${
          siblings.length > 0 ? " (variation)" : ""
        }`,
      );
      return NextResponse.json({ ok: true, nodeId: row.id });
    }
    case "comment": {
      if (!canEdit) return NextResponse.json({ error: "forbidden" }, { status: 403 });
      const nodeId = Number(body.nodeId);
      const text = String(body.comment ?? "").slice(0, 2000);
      const [row] = await db
        .update(nodes)
        .set({ comment: text || null })
        .where(eq(nodes.id, nodeId))
        .returning();
      if (row)
        await log(
          room.id,
          viewer,
          "comment",
          text ? `commented on ${row.san}` : `cleared the note on ${row.san}`,
        );
      break;
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  const state = await getRoomState(code, viewer, { join: false });
  return NextResponse.json({ ok: true, state });
}
