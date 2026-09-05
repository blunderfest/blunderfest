# OpenChessLab — Packed Corpus v2
## Phase 3: Bounded Corpus API + Historical Evidence Cutover

### Objective

Complete Phase 3 of the packed-corpus production plan:

1. expose the v2 capabilities through a product-oriented Corpus API;
2. make occurrence statistics metadata-backed instead of O(run);
3. make bounded occurrence retrieval actually read only the requested records;
4. cut Historical Evidence over to those bounded APIs;
5. correct independent-game support where the v2 `game_count` is authoritative;
6. preserve exact product semantics and DTO parity;
7. validate the result locally and in production with hard memory/performance gates.

Phase 2 is complete.

Do NOT redesign the packed format.
Do NOT repack the corpus.
Do NOT change the corpus concurrency model.
Do NOT address cross-region PostgreSQL latency.

This phase is the controlled runtime cutover to the already validated v2
format.

---

# Required source material

Read completely before changing code:

1. `docs/technical-spike-09-packed-corpus-production-design-review-report.md`
2. `docs/packed-corpus-phase2-format-v2.md`
3. `docs/historical-evidence-phase0-production-safety.md`
4. ADR-0038
5. ADR-0037 where relevant to corpus deployment
6. `docs/architecture.md`
7. current implementations of:
   - `Corpus`
   - `Packed`
   - `Packed.Segment`
   - Historical Evidence pipeline
   - candidate generation
   - count memoization
   - book/count APIs
   - parity and benchmark tasks

Use current code as the final authority if documentation is stale.

Do not reopen decisions already established by Phases 0–2.

---

# Current proven state

Phase 2 produced packed format v2.

Each v2 position header stores:

```text
occurrence_count
game_count
occ_run_offset
````

with:

* `occurrence_count` = exact occurrence run length within the segment
* `game_count` = exact distinct gid count within the segment
* `occ_run_offset` = segment-local first occurrence record index

The fields have been validated against:

* PostgreSQL oracles on the 100k tier
* streamed artifact verification on the full 1.17M corpus
* run-boundary verification
* multi-segment tests

Broadcast parity sampled 10,001 keys with 0 failures.

Hot-key v2 stats lookup is already proven bounded:

```text
start:
  old run walk: ~198 ms
  v2 metadata: p50 ~21 µs

after 1.e4:
  old run walk: ~78 ms
  v2 metadata: p50 ~31 µs

after 1.d4:
  old run walk: ~56 ms
  v2 metadata: p50 ~27 µs
```

The full v2 corpus is approximately 13.1 GiB.

Do not repeat Phase 2 research.

---

# Current remaining inefficiencies

Production-facing APIs have deliberately not switched yet.

Currently:

## Counts

`Corpus.occurrence_counts(key)`

still walks the complete occurrence run.

This is O(run length).

For the start position that means walking ~1.17M records even though v2
already stores the answer.

## Bounded occurrences

`Corpus.occurrences(key, limit)`

has bounded decoded output, but the packed implementation still reads the
whole occurrence run's bytes before decoding only the requested prefix.

For hot positions this still performs unnecessary I/O.

## Historical Evidence

Phase 0 made Historical Evidence memory-safe by:

* using count APIs instead of full occurrence lists for cards;
* request-scoped count memoization;
* bounding candidate occurrence materialization.

Preserve those safety properties.

Phase 3 should make those same calls cheap rather than undoing the Phase 0
structure.

---

# Product-oriented Corpus API

Introduce or complete a cost-explicit API.

The intended conceptual API is:

```elixir
Corpus.position_stats(key)
Corpus.first_occurrence(key)
Corpus.occurrences(key, limit)
Corpus.all_occurrences(key)
```

Adapt naming to the existing codebase where necessary, but preserve the cost
distinction.

The API should make it difficult for future callers to accidentally perform
an unbounded hot-key read.

---

# 1. `position_stats`

Provide:

```elixir
Corpus.position_stats(key)
```

returning the product-relevant equivalent of:

```elixir
%{
  occurrences: occurrence_count,
  games: game_count
}
```

for the complete logical corpus.

For packed v2:

* lookup the position header in every segment containing the key;
* sum `occurrence_count`;
* sum `game_count`.

This is exact because packed segment gid ranges are disjoint.

Do NOT inspect individual occurrence records to calculate these values.

Complexity should be based on segment/header lookup, not run length.

For v1, preserve a correct compatibility path if required for rollback.

Do not silently interpret unavailable v1 metadata as v2 metadata.

Possible acceptable behavior:

```text
v2 -> metadata-backed stats
v1 -> existing occurrence-count implementation
```

if that gives us safe rollback compatibility.

Document the behavior explicitly.

---

# 2. `first_occurrence`

Provide:

```elixir
Corpus.first_occurrence(key)
```

without materializing a full occurrence run.

For each segment containing the position:

* use the stored first occurrence / run metadata;
* identify the globally earliest occurrence according to existing corpus
  ordering semantics.

Do not assume "first segment" unless that is proven by segment ordering and
gid-range invariants.

Preserve exact semantics of:

```elixir
Corpus.occurrences(key) |> List.first()
```

for every key.

Add parity tests against that oracle.

---

# 3. True bounded `occurrences(key, limit)`

Reimplement the packed v2 path so:

```elixir
Corpus.occurrences(key, limit)
```

does NOT read the complete occurrence run.

Use:

```text
occ_run_offset
+
min(limit, occurrence_count)
```

to calculate the exact byte range required from each segment's `occ.bin`.

Read and decode only those records.

The result must remain exactly equivalent to:

```elixir
Corpus.occurrences(key)
|> Enum.take(limit)
```

under the existing logical multi-segment ordering.

Important:

the limit applies to the complete logical result, not independently to every
segment.

Example:

```text
limit = 12

