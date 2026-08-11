# ADR-0014: Read-only demo room, reserved code, seeded on demand

Status: Accepted (2026-08-11)

## Context

The demo room at `#/r/chess` was an ordinary room seeded once at boot. That
had three problems: the first profiled visitor became its *owner* (and kept
the role after leaving, so the shared demo was permanently "claimed" by a
stranger); simultaneous visitors saw each other in the member list, so one
person's demo depended on whoever else was looking; and if the room process
(or its node) died, the one-shot boot seed never re-ran and the link 404'd
until a reboot.

The alternative considered was a fresh throwaway room per visitor (a full
sandbox the visitor owns, shareable to try live collaboration). Rejected for
now: rooms are never evicted (REVIEW.md #3), so every "peek" would
permanently consume one of the 1,000 room slots and the demo link would
become a one-click way to exhaust the room cap. It becomes attractive once
room eviction exists.

## Decision

The demo is a **read-only room** at a reserved code:

- The room is created with `read_only: true`; it records no members, so it
  never has an owner and `can_edit?` is false for everyone.
- The channel rejects *every* op push (even cursor noise) with `:read_only`,
  and tracks no presence — demo visitors don't see each other.
- The join reply carries `read_only: true`; the client hides the member
  list, sends no ops, and shows a "Demo" badge.
- `POST /api/rooms` rejects the reserved code with `code_reserved`, so the
  demo can never be hijacked through the create endpoint.
- Seeding happens **on demand**: the channel re-seeds before any join to
  the demo code (idempotent), so the room returns on the next visit after
  process or node loss. There is no boot-time seed task anymore.

## Consequences

- The demo is always the same annotated game for every visitor, can never
  be claimed, and self-heals — at the cost of being view-only: visitors can
  navigate, read comments, and run the engine, but cannot move pieces. The
  "try it yourself" path is creating a real room.
- Concurrent first-joins after a process loss can double-append the seed
  `set_game` op; it carries the same `game_id` and tree, so clients replay
  it idempotently. Benign by construction.
- A per-visitor sandbox demo remains a good idea once room eviction/TTL
  lands; this ADR doesn't block it.
