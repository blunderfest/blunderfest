# ADR-0012: One process per room

Status: Accepted (2026-08-10)

## Context

All room state — every op log and role map — lived in a single global
`Blunderfest.Rooms` GenServer. Every op append, join replay, and role check
across every room serialized through that one process (REVIEW.md finding 7).
Fine at current scale, but the known ceiling: one busy room would stall all
others, and the append path was O(n) per op (`ops ++ [op]`), degrading
quadratically inside a busy room (REVIEW.md finding 3).

## Decision

Each room is its own **`Blunderfest.Room` GenServer**, registered by slug in
a Registry and started on demand under a DynamicSupervisor.
`Blunderfest.Rooms` remains the public facade with the same API; its
functions take an optional `{registry, supervisor}` "scope" so tests run
isolated room sets without touching the application-wide pair.

- Ops are stored **prepended with a separate counter**: O(1) append and cap
  check, reversed on read.
- Room processes are **`:temporary`**: a crashed room is a lost room. That
  matches ADR-0001 — a scale-to-zero restart loses all rooms anyway, so a
  crash losing one room is the same failure mode at smaller blast radius.
- Reads tolerate a room dying between registry lookup and `GenServer.call`
  (return the empty default); writes retry once on a fresh process.

## Consequences

- Ops for different rooms proceed concurrently; the per-room process still
  serializes its own ops, which is exactly what `seq` ordering needs.
- The facade's contract is unchanged — the channel, controller, and demo
  seeder needed no changes.
- The local Registry/DynamicSupervisor pair was the stepping stone; ADR-0013
  swaps them for Horde to make rooms reachable across Fly regions.
