# Technical Spike 03 — Persistence Architecture: Report

Status: **done** (architecture decision report; no production code touched).
Spike brief: [`technical-spike-03-persistence.md`](technical-spike-03-persistence.md).
Evidence base: Spike 01
([report](technical-spike-01-position-retrieval-report.md) — store
benchmarks at 100k/1M/10M games), Spike 02 + 02b
([report](technical-spike-02b-relevance-analysis-report.md) — what the
future search engine actually needs to retrieve),
[`storage-options.md`](storage-options.md) (workload sizing, drafted as
decision support for this spike), and the current codebase (`lib/`).

> **TL;DR** — One PostgreSQL database (Fly Postgres, Ecto) holds the
> **application data**: profiles + external accounts, the game library,
> and the **canonical chess corpus** (games as PGN). Everything else
> derives from those: moves and position occurrences are *indexed data*
> rebuilt by extraction, and the search/index layer stays behind a
> `Corpus` boundary with no Ecto in it — later it can move to the
> purpose-built packed binary index from Spike 01 (proven: p50 12–16µs
> at up to 673M occurrences) without touching the application. Rooms,
> presence, and the op log stay in-memory exactly as today (ADR-0005);
> only their *durable exports* (a room snapshot on eviction) would ever
> be written. The split is *not* premature distributed architecture —
> it is one Postgres plus a rebuildable derived layer, which is the
> minimum that satisfies "canonical data must survive; indexes must be
> deletable" (brief §12).

---

## 1. Data model

The durable entities, their relationships, and where each lives:

```text
APPLICATION DATA (Postgres, transactional)          CHESS CORPUS (Postgres, bulk)

┌──────────────┐ 1     n ┌─────────────┐           ┌──────────────┐
│   profiles   │─────────│  accounts   │           │ corpus_games │
│ id, name,    │         │ type,       │           │ id, source,  │
│ created_at   │         │ username,   │           │ pgn, sha256, │
└──────┬───────┘         │ token, ...  │           │ meta(jsonb)  │
       │ 1               └─────────────┘           └──────┬───────┘
       │ n                                                │ derived, rebuildable
┌──────┴───────┐ 1     n ┌─────────────┐           ┌──────┴───────┐
│ library_games│─────────│ (tree json) │           │ occurrences  │
│ profile_id,  │         │  in row     │           │ (key, gid,   │
│ title, tree, │         └─────────────┘           │  ply) — in a │
│ saved_at     │                                   │ separate     │
└──────────────┘                                   │ index store  │
                                                   └──────────────┘
```

### 1.1 Profiles and accounts (known requirement)

Mirrors `Blunderfest.Profiles.Profile` and ADR-0004/0022 exactly:
`profiles` (id, name, created_at, secret hashes) and `accounts`
(type = lichess, username, access token, scopes, linked_at) with a
1..n relation. No PII beyond what ADR-0002/0004 already accept (a
public lichess handle + a server-side token). `LichessAuth` (OAuth flow
state, exchange codes) is ephemeral by design (ADR-0022) and is **not**
persisted.

**Finding (assumption challenged):** Profiles and Library are plain
local GenServers — but the app runs two Fly machines (`ams`, `ord`)
forming one Erlang cluster (ADR-0013). Every bearer-auth request hits
the *local node's* copy of the state, so a profile created on `ams`
does not authenticate on `ord` today. This works only because the
service is small and re-creating a profile is free (anonymous-first).
The moment profiles are durable this becomes a hard bug: **durable
identity also fixes a latent split-brain in the current in-memory
implementation** — the store becomes the single source of truth that
both regions read.

### 1.2 Game library (known requirement)

`library_games` (profile_id, title, tree JSONB, saved_at), one row per
saved game (ADR-0020). The tree is the same JSON shape ops use today
(`Blunderfest.Ops.valid_game_tree?`); the 256KB/50-entries caps become
DB-level constraints or soft checks. Re-keys from profile to account
exactly as ADR-0020 predicts; no schema change needed (accounts already
point at profiles).

### 1.3 Room exports (likely future, design for now)

Rooms, the op log, presence, and the sweeper stay in-memory (ADR-0005,
ADR-0016). Nothing in the brief or FEATURES.md requires durable rooms,
and making them durable would change the product's "ephemeral analysis
space" character. The one realistic durability need is **not losing
analysis when a room expires**: on eviction, optionally write one
`room_snapshots` row (slug, ops JSONB, ts) — append-only, capped,
restorable into a fresh room. Decision: *schema designed, not built*;
the op log already is a serializable event stream, so this is additive
and reversible.

