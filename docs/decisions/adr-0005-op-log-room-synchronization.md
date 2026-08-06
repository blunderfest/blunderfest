# ADR-0005: Rooms synchronize via an append-only op log replayed on join

Status: Accepted (2026-08-05)

## Context

A room is a shared, real-time analysis session: several people import games,
move cursors, play moves, comment, and draw arrows together. Two naive
alternatives were rejected: broadcasting whole-document snapshots (last-writer-
wins, loses concurrent edits and has no undo history) and per-field CRDT
conflict resolution (complex, overkill for a canvas of moves and annotations).

## Decision

- **Authoritative room state is the room's operation log**: `%{seq, type, payload, author, ts}`,
  stored per room slug in the `Blunderfest.Rooms` GenServer. Ops are appended
  in strict `seq` order.
- **Clients replay the log on join**, then subscribe to new ops. Late join,
  reconnect, crash recovery, and undo timeline all fall out of replaying from
  the last seen `seq`.
- Operations are granular: `set_game`, `move_at_ply`, `comment_at_ply`,
  `select_game`, `set_cursor`, `set_role`, … Conflicts collapse naturally
  because moves/variations are keyed by ply.
- **The server echo is the single application path**: the client pushes an op,
  the server validates and appends it, and every client (including the sender)
  applies it from the `new_op` echo. There is exactly one place where state
  changes.
- Presence (who is in the room, names) uses **Phoenix Presence**; cursor
  movement is throttled.
- Frontend state mirrors the log via **Redux Toolkit** (`applyOp`, `replayOps`),
  with op types shared between server and client as TypeScript unions in
  `assets/src/protocol/ops.ts`.

## Consequences

- Deterministic state: any client can reconstruct the room from the log —
  trivial to test, replay, and debug.
- The op log is append-only, so "undo" is achievable later by appending a
  compensating op or re-basing, without mutating history.
- The protocol between server and client is the heart of the system and must
  be versioned with care; new op types need both ends updated together.
- Because state is a log of intent (not just moves), features like an activity
  feed fall out for free.
