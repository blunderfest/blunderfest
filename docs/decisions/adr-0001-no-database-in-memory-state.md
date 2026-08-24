# ADR-0001: No database — in-memory state rebuilt on boot

Status: Accepted (2026-08-04); corpus-scope superseded by ADR-0026

## Context

The app needs state (profiles, rooms, op logs) but ships as a single small app
on Fly.io with scale-to-zero (`auto_stop_machines`, `min_machines_running = 0`).
A scaled-to-zero instance loses all process memory, and the project values being
able to sleep at zero cost without losing anything critical. Introducing a
database (Ecto/Postgres) adds operational weight, migrations, and a second
service to run.

## Decision

No database. Ecto and Postgres dependencies are removed. All state lives in
in-memory GenServers (`Blunderfest.Profiles`, `Blunderfest.Rooms`) and is
rebuilt on boot. State is intentionally small and cheap to recompute.

## Consequences

- A scaled-to-zero instance loses nothing critical: rooms and profiles simply
  disappear and are created again on demand. Nothing durable is claimed.
- Boot is trivial; there are no migrations or data migrations.
- Room state and profiles are ephemeral by design. Features that require
  durability (game library, saved analyses, corpus search) cannot be built on
  the current store — they are the trigger points for revisiting this ADR.
- Reintroducing a database requires explicit approval and a new ADR.
