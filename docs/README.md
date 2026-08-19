# Documentation

The documentation lives here, next to the code it describes. `PROJECT.md` at the
repo root remains the roadmap and single entry point for new sessions; this
directory holds the durable record of how and why the system is built.

## What lives here

| Path | Contents |
|---|---|
| `architecture.md` | How the system is put together: components, data flow, real-time model, frontend structure. Read this before reading code. |
| `operations.md` | Branches, deploy, local dev, verification commands. |
| `decisions/` | Architecture Decision Records (ADRs) — one file per decision, most recent first. |
| `storage-options.md` | Decision support for the future durable store (corpus, index, accounts): workload, options, deciding questions. Not a decision. |
| `technical-spike-01-position-retrieval.md` | Spike brief: storage/indexing investigation for the position corpus. |
| `technical-spike-01-position-retrieval-report.md` | Spike 01 results: position key design (EP convention), benchmarks (PG/SQLite/DuckDB/ETS/flatfile) at 100k/1M/10M games, recommendation. Code in `spike/position_retrieval/`. |
| `technical-spike-02-similarity-and-relevance.md` | Spike 02 brief: which similarity/context dimensions produce useful historical candidates (experiment, not spec). |
| `technical-spike-02-similarity-and-relevance-report.md` | Spike 02 results: feature dimensions, seven retrieval strategies, candidate pools/performance at 100k games, evaluation sheet loop. Code in `spike/position_retrieval/lib/sim/`. |
| `technical-spike-02b-relevance-analysis.md` | Spike 02b brief: what a future search engine needs to rank historical games by *usefulness* (qualitative-evaluation follow-up to Spike 02). |
| `technical-spike-02b-relevance-analysis-report.md` | Spike 02b results: the qualitative observations grounded in judgment units, the similarity / informational-value / query-relevance split, corpus probes (tempo twins, route diffs, continuation clusters), detectability per dimension, next experiments. |

## How to use the ADRs

Every significant decision gets an ADR: a short "context → decision →
consequences" record that says *why* the code is the way it is. When you change
something that contradicts an ADR, either update the ADR (it describes the
current reality) or add a new one and mark the old one superseded. See
[`decisions/README.md`](decisions/README.md) for the template and rules.

## Reading order for a new session

1. `PROJECT.md` — what the product is and where it is going.
2. `architecture.md` — how it is built today.
3. `operations.md` — how to run, test, and ship it.
4. `decisions/` — the history of *why*, in digestible chunks.
