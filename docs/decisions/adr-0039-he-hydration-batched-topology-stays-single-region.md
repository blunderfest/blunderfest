# ADR-0039: HE hydration batched behind the Corpus boundary; PG topology stays single-region

Status: Accepted (2026-09-05)

## Context

After the Packed Corpus v2 cutover, Historical Evidence's one remaining
bottleneck was PostgreSQL hydration across regions: ord `pg_ms` ≈ 9.5–10 s
vs ams ≈ 0.3 s. The pipeline fetched card data with two sequential queries
per card (`game/1` + `moves/1`, 22 cards) plus the menu's `moves_for` — 45
round trips, each paying the ~206 ms ord→ams RTT (measured ≥97% network
waiting, not SQL). The question on the table: fix the request shape, or
change the topology (read replica in ord, HE routing to ams, DB move).

## Decision

Fix the request shape. Card hydration is issued once per request through the
existing `Blunderfest.Corpus` boundary: a new bulk `games(gids)`
(`SELECT … FROM corpus_games WHERE gid = ANY($1)`, same shape as the
existing `moves_for`) plus one `moves_for` for the gids the menu batch did
not already cover. Duplicate gids are deduped; missing-row semantics (nil
game, empty mainline) and raise-on-database-error are preserved. With the
round-trip count at 2–3 per request, **no topology change is made**: the
single Fly Postgres stays in ams with app regions ams + ord.

## Consequences

- ord start HE: ~10 s → median 883 ms total / 753 ms `pg_ms`; both spike
  targets pass; output byte-identical (9/9 DTO parity, prod start DTO
  SHA-256 unchanged). The query count is now constant per request — it does
  not grow with corpus size or card count.
- The residual ord-vs-ams delta is ~3 WAN RTTs (~620 ms), the floor of this
  request shape through the serializing facade. If sub-250 ms ord HE ever
  becomes a product requirement, the smallest follow-up is a read replica in
  ord behind the same facade boundary — a new ADR, justified by new
  measurements, not this one.
- The facade emits `[:blunderfest, :corpus, :query]` telemetry for the
  PG-bound hydration kinds; `mix corpus.he_pg` keeps the round-trip census /
  RTT probe reproducible (`docs/technical-spike-he-postgres-hydration.md`).