segment 1 supplies 8
segment 2 should supply at most 4
later segments should not be read
```

unless actual ordering semantics require a different merge.

Inspect and preserve the current ordering contract.

Do not invent a new ordering.

---

# Bounded-read requirements

Handle correctly:

```text
limit = 0
limit = 1
limit = 12
limit = 2000
limit > run length
missing key
one segment
multiple segments
```

Invalid negative limits should follow existing API conventions.

Do not introduce arbitrary new error semantics.

For v2, the amount of occurrence data read must scale with:

```text
min(limit, result size)
```

not total run length.

Prove this with instrumentation or a focused test where practical.

---

# 4. Explicit unbounded retrieval

Keep an explicit way to retrieve the complete occurrence list where genuinely
needed.

Preferred conceptual name:

```elixir
Corpus.all_occurrences(key)
```

The important requirement is that unbounded work is obvious at the call site.

Audit all current callers of:

```elixir
Corpus.occurrences(key)
```

Classify each caller:

* genuinely needs all occurrences
* only needs first occurrence
* only needs counts
* only needs a bounded prefix

Move callers to the cheapest semantically correct API.

Do NOT mechanically rename every full-list call.

For every remaining unbounded caller, document why it genuinely requires the
complete run.

If backward compatibility requires retaining `occurrences/1`, consider making
it delegate to `all_occurrences/1`, but new product code should use the
cost-explicit name.

---

# Historical Evidence cutover

Update Historical Evidence to consume the new bounded primitives.

Preserve the Phase 0 architecture:

* request-scoped memoization remains a plain explicitly threaded map;
* no ETS;
* no process dictionary;
* no global cache;
* no hidden mutable request state.

The memo may now cache `position_stats` instead of expensive count walks.

Do not remove memoization merely because individual lookups are cheap.

Repeated semantic work should still collapse within a request.

---

# Historical Evidence counts

Where Historical Evidence currently needs:

```text
occurrences
independent games
same_game_only
```

derive these from:

```elixir
Corpus.position_stats(key)
```

For exact-card semantics preserve:

```elixir
same_game_only =
  occurrences > 1 and games == 1
