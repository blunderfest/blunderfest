# ADR-0026: PostgreSQL for the corpus, behind Blunderfest.Corpus (no Ecto)

Status: Accepted (2026-08-25)

## Context

ADR-0001 removed the database and put all state in memory, rebuilt on boot.
Its consequences named the trigger point for revisiting that decision:
features that require durability — "game library, saved analyses, corpus
search". The historical-evidence vertical slice is exactly that trigger:
canonical PGNs are durable corpus data, and occurrence indexes are derived
and rebuildable, which Spike 03 recommends hosting in one Fly Postgres.

Technical Spike 03's architecture splits persistence into three layers:
application data (Ecto), canonical corpus (Postgres), and derived indexes
(rebuildable, swappable). It recommended: one Fly Postgres; the corpus side
accessed through a single `Blunderfest.Corpus` boundary with **no Ecto**;
occurrence rows deletable/rebuildable at any time; the packed binary index
as the designated successor when the corpus outgrows Postgres.

The corpus Postgres was explicitly approved, and the Fly infrastructure is
live: cluster `blunderfest-db` (region `ams`, single node, non-HA), attached
to the `blunderfest` app with the `blunderfest` database; `DATABASE_URL` is
a deployed secret. Connectivity from the app machine was verified
(DNS, TCP 5432, and authenticated queries).

## Decision

PostgreSQL is introduced **for the corpus only**, behind the
`Blunderfest.Corpus` boundary, accessed via `Postgrex` — no Ecto, no Repo,
no `mix ecto.*` tasks. Canonical PGNs are durable; occurrences/indexes stay
derived and rebuildable (the PGN → moves → positions → indexes invariant
from the vertical-slice design). `DATABASE_URL` is parsed in
`config/runtime.exs` into `Blunderfest.Corpus` config, and prod fails fast
at boot if it is missing.

Application data (rooms, profiles, accounts, library) **stays in memory**
per ADR-0001. Ecto for application data remains a separate, unapproved
future decision — the only part of ADR-0001 that changes is the corpus
scope its consequences anticipated.

## Consequences

- Corpus search survives scale-to-zero: the database keeps canonical PGNs;
  everything derived rebuilds on boot.
- The index representation stays replaceable behind the boundary — the
  packed binary index can later swap in without touching application code.
- Scale-to-zero is no longer free: the Fly Postgres machine stays running
  (small standing cost), while the app still sleeps at zero.
- Dev without a local Postgres: corpus config is simply absent (no
  `DATABASE_URL`), which the corpus layer must handle gracefully.
- Prod deployments now require the `DATABASE_URL` secret (already deployed
  via `flyctl postgres attach`).
