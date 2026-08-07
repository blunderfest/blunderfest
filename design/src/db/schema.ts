import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull().default("Untitled study"),
  ownerId: text("owner_id").notNull(),
  presenterId: text("presenter_id"),
  activeGameId: integer("active_game_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("collaborator"),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cursorNodeId: integer("cursor_node_id"),
  },
  (t) => [uniqueIndex("members_room_user").on(t.roomId, t.userId)],
);

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  white: text("white").notNull().default("White"),
  black: text("black").notNull().default("Black"),
  event: text("event").notNull().default("Casual game"),
  site: text("site"),
  date: text("date"),
  result: text("result").notNull().default("*"),
  eco: text("eco"),
  opening: text("opening"),
  startFen: text("start_fen").notNull(),
  source: text("source").notNull().default("pgn"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const nodes = pgTable(
  "nodes",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id").notNull(),
    parentId: integer("parent_id"),
    ply: integer("ply").notNull(),
    san: text("san").notNull(),
    uci: text("uci").notNull(),
    fen: text("fen").notNull(),
    comment: text("comment"),
    authorId: text("author_id"),
    authorName: text("author_name"),
    orderIdx: integer("order_idx").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("nodes_game_idx").on(t.gameId)],
);

export const activity = pgTable(
  "activity",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    kind: text("kind").notNull(), // join | leave | move | comment | import | role | present
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activity_room_idx").on(t.roomId)],
);