```

Do not change DTO semantics.

Do not derive independent-game support from `book_games_count` where v2
`game_count` is the authoritative value.

---

# `book_games_count` correction

Phase 2 deliberately left the known independent-game divergence untouched.

Now correct product paths where `book_games_count` is being used as a proxy
for independent-game support and the v2 position `game_count` is the correct
semantic source.

Known measured divergence at the start position was approximately:

```text
book_games_count - true game_count = -87,264
```

Do not blindly replace every book count.

First classify what each field means.

Distinguish:

```text
position occurrence count
position independent-game count
next-move occurrence count
next-move independent-game count
book/continuation-specific counts
```

Only replace a count when the intended product semantic is truly:

"number of independent games containing this position."

If a book count describes a different concept, preserve it.

Document every semantic replacement.

---

# Candidate generation

Phase 0 currently bounds candidate occurrence reads.

Preserve the existing candidate semantics and limits.

Where candidate generation asks for a bounded prefix, route it through the
true v2 bounded read.

Do NOT:

* change candidate ranking
* change similarity logic
* change pawn-bucket behavior
* change occurrence limits
* change historical evidence grouping
* change continuation-family logic
* change evidence relevance semantics

This phase changes access cost, not candidate meaning.

---

# v1 rollback compatibility

Production currently runs v1.

Phase 3 must not make rollback impossible.

The application must have a clearly defined behavior when opened against:

```text
v1 corpus
v2 corpus
```

Preferred compatibility strategy:

```text
v1:
  old correct implementations remain available

v2:
  new metadata/run-offset implementations
```

Do not require v2-only APIs to fabricate metadata on v1 incorrectly.

Test both.

A code rollback and/or `PACKED_DIR` rollback must have an explicit documented
procedure.

---

# Single GenServer boundary

The Corpus facade currently serializes corpus reads through a GenServer.

Do NOT change this architecture in Phase 3.

No:

* direct immutable fd access from callers
* worker pool
* parallel segment reads
* ETS index
* reader process pool
* async candidate hydration

First make each read bounded.

Concurrency redesign remains a later telemetry-driven decision.

---

# Cross-region PostgreSQL latency

Explicitly OUT OF SCOPE.

Production verification has shown a separate latency problem for requests
served in `ord` while PostgreSQL is in `ams`.

Do NOT:

* batch the PG game/move hydration calls
* move PostgreSQL
* add a read replica
* add region-aware routing
* change Fly regions
* change card hydration architecture

Do not allow this issue to contaminate Phase 3 benchmark interpretation.

Where possible, benchmark the packed-corpus portion separately from
cross-region PG work.

Keep the PG issue as a separate follow-up after the v2 cutover.

---

# Performance instrumentation

Add enough focused instrumentation/benchmark support to distinguish:

```text
position stats lookup
bounded occurrence read
candidate generation
card/evidence assembly
PG hydration
total Historical Evidence request
```

Do not build a new observability platform.

Use existing timing/reporting mechanisms where possible.

We need to be able to explain where remaining time goes after the cutover.

---

# Local benchmark suite

Use the permanent reference positions:

* start
* after 1.e4
* after 1.d4
* Najdorf tabiya
* F1 KID tabiya
* A2 Ruy decision point
* rare middlegame
* cold/endgame

For each record where applicable:

```text
position_stats latency
occurrences(limit=1)
occurrences(limit=12)
occurrences(limit=2000)
Historical Evidence total latency
peak memory
```

Compare against the current Phase 0/1 v1 implementation.

---

# Critical performance gate

Spike 09 defined the Phase 3 product gate:

```text
start-position Historical Evidence:
  < 1 second
  < 300 MB peak memory
