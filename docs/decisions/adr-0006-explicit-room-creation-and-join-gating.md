# ADR-0006: Rooms are created explicitly via `POST /api/rooms`; joins never create rooms

Status: Accepted (2026-08-06)

## Context

Room URLs are `#/r/<code>`. Originally, joining a room implicitly created it:
anyone with a well-formed code could materialize a room just by visiting its
URL. That made the system trivially spammable (random codes → infinite rooms)
and meant a typo silently created a new empty room instead of failing. The
fix had to make room existence an explicit, server-side act.

## Decision

- **`POST /api/rooms`** (`BlunderfestWeb.RoomController`) is the only way a
  room comes into existence. It validates the code and returns `201 {"code": ...}`;
  malformed codes get `422 {"errors": {"code": "invalid_code"}}`. The first
  profiled creator (bearer-authenticated `profile_id`, optional) becomes the
  room's owner; anonymous creators leave the room ownerless.
- **`Rooms` never creates rooms implicitly.** `Rooms.claim/2` only registers
  a member in an existing room, and `room_exists?/1` is a first-class check.
- **`RoomChannel.join` gates in order**: code validity (`invalid_code`) → room
  existence (`room_not_found`) → approval. Unknown rooms are rejected with
  `{:error, %{reason: :room_not_found}}` and no state is created.
- The client follows suit: Home's "Create a room" button POSTs first and only
  navigates on success; a rejected join shows a "Room not found" screen with a
  way back home (`joinError` in `useRoomChannel`, not-found state in `RoomView`).

### Approval seam

`Rooms.approval_status/3` currently returns `:approved` for every join (rooms
are public). The channel already contains a `:pending` branch that replies
`%{status: "pending"}` and keeps the client joined without presence or ops —
the future mechanism for private rooms where the owner approves joins.
Unreachable today; kept so private rooms need no protocol redesign.

## Consequences

- Room existence is now intentional: deep links to uncreated rooms show "Room
  not found" instead of silently creating a room.
- Server state can never grow from URL traffic alone.
- Creating a room now requires a round trip (button shows a creating state and
  can fail), a small UX cost.
- The `room_not_found` error code is part of the API contract (ADR-0003).
