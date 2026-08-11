# ADR-0016: Idle, empty rooms expire

Status: Accepted (2026-08-11)

## Context

The growth caps (1,000 rooms, 5,000 ops per room) bounded memory but rooms
were never evicted: every created room lived until the next restart, so the
cap could be exhausted by abandoned rooms — and the cap exists precisely
because everything is in memory. The same hole blocked two product
conversations: per-visitor throwaway demo rooms (rejected in ADR-0014 partly
because each one would permanently consume a slot) and the observation that
the demo link was a one-click path to filling the cap.

## Decision

Rooms expire when they are **both idle and empty**:

- `Blunderfest.Room` tracks `last_active_at`, touched by joins, appends, and
  role changes.
- `BlunderfestWeb.RoomSweeper` (a tiny GenServer, one per node) ticks every
  minute and stops rooms that have been idle for **1 hour** *and* have no
  presence in their channel topic. A room with open tabs is never touched;
  a room with recent activity isn't either — only the combination expires.
- The sweeper lives in the web layer because membership is read from
  Phoenix Presence, which the domain must not depend on. Each node sweeps
  only the rooms hosted on it (`node(pid) == node()`).

An expired room's link gets the existing not-found screen, which already
says a room "may have expired".

## Consequences

- The room cap refills itself; abandoned rooms cost nothing beyond their TTL.
- The demo room sweeps like any other — unwatched it's idle by definition
  (read-only rooms track no presence), and the next visit re-seeds it on
  demand (ADR-0014), invisibly.
- Eviction only removes rooms nobody is looking at, matching ADR-0001's
  ephemerality; a partition can't make it over-eager, because stale presence
  entries fail safe (they *prevent* eviction).
- A per-visitor sandbox demo (ADR-0014's rejected alternative) is now
  unblocked should we want it.
- Follow-up: a creation rate limit on `POST /api/rooms` (ADR-0017).
