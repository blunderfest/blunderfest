# ADR-0020: Game library v1 — anonymous profiles, session-scoped

Status: Accepted (2026-08-11)

## Context

Milestone 6's remaining piece is room/game claiming and a per-profile game
library — "the reason to make an account at all" (PROJECT.md). Two tensions
shaped it:

1. Everyone is anonymous today. Profiles are a fun name + device secret
   (ADR-0004); linking games to *users* in any durable sense wants the
   future sign-in bridge.
2. Everything is in-memory (ADR-0001) and the storage decision is
   deliberately unmade — the search vision (docs/glossary.md) will force it,
   but it hasn't been taken yet.

So a durable, account-bound library can't be built yet; and building one on
an identity that evaporates on every deploy would teach users the shelf is
unreliable. But there are no users yet, and the library *mechanics* are
identity-agnostic.

## Decision

Ship the library on anonymous profiles, explicitly session-scoped:

- Any room member can **save a game** (its tree, analysis included) to
  their profile's library — a copy, independent of the room's lifecycle
  (rooms expire, ADR-0016).
- The home screen lists **Your games**; opening one creates a fresh room
  with the tree seeded at creation time (`POST /api/rooms` accepts an
  optional `tree`, validated like any `set_game`). Seeding at creation —
  rather than a post-join op — means no empty-room flash, and a one-time
  join retry absorbs cross-node registry lag for freshly created rooms.
- Storage is in-memory like everything else: **a saved game vanishes on
  restart/deploy**. Accepted for v1 — the demo track has no users to
  disappoint.
- When the storage decision lands (and the sign-in bridge with it), the
  library re-keys from anonymous profile to account. The mechanics don't
  change.

## Consequences

- Milestone 6 is complete without prejudging the storage/ADR-0001
  conversation.
- The library is honest about what it is: a shelf for this session's
  analysis, not a promise of forever. Copy should not claim persistence.
- Server-side caps apply (entries per profile, tree size) since memory is
  the budget.
