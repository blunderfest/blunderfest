# Documentation

The documentation lives here, next to the code it describes. `PROJECT.md` at the
repo root remains the roadmap and single entry point for new sessions; this
directory holds the durable record of how and why the system is built.

## What lives here

| Path | Contents |
|---|---|
| `architecture.md` | How the system is put together: components, data flow, real-time model, frontend structure. Read this before reading code. |
| `erd.md` | The persistent data model (application data, durable room log, corpus) plus a detailed walkthrough of the historical-evidence feature, including every query it executes and why. |
| `operations.md` | Branches, deploy, local dev, verification commands. |
| `decisions/` | Architecture Decision Records (ADRs) — one file per decision, most recent first. |
| `storage-options.md` | Decision support for the future durable store (corpus, index, accounts): workload, options, deciding questions. Not a decision. |
| `corpus-scale-readiness.md` | How the corpus read path scales with game count, the single-GenServer bottleneck, and the documented packed-index migration trigger. Posture note, not a decision. |
| `technical-spike-01-position-retrieval.md` | Spike brief: storage/indexing investigation for the position corpus. |
| `technical-spike-01-position-retrieval-report.md` | Spike 01 results: position key design (EP convention), benchmarks (PG/SQLite/DuckDB/ETS/flatfile) at 100k/1M/10M games, recommendation. Code in `spike/position_retrieval/`. |
| `technical-spike-02-similarity-and-relevance.md` | Spike 02 brief: which similarity/context dimensions produce useful historical candidates (experiment, not spec). |
| `technical-spike-02-similarity-and-relevance-report.md` | Spike 02 results: feature dimensions, seven retrieval strategies, candidate pools/performance at 100k games, evaluation sheet loop. Code in `spike/position_retrieval/lib/sim/`. |
| `technical-spike-02b-relevance-analysis.md` | Spike 02b brief: what a future search engine needs to rank historical games by *usefulness* (qualitative-evaluation follow-up to Spike 02). |
| `technical-spike-02b-relevance-analysis-report.md` | Spike 02b results: the qualitative observations grounded in judgment units, the similarity / informational-value / query-relevance split, corpus probes (tempo twins, route diffs, continuation clusters), detectability per dimension, next experiments. |
| `technical-spike-02b-relevance-lessons-learned.md` | Spike 02 lessons learned (owner's synthesis): similarity finds candidates but differences + continuations carry the value; relevance is query-dependent; no fused score. |
| `technical-spike-03-persistence.md` | Spike 03 brief: determine the persistence architecture — data classes, canonical vs derived, access patterns, store candidates, import/rebuild strategy. |
| `technical-spike-03-persistence-report.md` | Spike 03 results: one Postgres for app data + canonical corpus (PGN), derived/rebuildable occurrence index behind a `Corpus` boundary, rooms stay in-memory; import/rebuild strategy; ADR-0001 amendment proposed. |
| `technical-spike-04-historical-continuation-and-plan-patterns.md` | Spike 04 brief: can following-move context distinguish "similar position" from "similar chess idea" (B1–B4/F1-F4 as test cases). |
| `technical-spike-04-historical-continuation-and-plan-patterns-report.md` | Spike 04 results: yes, conditionally — continuation clustering reproduces decision menus (A2 Marshall/Closed, F1 kingside trio), typed differences label all six qualitative units; tempo twins and single-linkage chaining documented as failures. Code in `spike/position_retrieval/lib/sim/continuation*.ex`, `difference.ex`. |
| `technical-spike-05-contextual-historical-evidence-re-judgment-experiment.md` | Spike 05 brief: does contextual evidence (typed differences, continuation, families, per-side, move order) improve human re-judgment of the known candidates — no relevance score. |
| `technical-spike-05-contextual-historical-evidence-re-judgment-experiment-report.md` | Spike 05 results: yes — 4 of 13 judgments changed (both directions) for structural reasons; route/move-order comparison + typed differences carry, families need counts and a same-game guard; singleton self-membership and bare labels documented as failures. Code in `spike/position_retrieval/lib/sim/rejudge*.ex`. |
| `technical-spike-06-plan-skeletons-and-move-order-robustness.md` | Spike 06 brief: can an order-insensitive action-based representation (plan skeleton) recognize tempo-flipped continuations (B1) without collapsing different plans. |
| `technical-spike-06-plan-skeletons-and-move-order-robustness-report.md` | Spike 06 results: yes, as a per-side membership layer — B1 joins the kingside family on black's side at 1.0; skeleton clustering rejected (chains A2's Marshall/Closed); family→variation tables reproduce the desired output shape; vertical-slice architecture proposed. Code in `spike/position_retrieval/lib/sim/skeleton*.ex`. |
| `technical-spike-07-from-historical-examples-to-historical-evidence.md` | Spike 07 brief (product/UX): is the individual Historical Example card the right primary UI unit, or should historical structure/evidence come first with games as support. |
| `technical-spike-07-from-historical-examples-to-historical-evidence-report.md` | Spike 07 results: mostly no — the card is a good terminal unit but the wrong primary one (duplicate games across cards, chained menus making the verdict vacuous on A2/Najdorf, the decision menu computed but never shown). Smallest experiment: show the already-returned decision menu in front of the carousel. |
| `product-experiment01-historical-decision-menu.md` | Product Experiment 01 brief: add the historical next-move distribution before the example carousel (independent-game counts; not families). |
| `product-experiment-01-historical-decision-menu.md` | Product Experiment 01 results: implemented. New `DecisionMenu` module computes per-move independent-game counts; families untouched; F1/A2 verified end-to-end; limitations + evaluation questions. |

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
