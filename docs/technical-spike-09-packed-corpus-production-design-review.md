# OpenChessLab Technical Spike 09
## Packed Corpus Production Design Review

### Mission

Investigate whether the current packed corpus production problems are caused by:

1. a flawed packed-binary architecture,
2. an implementation that does not exploit the architecture correctly,
3. a mismatch between the API/access patterns and the packed format,
4. or a combination of these.

Do not assume the answer in advance.

The goal is to determine the correct production architecture for the
OpenChessLab corpus at:

- the current ~1.17M-game corpus
- 10M+ games
- eventually substantially larger corpora

This is primarily an investigation and design task.

Do NOT start a broad production refactor.

---

# Required source material

Read these documents completely before forming conclusions:

1. Technical Spike 08 — Production Packed Binary Corpus Index
2. Historical Examples Performance — Root-Cause Investigation Report
3. relevant current ADRs / corpus architecture documentation
4. the actual current implementation behind `Blunderfest.Corpus`

Treat measured results as stronger evidence than architectural assumptions.

Where the old spike and current production measurements appear to conflict,
explicitly reconcile them.

Do not silently prefer the newer report or the older spike.

---

# Known evidence that must be explained

## Original packed spike

The packed implementation previously demonstrated:

- exact corpus parity with PostgreSQL
- product-level Historical Evidence parity
- packed occurrence storage around 36% of PostgreSQL
- normal packed lookup latency around 3.5× better than PostgreSQL
- hot-key retrieval generally faster than PostgreSQL in the spike
- immutable sorted segments with sparse in-memory anchors
- `occurrence_counts` distinct from full `occurrences`
- PostgreSQL retained for games, moves and metadata

The spike therefore concluded that packed binary was suitable as the
production occurrence backend.

## Current production corpus

The production corpus is approximately:

- 1,174,661 games
- 94,257,050 occurrences
- 72,393,592 positions
- currently one packed segment

Measured production/root-cause findings include:

- start-position Historical Evidence:
  ~18 s locally warm
- after-1.e4:
  ~9 s locally warm
- moderate Ruy position:
  ~0.5 s
- hot-key request peak BEAM memory:
  ~744 MB
- a live production hot-key request has OOM-killed the 1 GB Fly machine
- exact cards repeatedly fetch/materialize the same occurrence run
- a start-position request decodes about 16M occurrence tuples
- the same hot reference run can be read/materialized 13 times
- packed corpus open rebuilds anchors at runtime
- production boot has taken approximately 6–12 minutes
- hot-key CPU cost is largely cache-independent
- PostgreSQL games/moves queries are not a material bottleneck
- file open/close cost is negligible
- current segmentation count is one and is not the present bottleneck

The investigation also showed that the reverted
`occurrences → occurrence_counts` card change was directionally correct
and did not itself cause the outage.

Explain how these observations can coexist with the successful spike.

---

# Central design question

Answer this question:

> Given the actual 1.17M-game workload and the 10M+ target, which information
> should be computed during corpus packing, which information should live in
> the packed position/index records, and which work should remain runtime work
> so that Historical Evidence never performs work proportional to a hot
> position's complete occurrence count unless the caller explicitly requests
> those occurrences?

The answer must be based on measurement and actual product access patterns.

---

# Phase A — Reconstruct the intended architecture

Inspect the current code and document the complete packed data model.

Include:

- `occ.bin`
- `pos.bin`
- `bucket.bin`
- `book.bin` if applicable
- manifest
- segments
- sparse anchors
- string region
- hash/index lookup
- `Corpus` facade
- `Packed`
- `Segment`
- candidate generation
- Historical Evidence pipeline

For every public corpus operation, document:

- input
- output
- files touched
- number of records potentially scanned
- whether full occurrence tuples are materialized
- whether work is bounded
- asymptotic behavior for a hot key
- whether execution occurs inside the Corpus GenServer

Produce an access-pattern table.

Do not only read the modules mentioned in the reports.
Follow the actual call graph.

---

# Phase B — Reconcile Spike 08 with production

Determine exactly why Spike 08 looked healthy while the real production
request can take 9–18 seconds.

Investigate at least:

## Benchmark workload mismatch

Did the spike primarily measure:

- one lookup at a time

