# Storage options — decision support (not a decision)

**Status:** input for the storage spike; no ADR yet. Read with
[the glossary](glossary.md) and [ADR-0010](decisions/adr-0010-weight-agnostic-search-index.md).

The system is in-memory today (ADR-0001). The search vision (position
corpus + weight-agnostic similarity index) forces a deliberate storage
choice: the corpus *is* the product, and "rebuild on boot from nothing"
doesn't apply to it. This document sizes the workload and compares the
realistic options.

## What drives the decision

From the glossary: a corpus of games; ~50 position occurrences per game; a
weight-agnostic index (positions decomposed into piece maps so user weights
apply at query time, never requiring reindexing); a Retrieval → Matching →
Ranking pipeline; exact + tolerant + structural similarity queries.

### The workload

- **Corpus**: N games → ~50N position occurrences. A curated corpus is
  ~10k games (~500k positions); Lichess-scale ambition is millions of games
  (tens of millions of positions).
- **Writes**: bulk imports (batched, bursty); tiny hot writes (profiles,
  room ops — those stay in-memory regardless).
- **Reads**: search = retrieve candidates by structural filters, then score
  them with user weights. Interactive latency target ~100 ms shapes the
  index design either way.
- **Key nuance**: the corpus is *rebuildable from source* (re-import the
  PGNs). Losing an index is annoying; losing identity is fatal. Durability
  requirements differ per data class.

### Data classes, and what actually needs the store

| Data | Durability need | Today |
|---|---|---|
| Rooms, presence, rate limits | none (ephemeral by design) | in-memory, stays |
| Profiles / future accounts | **hard** (identity) | in-memory |
| Game library | hard (user trust) | in-memory |
| Corpus + position index | **soft** (rebuildable) | doesn't exist yet |

## The realistic options

### 1. Embedded SQLite (+ LiteFS on Fly)

Zero separate infrastructure; ships inside the release; comfortably handles
millions of rows; read-heavy is its sweet spot. Single writer, which bulk
import tolerates (route writes to the LiteFS primary). Cheapest and closest
to today's single-artifact deploy. `ecto_sqlite3` exists if we want Ecto.

Best when: the corpus is curated/thousands-to-low-millions of positions and
zero-ops matters.

### 2. Postgres (Fly Postgres)

The conventional Phoenix path — but note it means reintroducing Ecto/a
Repo, which was deliberately removed. JSONB fits op logs and trees;
relational fits occurrence↔game joins; scoring in SQL is workable;
`pgvector` exists if scoring ever moves from explicit features to
embeddings. Cons: a second thing to run (volumes, snapshots, failover are
*ours* on Fly), and monthly cost.

Best when: we already know the corpus is Lichess-scale, or we want the
standard Ecto ecosystem.

### 3. Stay in-memory + disk snapshots

Nothing new to run; search over in-memory structures is as fast as it gets.
But memory caps the corpus (big indexes = big machines = real money),
snapshots are hand-rolled durability, and scale-to-zero gets awkward. Fine
for a demo corpus, wrong for the glossary's vision.

### 4. Typesense/Meilisearch/Elasticsearch

Wrong grain: they rank documents; the glossary's model is weighted feature
decomposition. We would fight the tool from day one.

## The questions that actually decide it

1. **Corpus ambition** — curated thousands of games, or bulk millions?
   *This one flips the recommendation; pin it first.*
2. **Scoring shape** — exact-feature arithmetic (SQL-friendly) forever, or
   embeddings/vectors plausibly later?
3. **Import pattern** — single bulk writer, or concurrent imports?
4. **Ops appetite** — zero-infra vs. willing to run a Postgres cluster.
5. **Search latency target** — interactive ~100 ms shapes the index design
   either way.

## Lean (input, not conclusion)

- **SQLite + LiteFS** if the corpus is "curated, thousands-to-low-millions
  of positions" and zero-ops matters.
- **Postgres** if we know we're bulk-importing Lichess DB, or we want the
  Ecto path with headroom.
- In-memory + snapshots only makes sense as a demo corpus.

Either way, rooms/presence/rate-limits stay in-memory — this decision only
covers the durable side (accounts, library, corpus, index).