### 1.4 Corpus games (known requirement — search is a marquee feature)

`corpus_games` (id, source, pgn, sha256, meta JSONB) where meta carries
players, Elos, result, date, event, ECO/opening, time control — the
fields Spike 01/02 extracted (`games-N.tsv`, `sim-games-N.tsv`).

**The PGN is canonical.** The brief asks whether the original PGN
should be the canonical representation — yes, with one refinement:
canonical means *the normalized mainline PGN we can re-parse and
re-verify*, not byte-preservation of the dump. Import validates by
replaying through the existing PGN pipeline (`Blunderfest.PGN` /
echecs, ADR-0019); a game that cannot be replayed is rejected at import,
not stored broken. The sha256 of the normalized PGN gives idempotent
imports (dedupe key). The lichess site id, when present, is a second
dedupe key (`sim-games` carries it: ~75MB per million games of metadata
vs ~280B average mainline SAN).

### 1.5 Positions and occurrences (derived — the answer to brief §4.2)

> Should positions be first-class persistent entities, or derived from
> games and indexed?

**Derived.** A position is fully determined by its canonical key
(placement + stm + castling + EP-if-capturable, Spike 01's golden-tested
convention); storing a `positions` table would duplicate information
that the extraction pass recomputes deterministically from PGN. What
*is* persisted is the **occurrence**: `(key, gid, ply)` — the fact that
"game G reached position K at ply P" — because that fact is exactly the
join between corpus and search, it is the thing access patterns need,
and it is far smaller than any first-class-position representation
(22B/occurrence packed; Spike 01).

The distinction the glossary draws (Position vs Position Occurrence)
survives: the *key* is the identity (virtual, recomputed), the
*occurrence* is the stored relational fact, and "which games reached
this position?" is an index lookup on the key — not a join through a
materialized positions table.

---

## 2. Canonical vs derived vs indexed

| Data | Class | Notes |
|---|---|---|
| Profile + account bindings | **canonical** | identity — losing it is fatal (storage-options) |
| Library games (trees) | **canonical** | user trust; re-keying target of ADR-0020 |
| Corpus game PGN + meta | **canonical** | the corpus *is* the product; rebuildable only by re-importing from source |
| Moves (SAN/UCI sequences) | **derived** | re-parsed from PGN on demand; mainline ≈ 280–380 B/game, no reason to persist separately |
| Position occurrences `(key, gid, ply)` | **indexed** | recomputable from PGN by extraction (Spike 01: 64–74k plies/s/core); 22B/occ packed |
| Prefilter buckets (pawn skeleton, material) | **indexed** | derived from the key itself; rebuilt with the index |
| Eval / analysis results | **derived** (cache) | engine output, recomputable; `set_analysis` ops are the transport, a cache table is a later optimization |
| Room op log / presence | **ephemeral** | stays in-memory (ADR-0005); optional durable snapshot on eviction (§1.3) |
| OAuth flow state | **ephemeral** | ADR-0022: deliberately never durable |

The layering principle (brief §6): `PGN → moves → positions → position
indexes` — every arrow is deterministic, so the system persists only the
head of the chain and regenerates the tail. This is the "rooms trick"
from storage-options.md, applied selectively: **derived/indexed data is
rebuildable *by design*, not merely by backup/restore.**

---

## 3. Access patterns

