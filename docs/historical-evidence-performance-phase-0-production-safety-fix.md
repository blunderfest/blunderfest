# OpenChessLab — Historical Evidence Performance
## Phase 0: Production Safety Fix

### Objective

Implement ONLY the immediate Horizon-1 production-safety fix identified and
measured in Technical Spike 09.

This phase must:

1. stop Historical Evidence cards from materializing full occurrence lists
   when they only need aggregate counts;
2. deduplicate repeated count work within one Historical Evidence request;
3. preserve Historical Evidence semantics exactly;
4. materially reduce hot-key latency and memory pressure;
5. make no packed-format or boot/index changes.

This is a small production patch.

Do not start the format-v2 work in this task.

---

# Required source material

Read before changing code:

- `docs/technical-spike-09-packed-corpus-production-design-review.md`
- the Historical Examples performance root-cause report
- the Historical Evidence pipeline implementation
- the `Blunderfest.Corpus` facade and packed backend implementation
- existing Historical Evidence tests, especially same-game-only behavior

Treat the measured Variant A from Spike 09 as the reference implementation
behavior.

Do not re-investigate the architecture unless the current code materially
differs from the report.

---

# Problem being fixed

Current HEAD performs full occurrence retrieval in the card stage:

`Pipeline.card/8`
→ `Corpus.occurrences(cand.key)`

The card only needs aggregate information:

- occurrence count
- independent-game count
- `same_game_only`

For exact cards, many candidates share the same position key.

For hot positions this causes repeated reading, decoding and sorting of the
same occurrence run.

Measured on the current 1.17M-game corpus:

- start position:
  - HEAD ~19.7 s
  - ~16.0M tuples decoded
  - ~972 MB BEAM peak
- after 1.e4:
  - HEAD ~9.5 s
  - ~7.46M tuples decoded
  - ~502 MB BEAM peak

The measured Horizon-1 variant reduced these to approximately:

- start:
  - ~2.0 s
  - ~1.26M tuples decoded
  - ~435 MB peak
- after 1.e4:
  - ~1.0 s
  - ~0.58M tuples decoded
  - ~234 MB peak

Historical Evidence DTOs were byte-identical with timings removed on all
eight benchmark positions.

Implement that class of fix.

---

# Scope

Implement exactly these three changes.

## 1. Cards use counts, not the full occurrence list

Where a Historical Evidence card currently obtains the complete occurrence
list only to derive card statistics, replace that path with:

`Corpus.occurrence_counts(cand.key)`

Use the returned aggregate values to derive the same card fields.

The semantics of:

`same_game_only`

must remain exactly:

`occurrences > 1 and games == 1`

Do not approximate or reinterpret this.

Do not change any other card semantics.

---

## 2. Request-scoped count memoization

Within one Historical Evidence pipeline execution, memoize occurrence counts
by canonical position key.

The purpose is to ensure that the same key is counted once per request,
even if it appears in multiple exact or structural cards.

Requirements:

- scope is one Historical Evidence request only;
- key is the canonical position key used by the corpus;
- value contains the aggregate data required by callers;
- no process-global cache;
- no ETS cache;
- no application cache;
- no TTL;
- no cross-request persistence.

Prefer explicit data flow.

Do NOT use the process dictionary unless the existing code architecture makes
explicit threading demonstrably worse and you document why.

Technical Spike 09's measured experimental variant threaded the memo
explicitly through Pipeline/Candidates. Prefer that direction.

---

## 3. Collapse duplicate reference-key count work

The current request path performs the same reference-key count work in more
than one stage.

Ensure the reference position's aggregate counts are computed once and reused
throughout the same pipeline request where practical.

Do not create architectural churn just to eliminate a tiny duplicate call.

The implementation should remain easy to understand.

---

# Important non-goals

Do NOT implement any of the following in this phase:

- packed format v2
- new position-header fields
- `occurrence_count` persisted in `pos.bin`
- `game_count` persisted in `pos.bin`
- `occ_run_offset`
- persisted anchors
- boot optimization
- bounded `occurrences(limit:)`
- new public Corpus API redesign
- GenServer concurrency changes
- health checks
- Fly configuration changes
- broad caching
- PostgreSQL migration
- book-count semantic fix
- menu/Families optimization
- pawn-bucket optimization

Those belong to later phases.

---

# Preserve current candidate behavior

This Phase 0 fix does NOT yet remove the candidates-stage full occurrence
materialization.

If current candidate generation does:

`Corpus.occurrences(ref_key)`
→ `Enum.take(...)`

leave that behavior unchanged in this task.

This residual work is intentional and is addressed by format v2 / bounded
reads later.

Do not broaden this patch merely because that remaining inefficiency is
visible.

---

# Corpus facade behavior

Use the existing `Corpus.occurrence_counts/1` API.

Do not change the packed file format.

Do not create a second storage implementation.

If current test/unconfigured behavior depends on a fallback path, preserve it.

The spike's experimental variant retained list-based fallback behavior when
the facade was not configured. Verify whether this is still necessary in the
current code and preserve equivalent behavior if required by tests.

---

# Semantics and correctness

Historical Evidence output must remain unchanged apart from timing fields.

Pay particular attention to:

- `occurrences`
- independent-game count
- `same_game_only`
- exact vs structural card behavior
- support counts
- continuation grouping
- DTO ordering
- card ordering
- candidate selection