```

Treat this as the primary local packed-corpus acceptance gate.

Use a warm corpus for the main comparison and separately report cold behavior
if useful.

Do not hide a miss behind average timings.

Report:

* median / representative warm result
* repeated-run range or percentiles where practical
* peak memory

If the gate is missed:

STOP.

Profile the remaining cost.

Do not begin unrelated optimization work.

Report exactly which stage remains dominant and propose the smallest next
step.

---

# API microbenchmarks

The new primitive APIs should demonstrate their intended complexity.

For hot keys:

## `position_stats`

Expected order of magnitude based on Phase 2:

tens of microseconds locally.

Do not require exact equality with Phase 2 because the facade adds overhead.

But it must remain independent of run length.

## `occurrences(key, limit)`

Compare at:

```text
1
12
2000
```

The start position must no longer read/decode the entire ~1.17M occurrence
run.

Measure bytes read if feasible.

The cost should scale primarily with the requested prefix size.

---

# Memory validation

Repeat the Phase 0 memory safety scenarios.

At minimum:

```text
start position
after 1.e4
after 1.d4
```

Confirm:

* no full hot occurrence list is materialized
* no complete hot occurrence byte run is read for bounded consumers
* no OOM
* no memory growth proportional to full run size for bounded requests

Also run a small concurrency check similar to Phase 0:

```text
n = 1
n = 2
n = 4
```

Do not optimize the GenServer based solely on these results.

Record them for the later concurrency decision.

---

# Correctness / parity

Performance improvements are invalid if product output changes.

Run Historical Evidence DTO parity before/after the Phase 3 cutover.

Required positions:

* start
* 1.e4
* 1.d4
* Najdorf
* F1
* A2
* rare
* endgame

Strip timings and other intentionally non-semantic diagnostics.

Expected result:

```text
all DTOs identical
```

If `book_games_count` correction intentionally changes a DTO field that was
previously semantically wrong:

* isolate that difference;
* prove it against the v2 `game_count` oracle;
* document it explicitly;
* do not classify intentional correctness fixes as unexplained parity
  failures.

All other differences are failures.

---

# Multi-segment tests

Production currently has one segment, but the API must remain correct for
multiple immutable segments.

Add focused tests proving:

## position_stats

```text
occurrences = sum(segment occurrence_count)
games = sum(segment game_count)
```

## first_occurrence

Returns the same result as the old full-list oracle.

## bounded occurrences

Applies one global limit while preserving logical ordering.

Test cases should include a key whose requested prefix crosses a segment
boundary.

Example:

```text
segment A has 8 occurrences
segment B has 20 occurrences
limit = 12