while Historical Evidence performs:

- many lookups per request
- duplicate lookups for identical keys
- repeated materialization

Quantify this.

## Corpus-size effects

Determine which costs changed materially between:

- the 100k-game spike corpus
- the 1.17M-game production corpus

Do not infer only from game count.

Use:

- occurrence counts
- distinct-position counts
- hot-key run lengths
- bucket sizes
- anchor counts
- bytes touched

## Historical Evidence parity benchmark

Explain why the earlier HE parity positions did not expose the current
hot-key failure mode.

Check whether the benchmark set lacked:

- start position
- after-1.e4
- other extremely hot opening positions

If so, state this explicitly as a benchmark blind spot.

## Anchor construction

Reconcile the sparse-index design from Spike 08 with the measured
~1.21M `pread` calls during current production open.

Determine exactly:

- which files build anchors
- current stride(s)
- anchor count per file
- read pattern
- why this grows to the measured syscall count
- whether any implementation has diverged from the spike

Do not merely repeat the performance report.

Verify from code and instrumentation.

---

# Phase C — Classify every expensive operation

For each major cost, classify it as one of:

A. inherent cost of the packed format
B. implementation mistake
C. API/access-pattern mismatch
D. missing precomputation
E. product algorithm cost unrelated to storage
F. deployment/operations problem

At minimum classify:

- repeated card occurrence retrieval
- occurrence counting
- independent-game counting
- occurrence sorting
- candidate occurrence retrieval
- pawn-bucket lookup
- menu family construction
- anchor rebuilding
- Corpus GenServer serialization
- opening/closing file descriptors
- PostgreSQL game/move access

For each classification provide evidence.

---

# Phase D — Evaluate a position-header vNext

Do NOT assume a format change is necessary.

Measure and evaluate it.

The current position record contains approximately:

- hash
- pawn_hash
- first_gid
- first_ply
- string_offset
- string_len

Investigate whether additional derived metadata should be stored.

Candidate fields include:

- occurrence_count
- independent_game_count
- occurrence-run offset / first record
- occurrence-run length
- any other field justified by actual runtime access patterns

For every proposed field answer:

1. How often is it requested?
2. How expensive is it to compute today?
3. Can it be computed deterministically during packing?
4. How many bytes per distinct position does it add?
5. What is the storage increase at:
   - current corpus
   - 10M games
   - 50M games if useful
6. What runtime operation becomes bounded/O(1)?
7. What are the correctness implications?
8. What happens across multiple segments?
9. What happens with a future mutable PG tail?
10. Can it be validated against PostgreSQL during parity checks?

Do not add metadata merely because space is available.

---

# Critical independent-game-count question

OpenChessLab distinguishes:

- occurrences
- independent games

This semantic distinction must remain correct.

Investigate whether `independent_game_count` can safely be precomputed per
position per segment.

Explicitly verify:

- whether segment gid ranges are disjoint
- whether the same game can ever appear in multiple segments
- whether counts can therefore be summed across segments
- what happens during incremental-tail merging
- what compaction guarantees are required

Do not assume summation is safe without proving the invariants.

`same_game_only` semantics must remain exactly correct.

---

# Phase E — Evaluate occurrence-run metadata

Investigate whether position headers should point directly into `occ.bin`.

For example:

position header
  -> occurrence offset
  -> occurrence count

Evaluate whether this would allow:

- counts without scanning `occ.bin`
- direct occurrence retrieval without a second hash search
- bounded reads
- simpler code

Compare it to the existing hash-anchor approach.

Important:

The full occurrence list still needs to be available when callers genuinely
request historical occurrences.

The goal is not to remove `occ.bin`.

The goal is to avoid reading it when only aggregate metadata is needed.

---

# Phase F — Boot architecture

Investigate the correct long-term anchor/index strategy.

Compare at least:

## Option 1
Current rebuild-at-open approach

## Option 2
Bulk/chunked anchor reconstruction at runtime

## Option 3
Persist anchors as derived packed artifacts at pack time

## Option 4
A different sparse-index representation if justified by measurements

For each compare:

- startup I/O
- syscall count
- startup CPU
- bytes on disk
- memory footprint
- corruption/versioning implications
- manifest/checksum implications
- compatibility across format versions
- operational complexity