| # | Query | Frequency | Result size | Latency | Index needs |
|---|---|---|---|---|---|
| 1 | Authenticate profile (bearer) | every API call | 1 row | <10ms | PK on profiles, hash lookup |
| 2 | List library games | per profile visit | ≤50 rows | <50ms | (profile_id, saved_at) |
| 3 | Save/load library game | user action | 1 row (≤256KB) | <100ms | PK |
| 4 | Exact position: games reaching K | search feature; bursty | 0..5.8M occurrences (hot keys!) | interactive target ~100ms | key-indexed occurrences; **must cap/paginate** (Spike 01 #5) |
| 5 | Position with controlled differences (skeleton, material ±, tempo twins) | search feature | 0..~2000 candidates | ~100ms budget | prefilter buckets + live scoring (ADR-0010) |
| 6 | Continuation/history context (next/prev moves around an occurrence) | search + Reference tab | tens of rows | <100ms | occurrence → game → ply window |
| 7 | Retrieve full game PGN by id | every search result click | 1 row (~2–4KB) | <50ms | PK |
| 8 | Game metadata filters (player, Elo, date, ECO) | corpus browsing / search refinement | bounded by filters | <500ms | btree/gin on meta JSONB — later |
| 9 | Bulk corpus import | occasional, batch | 10⁵–10⁷ games | hours OK | idempotent by sha256 |
| 10 | Rebuild derived index | rare (strategy change) | 10⁶–10⁸ occurrences | hours OK | full scan; offline |

Read-dominant everywhere except import. Queries 1–3 and 7 are plain
Postgres bread and butter. Query 4 is the one Spike 01 measured
extensively: exact retrieval is interactive through 67M occurrences on
modest hardware if hot-key result sets are capped (p50 131µs at 1M
games on PG; the flatfile index stays best-in-class at 12–16µs but PG
is *good enough* while the corpus is ≤ a few million games). Query 5 is
ADR-0010's weight-agnostic retrieval: prefilter buckets narrow, live
scoring ranks — the index stores piece maps, never scores.

---

## 4. Scale assumptions

Order-of-magnitude estimates, assumptions stated (all corpus constants
are *measured* in Spikes 01/02, not guessed):

| Quantity | Estimate | Basis |
|---|---|---|
| Plies per game | ~67 | measured (all three tiers) |
| Metadata per game | ~75B (TSV) / ~150–200B (JSONB) | `games-N.tsv`, `sim-games-N.tsv` |
| Mainline SAN | ~280–380B/game | measured `sim-moves-100000.tsv` |
| PGN per game (raw dump) | ~2.1KB avg | 25GB / 11.7M games (2017-05 dump) |
| Occurrence size (packed) | 22B | Spike 01 flatfile |
| Occurrence size (PG table) | ~90B/row incl. index | Spike 01: 59GiB / 673M rows |
| Corpus target, year one | 1M games / 67M occurrences | curated subset of one month's dump |
| Corpus ambition (storage-options) | 10M games / 673M occurrences | full month; "Lichess-scale" |

| Tier | Corpus PGN | Occurrences (PG) | Occurrences (packed) | Verdict |
|---|---|---|---|---|
| 100k games | 0.2GB | 0.6GB | 0.14GB | trivial |
| 1M games | 2.1GB | 6.1GB | 1.4GB | fine on one PG (measured p50 131µs) |
| 10M games | 21GB | 59GB | 13.8GB | PG needs tuning/RAM (measured p50 1.5ms, p99 68s on 16GB laptop); packed index fine (p95 15.7ms) |

Application data is microscopic by comparison: 10k profiles × ~1KB =
10MB; a library of 50 games/profile is bounded by caps. **The corpus is
the only thing that scales; it lives in its own tables and its own
import path**, which is the whole reason the boundary in §7 exists.

Import throughput (measured): extraction is CPU-bound at 64–74k
plies/s/parallel-unit (~2.5h for 10M games on a laptop); PG COPY at
~250k rows/s. A 1M-game import is ~20 minutes of extraction + ~5 min
of COPY on commodity hardware — an occasional background job, not an
operational event.

Concurrent users: the app's scale (hobby project, rooms capped,
scale-to-zero) implies tens of concurrent searchers at most. Search
latency is dominated by index design, not connection count; PG's
default pooling is ample.

## 5. Database evaluation

### PostgreSQL — the recommendation

- **Relational modelling**: profiles/accounts/library are genuinely
  relational; corpus games are a classic bulk table; occurrences are a
  classic join table. No impedance mismatch anywhere.
- **JSONB**: library trees, corpus metadata, (later) room snapshots —
  schema-flexible where the shapes are still evolving.
- **Indexing**: btree on occurrence key (Spike 01 measured the exact
  pattern); GIN/JSONB paths for metadata filters when needed.
- **Transactions**: import idempotency (sha256 dedupe + insert-or-skip)
  and library/account mutations want ACID; PG gives it without design
  effort.
- **Elixir ecosystem**: Ecto is the well-trodden Phoenix path;
  `ecto_sql` + `Postgrex` are first-class. Reintroducing Ecto is the
  explicit "requires approval" clause of ADR-0001 — this report is that
  approval request.