Do not "clean up" semantics while touching this code.

The existing `book_games_count` semantic divergence discovered in Spike 09
is explicitly out of scope.

Do not fix it here.

---

# Testing

Add or update focused tests for the new behavior.

At minimum verify:

1. card stats are identical when using counts instead of a full occurrence
   list;
2. `same_game_only` remains correct for:
   - one occurrence / one game
   - multiple occurrences / one game
   - multiple occurrences / multiple games;
3. multiple cards sharing the same key cause only one count lookup within the
   request;
4. different keys are counted independently;
5. fallback/unconfigured behavior still works if applicable;
6. Historical Evidence DTO semantics remain unchanged.

Do not rewrite unrelated tests.

---

# DTO parity verification

Use the Spike 09 benchmark/reference positions:

- start position
- after 1.e4
- after 1.d4
- Najdorf tabiya
- F1 KID tabiya
- A2 Ruy decision point
- rare middlegame
- cold/endgame position

Compare pre-fix vs post-fix Historical Evidence DTOs.

Strip only timing/instrumentation fields.

Everything else must match exactly.

Report any difference as a failure.

Do not justify semantic drift as a performance tradeoff.

---

# Performance benchmark

Run the existing or reconstructed Spike 09 benchmark harness locally.

Record for at least:

- start position
- after 1.e4
- after 1.d4
- Najdorf
- A2

Measure:

- total request latency
- candidates stage
- menu stage
- evidence stage
- occurrence facade call counts
- occurrence-count facade call counts
- occurrence tuples decoded
- bytes read if the harness already measures them
- BEAM peak memory
- Corpus GenServer busy time if available

Use warm runs for the primary acceptance gate.

Do not intentionally reproduce the hot-query OOM in production.

All hot-key stress testing must be local.

---

# Acceptance gates

The patch is acceptable only if all of these hold.

## Correctness

- all existing tests pass;
- Historical Evidence DTOs match pre-fix output on all 8 benchmark positions,
  excluding timings only;
- `same_game_only` semantics remain exact.

## Performance

On the current 1.17M-game local corpus, target:

### Start position

- warm total < 2.5 s
- decoded occurrence tuples <= ~1.3M
- bytes read <= ~60 MB where measurable
- peak BEAM <= ~450 MB

### After 1.e4

- warm total < 1.5 s
- materially lower memory than HEAD

The exact machine may introduce small variance.

If a threshold misses narrowly but the measured work counts match the
expected Variant A shape, report it rather than hiding it.

## Work deduplication

For hot exact-card positions:

- repeated exact cards sharing one key must not each call the full occurrence
  path;
- count lookups should collapse to distinct keys per request.

---

# Production-safety check

After the local implementation passes:

run a local concurrency check using the start-position query.

Do not test concurrency on production.

Use at least:

- 1 concurrent query
- 2 concurrent queries
- 4 concurrent queries

Record:

- wall time
- peak BEAM memory
- errors

Spike 09 measured the Variant A shape at approximately:

- 1 query: ~1.9 s / ~289 MB in that run
- 2 queries: ~3.1 s / ~289 MB
- 4 queries: ~4.8 s / ~431 MB

Do not require these exact values, but ensure memory does not return to the
HEAD/OOM pattern.

If 4 concurrent requests approach the 1 GB production limit, stop and report
before deployment.

---

# Code quality constraints

Keep the patch small.

Prefer:

- explicit request state
- simple memo map
- existing Corpus facade
- pure helpers where practical

Avoid:

- generic caching frameworks
- new supervision trees
- global state
- speculative abstractions
- unrelated refactors
- API renaming

Do not turn this into the future v2 API.

---

# Validation commands

Run the repository-standard checks, including at minimum:

- Elixir tests
- frontend tests only if frontend files are unexpectedly affected
- formatter
- lint/static checks
- existing precommit command

Use the project's actual commands rather than inventing alternatives.

---

# Git / deployment

Implement the fix in one focused commit.

Do not deploy automatically.

Do not modify Fly infrastructure.

Do not repack the corpus.

Do not touch production data.

At the end, leave the repository in a state that can be reviewed and deployed
separately.

---

# Required report

Write:

`docs/historical-evidence-phase0-production-safety.md`

Include:

## Summary

What changed and why.

## Files changed

Every production/test file modified.

## Request-scoped memo design

Explain:

- where the memo lives
- key/value shape
- how it moves through the pipeline
- how duplicate work is eliminated

## Semantic verification

Report DTO parity for all 8 benchmark positions.

## Performance results

Before/after table containing:

- total
- candidate/menu/evidence stage timings
- tuples decoded
- count/list calls
- memory
- bytes if available

## Concurrency results

1 / 2 / 4 request measurements.

## Test results

Commands and results.

## Known remaining cost

Explicitly state that:

- candidate generation still materializes the reference occurrence run;
- `occurrence_counts` still walks the complete run;
- anchor boot behavior is unchanged;
- this patch is Horizon 1 only.

## Deployment recommendation

State whether the change meets the measured safety gates and is ready for a
controlled production deployment.

Do not deploy it.

---

# Hard stop

Stop after Phase 0 is implemented, benchmarked and documented.

Do NOT continue into:

- persisted anchors
- format v2
- bounded occurrence retrieval
- Corpus API redesign
- GenServer changes
- operations changes

Those require separate reviewed phases.