Strongly consider that the packed corpus is immutable derived data.

If an index can be deterministically produced by the packer, explain why
runtime reconstruction is or is not desirable.

Target:

normal machine startup should not scale to minutes as corpus size grows.

---

# Phase G — Corpus GenServer architecture

The current investigation reports that packed reads, tuple decoding and
sorting occur through the single `Corpus` GenServer.

Examine whether that was an intentional architectural requirement or an
implementation convenience.

Determine:

- what mutable state the GenServer actually protects
- whether immutable packed reads require serialization
- which operations can safely execute outside the GenServer
- whether file handles/state can be shared safely
- whether concurrent bounded reads would improve throughput
- what concurrency does to memory

Do NOT recommend parallelizing the current unbounded occurrence-list
implementation.

First reason about the architecture after the hot-key work has been made
bounded.

A possible conclusion is that the GenServer should remain.
A possible conclusion is that it should become a metadata/coordinator
process while request processes perform immutable reads.

Measure before recommending either.

---

# Phase H — Immediate remediation vs format vNext

Separate the solution into two horizons.

## Horizon 1 — production safety

Find the smallest safe change that prevents the current OOM/outage class.

Evaluate:

- card use of `occurrence_counts`
- request-scoped memoization keyed by canonical position key
- duplicate ref-key count removal

Verify that Historical Evidence DTO semantics are byte/field equivalent
apart from timings.

This is allowed to be proposed as an immediate patch.

Do not confuse it with the final 10M architecture.

## Horizon 2 — 10M+ architecture

Design the packed format/API so hot-key count operations no longer perform
work proportional to occurrence-run length.

The target property is:

> Asking how many historical occurrences / independent games a position has
> must not require scanning every occurrence of that position.

Likewise:

> Starting the application must not require millions of tiny random reads.

---

# Phase I — Benchmark alternatives

Do not rely only on theoretical estimates.

Create temporary experimental code or a clean worktree if useful.

Do not change production code on main.

Benchmark at least:

- HEAD
- immediate safe count/memoized variant
- metadata-backed count prototype if feasible
- current anchor open
- alternative anchor open

Use the existing six-position benchmark plus add explicit hot positions:

- start position
- after-1.e4
- at least one other very common early-opening position
- Najdorf tabiya
- F1 KID tabiya
- A2 Ruy decision point
- rare middlegame/endgame

Measure:

- total request latency
- candidates
- menu
- evidence stage
- reductions
- BEAM peak memory
- occurrence records decoded
- bytes read
- number of `pread`s
- Corpus GenServer busy time
- boot time

For hot keys, include concurrency tests only after the unbounded
materialization problem has been removed.

---

# Phase J — Re-check PostgreSQL fairly

Do not assume packed must win because Spike 08 selected it.

Also do not propose returning to PostgreSQL merely because production packed
is currently unhealthy.

Perform a fair comparison of the operations the product actually needs.

Compare PG vs packed for:

1. position existence
2. occurrence count
3. independent-game count
4. first occurrence
5. bounded occurrence sample
6. complete occurrence list
7. pawn-bucket lookup
8. Historical Evidence end-to-end
9. build/update operational cost
10. storage footprint

Use the actual 1.17M corpus where practical.

Separate:

- query performance
- build performance
- storage cost
- operational reliability

If packed remains the right architecture, state why.

If PostgreSQL is better for a particular operation, state whether a hybrid
design is preferable.

Do not force a single storage technology for ideological consistency.

---

# Phase K — Design the Corpus API from product needs

Review whether the current facade encourages expensive misuse.

For example, determine whether callers should explicitly request operations
such as:

- `position_stats(key)`
- `occurrence_counts(key)`
- `first_occurrence(key)`
- `occurrences(key, limit: ...)`
- `all_occurrences(key)`

The exact API names are not prescribed.

The goal is to make expensive operations explicit and cheap operations easy.

Avoid an API where a caller accidentally materializes one million tuples to
answer a count question.

Document complexity expectations for each public operation.

Example:
position_stats bounded / O(log N)
first_occurrence bounded / O(log N)
occurrences(limit: n) O(log N + n)
all_occurrences O(log N + run_length)
pawn_bucket(limit: n) bounded by n


