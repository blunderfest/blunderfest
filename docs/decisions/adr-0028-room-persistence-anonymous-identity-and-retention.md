# ADR-0028: Room persistence — anonymous identity and retention

Status: Proposed (2026-08-26)

## Context

Rooms are the one thing a deploy still destroys: one process per room
(ADR-0012) across `ams`/`ord`, pure in-memory state (ADR-0001) — a
deploy, restart, or scale-to-zero loses every game, move, and message.
The approved remedy (PROJECT.md, queued) is the narrowest one that fits
the existing architecture: **write the room op log through to Postgres
and replay it on join**. ADR-0005 already makes the log authoritative
and join-replay the sync path; ADR-0026 already provides the Postgres
cluster and the no-Ecto pattern. Graceful handoff stays out of scope —
replay-on-join is the safety net, handoff is polish.

Persisting the log makes two things durable that were never durable
before: **who did things** (op `author` profile ids, role assignments,
chat) and **what they wrote** (chat text is user-generated content).
The app is anonymous-first (ADR-0004: fun names + device secrets,
salted hashes only, no PII) and has no retention story — the in-memory
design needed none, beyond ADR-0016 evicting idle+empty rooms after 1h.
This ADR decides identity, retention, and privacy before any
persistence code lands; the storage mechanics (write batching, failure
handling) are implementation detail that must satisfy this policy.

## Decision

Each point below is the proposed default, pending owner sign-off.

1. **What is stored.** The room's op log — `seq, type, payload, author,
   ts` — plus one room record per slug (`last_active_at`, the current
   `roles` map — roles are not op-log state today). `set_cursor` ops
   are **excluded** from the durable copy: throttled, high-volume, and
   meaningless on replay (the presenter's cursor re-broadcasts on
   rejoin). `delete_chat` ops stay in the log, so moderation survives
   replays (clients already filter deleted seqs, ADR-0023). Presence,
   presenter, and analysis progress stay ephemeral; the read-only demo
   room (ADR-0014) is never persisted — it re-seeds on demand.

2. **Author identity in a replayed log.** An op's `author` remains the
   raw profile id — profiles are re-created on demand when their device
   returns, and role checks keep working against the re-created id
   (ADR-0004 bearer auth). Because a returning profile may have changed
   its name (ADR-0022 rebinding), each persisted op also stores an
   **`author_name` snapshot** — the fun name at append time. Fun names
   are server-generated, not user input, so the snapshot is not PII;
   chat and the activity feed keep showing names instead of raw ids
   after a rejoin.

3. **Retention.** A durable room lives exactly as long as its
   in-memory self would have. Two purge paths: **(a) on eviction** —
   the ADR-0016 sweeper deletes the rows when it stops the room;
   **(b) a backstop** — rows whose `last_active_at` is older than the
   same 1h threshold **and** that have no live room process (a room
   orphaned by a machine restart nobody re-joins). A quiet room with
   open tabs keeps its process, so the backstop never touches it —
   mirroring ADR-0016's "idle *and* empty".

4. **Privacy.** Chat text is user-generated and may contain anything;
   the mitigation is the 1h retention of point 3, matching ADR-0004's
   "nothing personal is lost" posture and ADR-0016's expiry spirit.
   Nothing else is stored: no presence, no IPs, no analytics. If a
   longer window ever becomes the product goal, it is one constant —
   and requires revisiting this ADR.

5. **Where the rows live.** The existing Fly Postgres cluster
   (ADR-0026), new tables behind a small `Blunderfest.RoomLog` boundary
   with direct Postgrex — no Ecto, mirroring the Corpus boundary. This
   is a second, narrow exception to ADR-0001's no-database stance
   ("room logs survive deploys"), not a general app-data store;
   ADR-0001 and ADR-0026 get a one-line amendment naming it.

6. **Accepted on rejoin.** The session-scoped `names` map is rebuilt
   from the op snapshots (point 2). Viewer cursors reset to each
   client's last-played/initial node (the per-game cursor memory is
   client state). `seq` and `last_active_at` continue monotonically
   from the stored log, and the in-memory growth caps (ADR-0016, the
   5,000-op bound) keep capping the durable copy too.

## Consequences

- A deploy becomes a brief reconnect instead of data loss; the queued
  room-persistence foundation is unblocked, and graceful handoff
  remains optional polish.
- Replayed history reads correctly (name snapshots), and roles survive
  because they are persisted alongside the log.
- The store gains user-written chat text, bounded to 1h of idle life —
  a real privacy change, kept consistent with the existing expiry
  posture.
- Costs: one row per non-cursor op (batchable), two small sweeper
  responsibilities (eviction purge + backstop), and one new boundary
  module with its own tests.
