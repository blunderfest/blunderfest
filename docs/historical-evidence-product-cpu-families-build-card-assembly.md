# OpenChessLab Technical Spike
## Historical Evidence Product CPU — Families.build + Card Assembly

### Mission

Investigate and reduce the remaining Historical Evidence CPU cost after the
Packed Corpus v2 cutover work.

Phase 3 proved that packed-corpus access is no longer the dominant cost.

On the broadcast 1.17M corpus, warm start-position Historical Evidence was
approximately:

```text
total             ~1,467 ms

Families.build      ~878 ms   (~60%)
card/evidence       ~510 ms   (~35%)
PG hydration         ~69 ms   (~5%)
candidates           ~11 ms   (~1%)
````

The Phase 3 latency gate was:

```text
start-position HE < 1 second
```

and was not met.

The memory gate passed comfortably.

This spike focuses ONLY on the remaining product-CPU cost:

* `Families.build`
* per-card evidence/comparison assembly
* repeated membership/skeleton/difference work around those stages

Do NOT optimize storage.
Do NOT change corpus format.
Do NOT change candidate semantics.
Do NOT change PostgreSQL topology or cross-region behavior.
Do NOT change the Corpus GenServer concurrency architecture.

The purpose of this spike is to determine which CPU optimizations are both:

1. materially useful; and
2. semantics-preserving.

---

# Required source material

Read before changing code:

1. `docs/packed-corpus-phase3-runtime-cutover.md`
2. `docs/technical-spike-09-packed-corpus-production-design-review-report.md`
3. Historical Evidence architecture/design documentation
4. current implementations of:

   * `Families`
   * `Differences`
   * `Skeleton`
   * Historical Evidence pipeline/card assembly
   * candidate grouping
   * continuation family handling
   * DTO builders
5. current parity/benchmark tasks

Use current code as the final authority if documentation is stale.

Do not reopen the packed-corpus decisions from Phases 0–3.

---

# Critical product constraint

Historical Evidence is not merely a performance pipeline.

Its output semantics matter.

Do not change:

* which candidates are considered
* candidate ranking
* similarity scoring
* exact vs structural evidence meaning
* continuation-family semantics
* route/history semantics
* independent-game support semantics
* card ordering
* DTO field meaning
* family membership meaning
* skeleton membership meaning

Any optimization that changes output semantics is invalid unless explicitly
isolated as a separate future product proposal.

This spike is about equivalent computation, not a new algorithm.

---

# Phase A — Reproduce the Phase 3 baseline

Before optimizing anything, reproduce the current warm baseline using the v2
broadcast corpus.

Use the permanent benchmark positions:

* start
* after 1.e4
* after 1.d4
* Najdorf
* F1 KID
* A2 Ruy
* rare middlegame
* endgame

Record at minimum:

```text
total_ms
candidates_ms
menu/family_ms
evidence/card_ms
pg_ms
peak_memory
```

For the start position, repeat enough runs to characterize variance.

Report:

* individual runs
* median
* p90/p95 if useful
* min/max

Do not treat one unusually fast run as the baseline.

---

# Phase B — Instrument the CPU stages

Add temporary or permanent lightweight instrumentation to decompose:

## Families.build

Measure separately, where possible:

* input preparation
* pairwise comparisons
* distance/similarity calculations
* clustering/linkage work
* family construction
* membership assignment
* sorting
* deduplication
* normalization
* repeated traversal of the same candidate data

## Card/evidence assembly

Measure separately:

* Differences computation
* family membership lookup
* Skeleton membership
* route/context derivation
* historical support/count formatting
* card DTO construction
* sorting/filtering
* repeated game/move lookup wrappers excluding `pg_ms`

Do not build a general profiler framework.

Use enough instrumentation to answer:

> Which exact functions and loops consume the 878 ms and 510 ms?

---

# Phase C — Use a real CPU profiler

Run an appropriate Elixir/BEAM profiler on the hot start-position request.

Use tooling already available in the repository/runtime where practical.

Examples may include:

* `:eprof`
* `:fprof`
* `:cprof`
* sampling/profiling tooling already present

Do not choose a profiler merely because it is familiar.

Capture:

* top functions by total CPU/time
* call counts
* self time where available
* repeated hot call chains

Correlate profiler results with the stage instrumentation.

Do not optimize based only on intuition.

---

# Phase D — Build a computation graph

For the hot start-position request, document the logical computation flow.

Identify:

* how many candidates enter `Families.build`
* how many cards are ultimately emitted
* how many family comparisons are performed
* how many times each candidate is inspected
* how many `Differences` computations occur
* how many family-membership lookups occur
* how many skeleton-membership computations occur
* how many of these operations repeat equivalent work

Where practical, count invocations.

The main question is:

> Are we spending CPU because the algorithm is inherently expensive, or
> because the same derived values are recomputed many times?

---

# Phase E — Identify semantics-preserving opportunities

Classify opportunities into categories.

## 1. Request-local memoization

Examples:

* same candidate pair compared multiple times
* same position difference computed multiple times
* same family membership recomputed for multiple cards
* same skeleton classification recomputed
* same normalized structure recomputed

Request-local memoization is preferred where it removes duplicate work
without changing semantics.

Rules:

* plain explicitly threaded maps where practical
* no global cache
* no ETS unless existing architecture already requires it and the reason is
  demonstrated
* no process dictionary
* no cross-request hidden state

Do not memoize huge structures blindly.

Measure memory impact.

## 2. Precomputation within the request

Look for values that can be computed once before family/card loops and reused.

Examples:

* normalized candidate representation
* piece/square feature sets
* route metadata
* structural descriptors
* family lookup maps
* skeleton lookup maps

Only precompute values that are definitely used enough to justify the cost.

## 3. Data-structure improvements

Look for accidental expensive patterns such as:

* repeated linear `Enum.find`
* repeated `Enum.member?`
* repeated list concatenation
* repeated sorting
* building maps/sets inside inner loops
* repeated conversion between list/map/MapSet
* repeated key normalization
* repeated FEN/position parsing

Where semantics are unchanged, replace with better lookup structures.

## 4. Loop fusion / traversal reduction

Identify cases where the same collection is traversed repeatedly for closely
related outputs.

Prototype combining traversals only if code remains understandable and output
is identical.

## 5. Allocation reduction

Identify large temporary lists/maps/tuples built only to be immediately
discarded.

Measure before and after.

Do not trade clarity for tiny allocation wins.

---

# Phase F — Families.build deep analysis

`Families.build` is the primary target.

Do NOT replace the family algorithm.

First determine its actual complexity.

Document:

```text
n = number of windows/candidates
comparison count
linkage/clustering complexity
sorting complexity
membership complexity
```

Determine whether the measured ~878 ms is dominated by:

* O(n²) comparison count
* expensive comparison function
* repeated pair calculation
* clustering implementation
* repeated sorting
* allocation
* redundant membership work
* another cause

If it is O(n²), quantify the actual n and comparison count.

Do not merely write "quadratic".

---

# Single-linkage requirement

Phase 3 described `Families.build` as single-linkage clustering over up to
approximately 2000 windows.

If that is accurate in current code:

* inspect the exact implementation;
* determine whether it recomputes pair distances;
* determine whether it materializes a full pair matrix;
* determine whether repeated scans occur;
* determine whether existing data structures make the implementation worse
  than the mathematical algorithm requires.

You MAY optimize the implementation of single-linkage.

You MAY NOT change the clustering definition or threshold semantics.

For any optimized implementation, prove that family memberships are exactly
identical.

---

# Phase G — Card assembly deep analysis

The Phase 3 profile measured roughly:

```text
~510 ms across ~22 cards
~23 ms/card
```

Investigate whether card work is actually independent per card or whether
common inputs are repeatedly recomputed.

Pay particular attention to:

* `Differences`
* `Families.membership`
* `Skeleton.membership`
* reference-position normalization
* candidate-position normalization
* move/route derivation
* common comparison features

Build a per-card trace for at least the start-position request.

Report what is reused and what is recomputed.

---

# Phase H — Controlled prototypes

Implement optimizations one at a time.

Do not batch several ideas into one benchmark.

For each prototype record:

```text
change
expected reason for speedup
affected functions
semantic risk
baseline timing
new timing
memory impact
DTO parity
family-membership parity
```

Revert failed experiments or clearly isolate them.

Preferred order:

1. remove obvious duplicate work
2. replace accidental poor lookup structures
3. request-local memoization
4. traversal/allocation improvements
5. implementation-level clustering optimization

Do not start with a major rewrite.

---

# Phase I — Parity gates after every meaningful change

Every accepted optimization must preserve:

## Full HE DTO parity

Required positions:

* start
* 1.e4
* 1.d4
* Najdorf
* F1
* A2
* rare
* endgame

Expected:

```text
0 unexplained differences
```

## Family parity

For a larger sample, compare before/after:

* number of families
* membership of every candidate
* family identifiers where stable/observable
* ordering where product-visible
* singleton behavior

If identifiers are incidental but memberships are identical, normalize only
the incidental identifiers before comparison.

Do not normalize product-visible differences away.

## Skeleton parity

If touched indirectly, compare membership/results exactly.

## Differences parity

If cached/precomputed/refactored, compare results field-for-field.

---

# Phase J — Representative broader corpus sample

Do not optimize only for the start position.

Construct a deterministic sample covering:

* very hot opening positions
* medium opening positions
* transpositional positions
* positions with many structural candidates
* positions with few candidates
* same-game-heavy evidence
* rare positions
* middlegame
* endgame

Use existing corpus fixtures/benchmark positions where possible.

For each accepted optimization, check that no class becomes materially slower.

---

# Phase K — Memory and allocation

Memory already passes the production gate.

Do not regress it.

For the start position record:

```text
BEAM total peak
process memory where useful
reductions if useful
GC count/time if observable
```

Any CPU optimization that substantially increases memory must justify the
tradeoff.

Hard requirement:

```text
start-position HE peak < 300 MB
```

Prefer remaining near the current ~100–140 MB behavior.

---

# Phase L — Variance / GC analysis

Phase 3 observed notable timing variance:

```text
gate runs median ~1,467 ms