- **Fly.io**: Fly Postgres is a supported pattern (not HA-managed, but
  snapshot/restore and volumes are provided); one region (`ams`,
  colocated with the app's primary), no read replicas needed at our
  scale. Cost: roughly $5–15/mo at hobby scale.
- **Suitability for chess data**: measured directly by Spike 01 —
  comfortable through ~1M games / 67M occurrences, workable beyond with
  capped result sets and tuning.

### Alternatives — only where a concrete reason exists (brief §8)

- **SQLite + LiteFS**: genuinely strong (Spike 01: it beat PG at the 1M
  tier on every axis) and zero-infrastructure. Rejected as the
  *application* store because: accounts/tokens want a real server
  (rotation, concurrent writers across two app machines, no LiteFS
  write-forwarding across regions); the corpus at ambition scale
  (10M+) wants the packed index anyway; and one durable technology is
  simpler than two. **Kept as the designated fallback**: if Fly Postgres
  proves operationally annoying, the `Corpus` boundary (§7) lets the
  corpus side swap to SQLite/flatfile without touching the app.
- **DuckDB**: wrong grain for interactive retrieval (Spike 01: point
  lookups plan as sequential scans). Right tool for offline corpus
  analytics (the prefilter-bucket design work). Not a primary store.
- **Typesense/Meilisearch/Elasticsearch**: wrong grain entirely — they
  rank documents; ADR-0010 needs weighted feature decomposition.
  Rejected (storage-options already reached this verdict).
- **pgvector / embeddings**: no current requirement; noted as a
  *possible* future ranking input. If it arrives, it arrives *inside*
  Postgres — one more reason PG is the safe default.
- **Graph databases, column stores, key-value stores**: no access
  pattern in §3 maps to them. Not evaluated further, per brief §8.

### The one-database-vs-two question (brief §9)

> Application DB + separate chess corpus/index store: necessary
> complexity, useful from day one, or design-for-later?

**Design-for-later, implemented-as-one.** The architecture draws the
*logical* boundary now (§7) but deploys one Postgres instance holding
both schemas. Rationale: at ≤1M games there is no performance reason to
separate (Spike 01); the cost of physical separation is real (second
service, second failure domain, cross-store consistency); but the cost
of *not drawing the logical boundary* is the real risk — the search
implementation leaking into profiles/library code and vice versa.
Separate *schemas*, separate *modules*, one *server* — until a trigger
fires (§10 open questions lists them).

## 6. Recommended architecture

```text
                        ┌──────────────────────────────────┐
                        │        Phoenix (Fly, ams+ord)    │
                        │  channels ▸ rooms (in-memory,    │
                        │  Horde, ADR-0013 — unchanged)    │
                        │  API ▸ profiles/library (Ecto)   │
                        └───────┬───────────────┬──────────┘
                                │               │
                     Ecto/Postgrex              Blunderfest.Corpus
                                │               │ (own module tree, no Ecto)
                                ▼               ▼
                   ┌────────────────────────────────────────┐
                   │   Fly Postgres (ams, 1 volume)         │
                   │   ┌──────────────┐  ┌───────────────┐  │
                   │   │ app schema   │  │ corpus schema │  │
                   │   │ profiles     │  │ corpus_games  │  │
                   │   │ accounts     │  │ occurrences*  │  │
                   │   │ library_games│  │ (*derived,    │  │
                   │   │ room_snaps?  │  │  rebuildable) │  │
                   │   └──────────────┘  └───────────────┘  │
                   └────────────────────────────────────────┘
                                          │ extraction job (rebuildable)
                                          ▼
                          ┌────────────────────────────┐
                          │ index layer (behind Corpus)│
                          │ v0: PG occurrences table   │
                          │ later: packed binary index │
                          │ (Spike 01 flatfile) if the │
                          │ corpus outgrows PG         │
                          └────────────────────────────┘
```

**The recommendation in one paragraph:** one Fly Postgres, accessed by
the application through Ecto (profiles, accounts, library — the
transactional data) and by the search side through a single
`Blunderfest.Corpus` module boundary that happens to also use Postgres
today. The corpus schema stores canonical PGNs (never deleted by
application code) plus derived occurrence rows (deletable and
rebuildable at any time). Rooms/presence/ops remain in-memory GenServers
exactly as now. The packed-binary index from Spike 01 is the designated
successor for the occurrence store, adopted when corpus size or query
mix demands it — a swap *behind* the Corpus boundary, invisible to the
application.

---

## 7. Search/index boundary

The requirement (brief §3, §13): the search engine must be able to
evolve — including *change its indexing strategy* — without forcing
changes throughout the application.

**The boundary is one module tree plus one rule:**

- `Blunderfest.Corpus` (public surface): `import_pgn/1`,
  `game/1`, `games_by_key/2` (capped), `index_status/0`,
  `rebuild_index/0`. Search internals live *under* it
  (`Corpus.Extraction`, `Corpus.Occurrences`, later
  `Corpus.PackedIndex`).
- **The rule: application code (controllers, channels, LiveView-less
  web layer, library, profiles) never writes SQL against the corpus
  schema and never learns the occurrence representation.** Ecto is
  allowed in `Corpus.*` (it is a convenience, not a leak), but the
  *schemas* are private to the boundary.
- Application data flows the other way through normal Ecto schemas
  (`Blunderfest.Accounts`, `Blunderfest.Library`) — no Corpus knowledge
  there.

Why this satisfies "clean boundary, not an abstraction framework"
(brief §13): there is exactly one interface, not a port/adapter stack.
The future evolutions Spike 02/02b predict — continuation clusters,
tempo-twin retrieval, plan signatures, a different bucket design, even
a move to the packed binary index — all change the *inside* of Corpus
(positions/indexes are derived, §2) or add functions to its surface;
none of them rewrites profiles, library, rooms, or the channel
protocol. The Reference tab (ADR-0024) already anticipates this: it
consumes "per-position continuations" as data, not as a search
implementation.

What deliberately does *not* exist yet: no search-ranking API, no
similarity query language, no embeddings. ADR-0010 stays
implementation-pending; this spike only guarantees the *storage* under
it is swappable.

## 8. Import strategy

The corpus arrives in bulk (multi-GB dumps), not through app requests
(brief §11). Import design:

1. **Acquire**: download a Lichess monthly dump (CC0) — Spike 01's
   pipeline already streams the 25GB zst.
2. **Extract & validate**: replay each game's mainline (echecs;
   64–74k plies/s measured); games that fail replay are skipped and
   *logged with reason* — never stored broken. Non-UTF-8 names are
   sanitized (Spike 01 #4).
3. **Idempotent write**: `INSERT ... ON CONFLICT (sha256) DO NOTHING`
   into `corpus_games`, batches inside a transaction per N games
   (e.g. 5k). Re-running an import is a no-op; interrupted imports
   resume by skipping already-present hashes — the dump is the
   checkpoint; no import-state table needed.
4. **Occurrences generated during import, in the same pass**, into the
   occurrences table (COPY for bulk speed, ~250k rows/s measured).
   Async-later is *available* (occurrences are derived; step 5 can
   regenerate them) but unnecessary at 1M scale where extraction+COPY
   is ~25 minutes. At 10M scale, decouple: import PGNs first, build
   occurrences as a separate resumable job (the brief's "generate
   asynchronously" option).
5. **Duplicates**: sha256 of normalized PGN (and lichess id when
   present) are the dedupe keys. Duplicate *positions* are not
   duplicates — they are the data (occurrence multiplicity is the
   corpus's whole point).
6. **Failure/resume**: per-game failures never sink the batch (same
   philosophy as `PGN.parse_many`); batch transactions bound retry
   cost; the source dump stays on disk until import reports success.
7. **Re-index later**: `rebuild_index/0` = truncate occurrences,
   re-run extraction over `corpus_games` (no re-download, no
   re-validation — canonical data is already home).

## 9. Rebuild strategy

The principle (brief §12): *expensive derived data must be deletable
and rebuildable from canonical data.* Concretely:

```text
corpus_games (canonical PGN)
      │ extraction (deterministic: PGN → canonical key per ply)
      ▼
occurrences (indexed)  ──truncate──►  rebuild: 1M games ≈ 25 min,
      │                              10M games ≈ 2.5–3h (measured bounds)
      ▼
prefilter buckets / future packed index / future similarity features
(all derived from occurrences or keys — same truncation story)
```

If the indexing strategy turns out wrong (Spike 02's cold-position
findings make this *likely* at least once), the recovery is: change the
extraction/index code, `rebuild_index/0`, ship. No user data, no
profiles, no library rows are touched — they live in the app schema
and don't depend on occurrences. Backups therefore prioritize the app
schema + `corpus_games` (small, precious); occurrence tables are
excluded from backup policy entirely (rebuildable — and at 6–59GB
they'd dominate backup size otherwise). Fly Postgres snapshots cover
the whole instance; a manual `pg_dump --table` regime for the app
schema is the belt-and-braces addition worth doing from day one.

Eval/analysis results (`set_analysis` ops) stay in the op log as
today; a durable eval-cache table is explicitly *not* built yet
(recomputable, and the engine pool already exists).

## 10. Open questions (deliberately undecided)

1. **Corpus curation**: which games make the cut for the *first* corpus
   (all of one month? Elo-filtered? mixed sources?) — a product
   decision, not a storage one; the schema doesn't care.
2. **Physical split trigger**: move occurrences to the packed binary
   index (or SQLite) when corpus > ~5–10M games, when import frequency
   makes PG rebuilds painful, or when a measured query mix needs the
   flatfile's tail latency. None apply today; the boundary keeps the
   option honest.
3. **Room snapshots**: build `room_snapshots` now or when users
   actually complain about expiring rooms? Schema sketched (§1.3),
   implementation deferred to product need.
4. **Full-text/metadata search** (player, event, ECO browsing): GIN
   indexes on the meta JSONB when a UI exists that needs it — not
   before (brief §15).
5. **Accounts**: durable accounts unblock cross-device library
   (ADR-0020's second half) — but whether to also persist the
   *profile secret hashes* now or keep hashing policy unchanged is an
   implementation detail for the accounts milestone, not this spike.
6. **A second corpus region**: irrelevant until there are users in
   `ord` complaining about search latency; the read path is already
   one hop from being region-cacheable.

## 11. Next step

**The smallest implementation step: make profiles durable.**

1. Add Ecto + Postgrex deps (this is the ADR-0001 amendment — a new
   ADR supersedes it for application data; rooms stay in-memory with
   the ADR updated to say so).
2. `profiles` + `accounts` tables; `Blunderfest.Profiles` becomes an
   Ecto-backed module *behind its existing function surface*
   (`create/authenticate/link_account/...` — callers unchanged).
3. Wire Fly Postgres into dev (docker) and prod (fly Postgres, `ams`).
4. Ship. Library persistence and the corpus then follow as separate,
   independently shippable milestones (library: swap `Library`
   GenServer for Ecto behind its surface; corpus: `Blunderfest.Corpus`
   + import of a first 100k-game slice, enabling the Reference tab's
   statistics upgrade).

This ordering is chosen deliberately: accounts are the smallest
durable entity set, they fix the latent two-region auth split (§1.1),
they are the dependency of the library's cross-device half, and they
exercise the whole Ecto/Fly-Postgres pipeline before the corpus — the
risky, large data — touches it.

---

## Appendix: assumption challenges (brief's closing instruction)

1. **"Which database?" was the wrong question — confirmed.** The brief
   suspected it; the analysis proves it: the decision splits into
   three independent ones (application store, canonical corpus,
   derived index) with different durability classes, and the honest
   answer bundles PostgreSQL (app + canonical) with *rebuildability*
   (index) rather than picking one technology for everything.
2. **storage-options.md's "SQLite looks strong" lean is overturned for
   the application store** — not on performance (Spike 01 actually
   favored SQLite) but on the two-machine cluster reality: profiles
   must be one source of truth across `ams`+`ord`, and LiteFS
   single-writer + cross-region write forwarding is the wrong shape
   for auth-path writes. SQLite remains the designated *corpus-side*
   fallback.
3. **"Positions as first-class entities" is rejected** (brief §4.2's
   open question): the glossary's Position/Occurrence distinction maps
   to *virtual identity (the key)* vs *stored fact (the occurrence row)*
   — a `positions` table would be canonical-data duplication with no
   access pattern that needs it.
4. **The current in-memory Profiles/Library have a latent split-brain
   on the two-region cluster** — durable storage isn't only about
   user-facing durability; it fixes a correctness bug that exists
   *today* (§1.1).
5. **"Import during load vs async" resolves by scale**: same-pass
   occurrence generation at ≤1M games (25 min, measured), decoupled
   resumable job beyond — a rare case where the brief's either/or has
   a clean size-based answer.
