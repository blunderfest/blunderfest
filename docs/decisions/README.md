# Architecture Decision Records

An ADR is a short, dated record of a significant decision: the context, the
decision itself, and its consequences. They exist so future sessions (and
future us) can answer "why is it like this?" without reverse-engineering the
code or the git log.

## Rules

- **One ADR per decision.** Keep them small; a couple of paragraphs per section
  is plenty. No essay-writing.
- **Record decisions when they are made**, not when the work is done. If you
  revisit a decision, prefer a new ADR over rewriting history — mark the old
  one `Superseded by ADR-XXXX`.
- **ADRs describe reality.** If code and an ADR disagree, one of them is wrong;
  fix the one that is cheaper, usually the ADR.
- Future work that is decided but not yet implemented gets an ADR with status
  `Accepted — implementation pending`, so the intent is not lost.

## Template

```markdown
# ADR-00XX: Title

Status: Accepted (YYYY-MM-DD) | Proposed | Superseded by ADR-00YY

## Context

The situation that forced the decision. What was considered.

## Decision

What we chose to do. Short and concrete.

## Consequences

What it makes easier, and what it costs or blocks. Note what changed later
here, or point to the ADR that superseded this one.
```

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](adr-0001-no-database-in-memory-state.md) | No database — in-memory state rebuilt on boot | Accepted (2026-08-04); corpus-scope superseded by ADR-0026 |
| [0002](adr-0002-backend-serves-api-and-spa-no-ui.md) | Backend serves a JSON API + channel sockets and a bundled SPA; no server-rendered UI | Accepted (2026-08-04) |
| [0003](adr-0003-structured-error-codes-client-owns-copy.md) | The API returns structured error codes; the client owns all copy | Accepted (2026-08-04) |
| [0004](adr-0004-anonymous-first-profiles.md) | Anonymous-first profiles with device secrets, no stored PII | Accepted (2026-08-04) |
| [0005](adr-0005-op-log-room-synchronization.md) | Rooms synchronize via an append-only op log replayed on join | Accepted (2026-08-05) |
| [0006](adr-0006-explicit-room-creation-and-join-gating.md) | Rooms are created explicitly via `POST /api/rooms`; joins never create rooms | Accepted (2026-08-06) |
| [0007](adr-0007-room-code-format.md) | Room codes are 5 chars from an unambiguous alphabet, validated on both ends | Accepted (2026-08-06) |
| [0008](adr-0008-branch-structure-main-and-backup.md) | `main` is the active branch; `main_backup` archives the old history | Accepted (2026-08-06) |
| [0009](adr-0009-engine-strategy.md) | Engine strategy: Stockfish WASM in the browser, server-side UCI worker pool for batch analysis | Accepted (2026-08-04); interactive layer implemented (2026-08-06), batch pool implemented (2026-08-12) |
| [0010](adr-0010-weight-agnostic-search-index.md) | Search indexes weight-agnostic piece maps so user-configurable weights never require reindexing | Accepted — implementation pending |
| [0011](adr-0011-free-form-position-setup.md) | Free-form position editing via a `set_position` op replayed as a tree setup node | Accepted (2026-08-07) |
| [0012](adr-0012-per-room-processes.md) | One process per room, registered by slug and started on demand | Accepted (2026-08-10); registry/supervisor half superseded by ADR-0013 |
| [0013](adr-0013-clustered-rooms-via-horde.md) | Cluster the Fly machines; rooms reachable from every region via Horde | Accepted (2026-08-10) |
| [0014](adr-0014-read-only-demo-room.md) | The demo room is read-only (no owner, roles, or presence), at a reserved code, seeded on demand at join | Accepted (2026-08-11) |
| [0015](adr-0015-no-ownership-handoff.md) | No ownership handoff when the owner leaves; the room keeps working | Accepted (2026-08-11) |
| [0016](adr-0016-idle-rooms-expire.md) | Rooms expire after 1h idle *and* empty (sweeper reads Presence); links then report the room expired | Accepted (2026-08-11) |
| [0017](adr-0017-room-creation-rate-limit.md) | Room creation is rate-limited per client IP (fixed window, per node) | Accepted (2026-08-11) |
| [0018](adr-0018-server-understands-chess.md) | The server keeps first-class chess understanding (parsing, later materialization/search); the client is the interactivity layer, not the game authority | Accepted (2026-08-11) |
| [0019](adr-0019-echecs-dependency-posture.md) | Keep echecs (contained risk, server-side import parsing only); fork/vendor if it stalls | Accepted (2026-08-11) |
| [0020](adr-0020-anonymous-game-library.md) | Game library v1 on anonymous profiles, session-scoped (in-memory); re-keys to accounts when storage lands | Accepted (2026-08-11) |
| [0021](adr-0021-presenter-handoff.md) | The owner can hand presenting to another member; presence-derived fallback amends ADR-0015 | Accepted (2026-08-15) |
| [0022](adr-0022-external-identity-accounts.md) | External identity accounts (Lichess OAuth): User 1..n Account, link as recovery key not persona, in-memory until persistence lands | Accepted (2026-08-16) |
| [0023](adr-0023-chat-permissions-and-moderation.md) | Chat needs edit rights (viewers read along); the owner moderates via `delete_chat` ops | Accepted (2026-08-17) |
| [0024](adr-0024-reference-tab-and-search-destination.md) | Feature docking: per-position reference in an adaptive Reference tab; whole-game views in the viz box; search is a `#/search` destination | Accepted (2026-08-17) |
| [0025](adr-0025-room-first-surface-model.md) | Room-first: the library backs rooms but never becomes the home; ChessBase's IA yes, interaction model no | Accepted (2026-08-17) |
| [0026](adr-0026-postgres-corpus-behind-boundary-no-ecto.md) | PostgreSQL for the corpus, behind Blunderfest.Corpus via Postgrex — no Ecto; app data stays in-memory | Accepted (2026-08-25) |