Only recommend this shape if supported by the implementation investigation.

---

# Phase L — Format/version migration

If a packed format change is recommended, design migration safely.

Address:

- format version
- manifest version
- old corpus compatibility
- rebuild requirements
- atomic publish
- checksum validation
- rollback
- current production corpus replacement
- PG parity validation

Because packed data is derived, a full repack may be preferable to an
in-place migration.

State which approach you recommend.

Do not build complicated migration machinery if rebuilding is simpler and
safer.

---

# 10M+ scaling model

Produce a scaling model based on measured current data.

For the recommended design estimate at:

- current 1.17M games
- 10M games
- optionally 50M games

Estimate:

- packed storage
- metadata/index storage
- boot memory
- boot time
- count lookup complexity
- full occurrence lookup complexity
- hot-key Historical Evidence cost
- expected peak request memory

Clearly distinguish:

- measured numbers
- calculated projections
- uncertain assumptions

The desired architectural property is more important than an optimistic
exact millisecond prediction.

---

# Acceptance principles

A good recommended design should satisfy:

1. Historical Evidence count/stat queries are bounded with respect to a
   hot position's occurrence count.

2. Full occurrence retrieval remains available but is explicitly expensive.

3. A start-position query cannot allocate hundreds of MB simply to compute
   card metadata.

4. Starting OpenChessLab does not require millions of tiny `pread`s.

5. Light/moderate queries remain at least as fast as today.

6. Exact Historical Evidence semantics remain unchanged.

7. Independent-game counts remain semantically correct.

8. The packed store retains its storage/build advantages where the evidence
   supports them.

9. The architecture remains viable for 10M+ games.

10. Operational recovery from deploy/restart becomes seconds-scale rather
    than minutes-scale.

---

# Do not optimize these without new evidence

The existing investigation found these insignificant or inappropriate as
primary fixes:

- persistent file descriptors
- broad cross-request caches
- naive parallelization
- PostgreSQL moves/game queries
- DTO / JSON serialization

Do not spend implementation effort on them unless new measurements overturn
the existing findings.

---

# Required deliverable

Write:

`docs/technical-spike-09-packed-corpus-production-design-review.md`

The report must contain:

## 1. Executive verdict

State clearly:

- Is packed binary still the correct occurrence backend?
- Was the architecture wrong, the implementation wrong, or both?
- What specifically caused the spike → production discrepancy?

## 2. Evidence reconciliation

Spike 08 vs current production measurements.

## 3. Current access-pattern map

Table of corpus operations, complexity and actual callers.

## 4. Root architectural issues

Ranked by severity.

## 5. Immediate production-safe fix

Smallest change, expected effect and regression risks.

## 6. Recommended packed format vNext

Exact fields/layout changes if any.

For every new field include byte/storage cost.

## 7. Boot/index design

Recommended anchor/index lifecycle.

## 8. Runtime concurrency model

Recommendation for the Corpus GenServer boundary.

## 9. PostgreSQL comparison

Fair current-workload comparison.

## 10. 10M+ scaling model

Measured vs projected values clearly labeled.

## 11. Migration plan

How to move safely from current packed format to the recommended version.

## 12. Benchmark results

Before/experimental-after measurements.

## 13. Implementation plan

Break implementation into small independently verifiable phases.

For each phase include:

- scope
- expected result
- tests
- benchmark gate
- rollback strategy

## 14. Decision table

At minimum compare:

- current packed
- current packed + pipeline fix
- packed format vNext
- PostgreSQL
- hybrid where relevant

## 15. Final recommendation

Make one clear recommendation.

Do not finish with several equally weighted options.

---

# Important working rules

- Investigation first.
- Temporary scripts/worktrees are allowed.
- Do not commit production changes.
- Do not deploy.
- Production access, if used, must be read-only except for ordinary endpoint
  requests explicitly needed for measurement.
- Avoid intentionally triggering another production OOM.
- Prefer local reproduction for hot-key stress tests.
- Preserve all existing product semantics.
- Record actual measurements, not impressions.
- Label projections as projections.
- If an assumption from Spike 08 is disproven, say so explicitly.
- If the current packed architecture is vindicated, say so explicitly too.

Stop after the design-review report.
Do not implement the recommended production architecture in this task.