result = 8 from A + 4 from B
```

provided that matches the existing ordering contract.

Also prove that segment B is not fully read.

---

# Tests

Add or update focused tests for at least:

1. v2 `position_stats` exactness
2. v1 compatibility path for stats
3. missing position stats
4. multi-segment stats summation
5. true independent-game summation
6. `first_occurrence` parity
7. bounded read limit 0
8. bounded read limit 1
9. bounded read limit 12
10. bounded read limit 2000
11. bounded read larger than run
12. missing-key bounded read
13. multi-segment bounded prefix
14. bounded read does not decode/read full run
15. explicit all-occurrences parity
16. caller audit leaves no accidental unbounded hot-key consumer
17. Historical Evidence count memo semantics
18. `same_game_only` semantics
19. candidate output parity
20. HE DTO parity
21. corrected independent-game semantics where applicable
22. v1/v2 compatibility

Keep all Phase 0, Phase 1 and Phase 2 tests.

---

# Production cutover preparation

Unlike Phase 2, Phase 3 is intended to end with a deployable v2 runtime.

However:

do not immediately replace production at the start of the task.

First complete:

1. implementation
2. tests
3. local parity
4. local performance gate
5. v1 rollback verification
6. v2 artifact verification

Only after all gates pass should production cutover be considered.

The existing validated 13.1 GiB v2 artifact should be reused.

Do NOT rebuild it unless validation proves that necessary.

---

# Production deployment

If the repository/task environment has the existing authorized deployment
workflow and all pre-deploy gates pass, prepare and execute the normal
reviewed Phase 3 deployment procedure.

Do not improvise infrastructure changes.

Expected high-level sequence:

1. verify the existing v2 artifact and manifest;
2. ship the complete v2 directory plus required anchor sidecars to each
   production volume;
3. checksum-verify it on each target;
4. leave the v1 directory intact;
5. switch `PACKED_DIR` to v2 using the established deployment mechanism;
6. deploy the Phase 3 application code;
7. verify both production regions;
8. retain immediate v1 rollback capability.

If deployment credentials/workflow are unavailable, STOP after producing the
exact deployment commands/procedure.

Never delete v1 as part of this phase.

---

# Production verification

After cutover, verify at minimum:

```text
health
normal room load
Historical Evidence A2
Historical Evidence Najdorf
Historical Evidence after 1.e4
Historical Evidence start position
```

Verify both configured regions where practical.

For each HE request record:

```text
HTTP success/failure
total latency
packed-corpus timing if available
memory
machine health
```

The start-position request is mandatory.

Phase 0 demonstrated that synthetic/local safety was insufficient to prove
production safety.

Do not declare the cutover successful without executing a real production
hot-key request.

---

# Production safety gates

The deployment is successful only if:

* no OOM
* no machine restart caused by the test
* no health-check failure
* no corpus-open regression
* no multi-minute boot
* start-position HE completes successfully
* output semantics match expected v2 behavior

If a severe regression occurs:

rollback to the retained v1 corpus/application state using the documented
procedure.

Do not attempt broad live debugging while production is unhealthy.

---

# Anchor behavior

Phase 1 persisted anchors and eliminated the multi-minute startup problem.

Preserve this completely.

Verify after v2 shipping that:

* anchor sidecars are present or correctly generated before normal traffic;
* v2 corpus open remains fast;
* no 1.21M-small-pread-style rebuild occurs during normal production boot.

Do not redesign anchors.

---

# Known book-stream difference

Phase 2 fixed a latent `Stream.transform/4` bug that dropped the final
book key from v1 builds.

The v2 corpus therefore contains one additional valid final book key.

Do not "fix" parity by removing it.

The retained v1 corpus intentionally keeps the one-key gap as its rollback
artifact.

Ensure tests/parity distinguish this known artifact difference from
unexpected product changes.

Do not repack v1 in this phase.

---

# Repository validation

Run the standard repository checks.

At minimum:

```text
mix precommit
```

Expected baseline after Phase 2:

```text
455 tests
```

The exact final count may increase.

No warnings.

Run all relevant corpus:

* validation
* parity
* Historical Evidence parity
* benchmark
* memory/concurrency checks

Do not run unrelated frontend work unless repository policy requires it.

---

# Documentation

Write:

`docs/packed-corpus-phase3-runtime-cutover.md`

Include:

## Summary

What changed and why.

## Corpus API

Document the final APIs and their cost characteristics.

Prefer an explicit table such as:

```text
API                         Cost
position_stats              bounded by segment/header lookup
first_occurrence            bounded by segment/header lookup
occurrences(key, limit)     O(segment lookup + limit)
all_occurrences             O(full run)
```

Be precise about multi-segment behavior.

## Caller audit

List every previous unbounded occurrence caller and what it now uses.

## Historical Evidence cutover

Explain how stats and bounded reads flow through the pipeline.

## Independent-game semantics

Document any `book_games_count` corrections.

## v1 compatibility

Explain fallback/rollback behavior.

## Correctness

Provide parity results.

## Performance

Provide before/after tables for all permanent benchmark positions.

## Memory

Provide hot-key and concurrency results.

## Production deployment

If performed, include:

* version/commit
* regions
* corpus path/version
* verification requests
* timings
* memory
* health
* rollback state

## Remaining bottlenecks

Separate packed-corpus costs from PostgreSQL/card-hydration costs.

Explicitly carry forward:

* ord → ams PostgreSQL latency
* possible future Corpus GenServer concurrency investigation

Do not solve either in this phase.

---

# Acceptance gates

Phase 3 is complete only if:

1. v2 `position_stats` uses stored metadata and does not walk occurrence
   runs.

2. v2 bounded occurrence retrieval reads only the required prefix.

3. `first_occurrence` does not materialize the full run.

4. multi-segment behavior is correct.

5. Historical Evidence uses the new bounded primitives.

6. Phase 0 request-scoped memoization and safety properties remain intact.

7. accidental unbounded occurrence consumers have been removed from hot
   product paths.

8. independent-game semantics use authoritative `game_count` where
   appropriate.

9. all unexplained DTO parity differences are zero.

10. `mix precommit` is green.

11. start-position HE locally meets:

    < 1 second
    < 300 MB peak memory

12. v1 remains a usable rollback path.

13. persisted-anchor startup behavior remains fast.

14. if production deployment is performed, a real production start-position
    request succeeds without OOM/restart.

---

# Hard stop

Stop after:

* bounded API implementation
* caller migration
* Historical Evidence cutover
* independent-game correctness fix where justified
* parity
* benchmarks
* memory validation
* production cutover/verification if authorized
* documentation

Do NOT continue into:

* Corpus GenServer concurrency redesign
* PostgreSQL batching
* cross-region PG optimization
* Fly region changes
* database topology changes
* segment-size redesign
* continuation-family redesign
* candidate-ranking changes
* frontend changes

The next performance investigation after this phase is the separately parked
cross-region PostgreSQL issue.
