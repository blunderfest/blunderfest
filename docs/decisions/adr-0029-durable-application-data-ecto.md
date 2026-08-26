# ADR-0029: Durable application data — Ecto profiles, accounts, and library

Status: Accepted (2026-08-27)

## Context

Two in-memory GenServers hold application data: `Profiles` (anonymous
profiles + linked lichess accounts, ADR-0004/0022) and `Library`
(per-profile saved games, ADR-0020). Both vanish on every deploy, which
means profiles re-roll on scale-to-zero (a device silently becomes a new
identity — roles, the library, and account links all orphaned), and the
library's cross-device promise is unfulfilled. The cluster also has a
latent split-brain: `ams` and `ord` each hold their own copy, so a device
that talks to the other region gets a *different* profile (Spike 03 found
this). Rooms deliberately stay in-memory (ADR-0005); their survival is
already handled by the RoomLog mirror (ADR-0028). What remains is the
entity set Spike 03 scoped first: **profiles, accounts, the library** —
small, well-understood, and the exercise that unblocks the cross-device
half of the library.

Spike 03 settled the storage shape: **one Postgres (the Fly cluster we
already have), Ecto for application data**. The corpus (ADR-0026) and the
room log (ADR-0028) keep their Postgrex-direct boundaries — no Ecto
there; this decision deliberately reintroduces Ecto *only* for the
transactional application-data tables.

## Decision

1. **Ecto scope.** One `Blunderfest.Repo` (Ecto + ecto_sql, PostgreSQL)
   owns three tables: `profiles`, `accounts`, `library_entries` — and
   nothing else. ADR-0001 is superseded for application data;
   ADR-0026's "app data stays in-memory" wording is amended to match.
   Rooms, presence, the corpus, and the room log are unchanged.

2. **Schema.** Mirrors the in-memory structs exactly (Spike 03 §1.1):
   `profiles(id text pk, name, secret_hash, created_at)`;
   `accounts(profile_id fk, type, username, access_token, linked_at)`;
   `library_entries(id, profile_id fk, tree jsonb, saved_at)`. Profile
   ids keep today's server-generated format, so devices, op authors,
   and roles key on an unchanged identity — no client changes.

3. **Secrets.** Unchanged semantics: the server stores only the salted
   hash of the device secret (ADR-0004); the lichess account token is
   stored server-side as it already is in memory. No new PII beyond
   what ADR-0002/0004/0022 already accept.

4. **The GenServers go away.** `Profiles` and `Library` become plain
   modules over the Repo (same public API — `create/1`, `authenticate/2`,
   `link_account/2`, `save_game/2`, ...). `LichessAuth` stays ephemeral
   (ADR-0022). The library's fingerprint-based membership logic is
   unchanged; the table is just where the trees live now.

5. **The Repo is required.** Profiles are the app's entry point (every
   page load creates one), so a dual in-memory/DB mode doubles the
   surface for a rare configuration. Prod already fails fast without
   `DATABASE_URL`; dev/test point at the local docker Postgres (the
   setup `docs/operations.md` already documents). Migrations run at
   boot behind Ecto's advisory migration lock — safe on the two-node
   cluster, and deploys self-migrate.

6. **Retention.** None yet: profiles are anonymous (fun name + hash), so
   abandoned rows are low-risk; a prune-sweep can follow later. This is
   recorded as an open consequence, not a feature.

## Consequences

- The two-region split-brain is fixed: one durable profile per device
  secret, cluster-wide — and the library becomes cross-device for real.
- Deploys no longer re-roll identities: roles, account links, and saved
  games survive.
- Costs: Ecto in the dependency tree (bounded to one Repo), three
  tables, boot-time migrations, and rewritten `Profiles`/`Library`
  tests (they now need the docker test database, like the corpus
  tests).
- Open: orphaned-profile pruning; the durable canonical-corpus half of
  Spike 03 (the current corpus stays as-is until it needs to grow).