but separate n=1 concurrency probe ~1,107 ms
```

Investigate whether variance comes from:

* GC
* cache warmness
* JIT/code warmness
* PG noise
* scheduler effects
* menu/family caching
* benchmark methodology

Do not assume the fastest observed run represents steady-state product
performance.

Document a reproducible benchmark protocol.

---

# Phase M — Performance target

Primary target remains:

```text
warm start-position Historical Evidence < 1,000 ms
peak memory < 300 MB
```

But the spike should also report stage-specific targets.

A useful success condition would be:

```text
Families.build + card assembly
reduced enough that total warm HE median is < 1,000 ms
```

Do not achieve this by:

* reducing candidate caps
* returning fewer cards
* changing family thresholds
* skipping evidence
* changing DTO content
* using stale/global caches
* changing product semantics

If <1s cannot be reached without semantic change, report that clearly.

---

# Phase N — Cross-region PG remains parked

Do NOT optimize:

* `ord → ams` PostgreSQL round trips
* game/move hydration batching
* replicas
* PG region placement
* Fly routing

The local profile shows PG hydration around ~69 ms, while product CPU is
~1.4 s.

Keep `pg_ms` separate so this spike does not attribute PG cost to product
CPU.

The cross-region issue remains a separate follow-up after this CPU pass and
v2 cutover decision.

---

# Phase O — Corpus GenServer remains out of scope

Do not redesign:

* Corpus process ownership
* read serialization
* worker pools
* immutable reader processes
* async reads

Phase 3 proved packed reads are now cheap.

This spike measures product CPU only.

---

# Decision point

At the end of the spike, choose ONE outcome:

## A — Safe optimization found, <1s reached

If exact parity is preserved and the benchmark gate passes:

Recommend shipping the optimization together with the Phase 3 v2 runtime
cutover.

Do not automatically deploy unless the task/environment explicitly authorizes
it.

## B — Safe optimization found, but <1s not reached

Report:

* achieved improvement
* remaining dominant stage
* whether further semantics-preserving optimization is plausible

Recommend the smallest next step.

## C — Remaining cost is inherent to current semantics

If profiling shows the current family/evidence semantics inherently require
the remaining CPU:

STOP.

Do not silently change product behavior.

Document which semantic/product decision would be required for further speed.

---

# Required report

Write:

`docs/technical-spike-he-product-cpu.md`

Include:

## 1. Executive verdict

State:

* baseline
* best safe result
* whether <1s passed
* whether semantics changed

## 2. Baseline reproduction

Include variance, not just one run.

## 3. CPU profile

Top functions and call counts.

## 4. Families.build analysis

Explain actual complexity and hot operations.

## 5. Card assembly analysis

Explain repeated work and per-card cost.

## 6. Computation graph

Show where expensive derived values are calculated and reused/recomputed.

## 7. Optimization candidates

Rank by:

* expected impact
* semantic risk
* implementation complexity

## 8. Experiments

For every attempted optimization:

```text
idea
result
timing
memory
parity
accepted/rejected
```

Include rejected experiments.

## 9. Final implementation

If safe optimizations are retained, explain exactly what changed.

## 10. Correctness

Provide:

* HE DTO parity
* family parity
* differences parity
* skeleton parity
* broader-sample results

## 11. Performance

Before/after tables for all permanent benchmark positions.

## 12. Memory / GC

Report peak memory and any relevant GC findings.

## 13. Gate result

Explicitly state:

```text
start median:
start p90/p95:
peak memory:
<1s PASS/FAIL
<300MB PASS/FAIL
```

## 14. Remaining bottlenecks

Separate:

* Families CPU
* card assembly CPU
* PG hydration
* packed access

## 15. Recommendation

Choose:

* SHIP SAFE CPU OPTIMIZATION + PROCEED TO V2 CUTOVER
* KEEP OPTIMIZATION, CONTINUE CPU WORK
* NO SAFE CPU WIN; PRODUCT-SEMANTIC DECISION REQUIRED

Do not give an ambiguous conclusion.

---

# Test requirements

Add focused regression tests for every retained optimization.

At minimum preserve:

* all existing 472 tests
* HE DTO parity
* family membership parity
* same-game-only semantics
* candidate output parity
* ordering parity
* light/rare/endgame behavior
* v1/v2 corpus compatibility

Any memoization/precomputation must have tests proving request isolation.

---

# Repository validation

Run:

```text
mix precommit
```

and all relevant:

```text
mix corpus.he_parity
mix corpus.he_bench
```

plus any new family/card-specific benchmark or parity task added for the
spike.

Do not weaken existing assertions to make parity pass.

---

# Hard stop

Do NOT continue into:

* v2 production deployment unless explicitly authorized after the result
* cross-region PostgreSQL optimization
* PG batching
* Fly topology
* Corpus GenServer redesign
* candidate cap changes
* family-threshold changes
* similarity/relevance redesign
* continuation-family product redesign
* frontend work

The result of this spike should tell us whether the remaining sub-1-second
gap is an implementation problem or a product-semantics cost.

```

Ik zou hier vooral streng vasthouden aan **“één optimalisatie tegelijk + parity na iedere betekenisvolle wijziging”**. De Phase 3-metingen geven genoeg aanleiding om te vermoeden dat er dubbele berekeningen of onhandige datastructuren zitten, maar nog niet genoeg om te concluderen dat het family-algoritme zelf vervangen moet worden. :contentReference[oaicite:0]{index=0}

Als deze spike `<1s` haalt zonder semantische wijziging, zou mijn volgende stap meteen de **v2 production cutover** zijn. Pas daarna pakken we het geparkeerde cross-region PG-probleem aan.
```
