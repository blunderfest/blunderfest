# ADR-0017: Rate-limit room creation

Status: Accepted (2026-08-11)

## Context

The last open item from both reviews: `POST /api/rooms` is anonymous and had
no throttle, so a script could create rooms until the 1,000-room cap
(REVIEW.md #3) rejected everyone. Eviction (ADR-0016) shrinks the exposure
window but doesn't prevent the burst.

## Decision

A small fixed-window limiter (`Blunderfest.RateLimit`, a GenServer):
**10 creations per minute per client IP**, with 429 `rate_limited` beyond
that. Choices worth recording:

- **Hand-rolled, not a library** (Hammer et al.): the project avoids new
  dependencies for something this small, and the fixed-window map plus a
  periodic prune is ~60 lines with tests.
- **Per-node, not cluster-wide**: each Fly machine keeps its own buckets, so
  the effective cluster limit is per-node × nodes. For abuse mitigation
  that's plenty, and it needs no distribution.
- **Per client IP** (`Fly-Client-IP` behind the proxy, peer IP locally),
  keyed on the creation endpoint only. Joins, ops, and profile creation
  stay unthrottled — the room cap itself bounds their cost.
- Windows reset on boot like all state (ADR-0001).

## Consequences

- The cap can no longer be exhausted by a single scripted client; combined
  with eviction, room availability is self-healing.
- Legit bursts behind a shared NAT could theoretically hit 10/min; the
  client shows a specific "try again in a minute" message.
- If per-visitor demo rooms ever ship (ADR-0014's alternative), the demo
  flow creates a room per click and this limit applies to it — 10/min is
  generous for humans but the number may want revisiting then.
- Both reviews are now fully closed; the only standing watch item is the
  `echecs` 0.1 dependency (REVIEW.md #5).
