# OpenChessLab Technical Spike
## Historical Evidence PostgreSQL Hydration + Cross-Region Latency

### Mission

Investigate and, where safely possible, eliminate the PostgreSQL hydration
latency that remains after the successful Packed Corpus v2 production
cutover.

Packed Corpus v2 is now production.

The storage, memory, startup, and Historical Evidence product-CPU problems
have been solved.

Production now exposes one isolated major bottleneck:

```text
                    ams (PG colocated)      ord → ams
start HE total      ~430 ms warm            ~10,195 ms
start pg_ms         ~288 ms warm            ~9,978 ms

A2 HE total         ~584 ms                 ~10,225 ms
A2 pg_ms            ~340 ms                 ~9,981 ms
````

Product CPU is effectively region-independent:

```text
start menu:
ams ~58 ms
ord ~59 ms
```

The packed corpus is local to each region and is also not the source of the
difference.

The remaining ~9–10 second penalty is therefore in the Historical Evidence
PostgreSQL hydration path across:

```text
ord → ams
```

The current request shape is known to involve approximately:

```text
moves_for
+
per-card game/moves hydration
(~22 cards in the normal hot-position result)
```

Do not assume the exact query count or exact cause beyond what measurement
proves.

The central question is:

> Can we reduce cross-region Historical Evidence hydration from ~10 seconds
> to near the colocated-Postgres order of magnitude by eliminating unnecessary
> PostgreSQL round trips, while preserving exactly the same product output?

This is primarily a measurement + architecture spike.

Batching is the leading hypothesis.

It is NOT a predetermined conclusion.

---

# Recommended model

Qwen3.8 Max xhigh.

The difficult part is not writing a bulk SQL query.

The difficult part is proving:

* what the current request actually does;
* where time is spent;
* which data dependencies can safely be combined;
* whether batching preserves semantics;
* whether batching alone solves the production problem;
* whether database/Fly topology work is still necessary afterward.

---

# Required source material

Read completely before changing code:

1. `docs/packed-corpus-v2-production-cutover.md`
2. `docs/technical-spike-he-product-cpu.md`
3. `docs/packed-corpus-phase3-runtime-cutover.md`
4. Historical Evidence architecture/design documentation
5. current Historical Evidence pipeline
6. current Postgres repository/query modules used by HE
7. current implementations of:

   * `moves_for`
   * game hydration
   * move hydration
   * card assembly
   * candidate/reference game lookup
8. relevant ADRs for:

   * PostgreSQL
   * corpus architecture
   * deployment/regions
9. current Fly/runtime configuration where needed to understand:

   * ams
   * ord
   * PostgreSQL location

Use current code as the final authority if documentation is stale.

Do not reopen decisions already settled by Packed Corpus Phases 0–3 or the HE
CPU spike.

---

# Proven production state

The production cutover succeeded.

Both:

```text
ams
ord
```

run Packed Corpus v2.

Production verification established:

```text
start:
  ams total      612 ms cold-ish → 430 ms warm
  ams pg_ms      397 ms → 288 ms

  ord total      10,195 ms
  ord pg_ms       9,978 ms

after 1.e4:
  ams total       488 ms
  ams pg_ms       333 ms

  ord total       9,644 ms
  ord pg_ms        9,485 ms

Najdorf:
  ams total       1,419 ms
  ams pg_ms         355 ms

  ord total      11,105 ms
  ord pg_ms        9,967 ms

A2:
  ams total         584 ms
  ams pg_ms          340 ms

  ord total       10,225 ms
  ord pg_ms         9,981 ms
```

The product output was verified correct.

Do not repeat the packed-corpus investigation.

---

# Hard architectural constraints

For the investigation and initial prototypes:

Do NOT:

* move PostgreSQL
* create a PostgreSQL replica
* change Fly regions
* remove ord
* add region-aware routing
* resize machines
* change Packed Corpus
* change Corpus GenServer
* change candidate limits
* return fewer Historical Evidence cards
* omit game/move information
* change card ordering
* change family semantics
* change Historical Evidence DTO semantics
* introduce a global cache
* introduce cross-request mutable state

Those may be discussed as later alternatives if batching proves insufficient,
but they are not implementation options in this spike.

Prefer fixing the request shape before changing infrastructure topology.

---

# Phase A — Map the current hydration path

Before optimizing, document exactly how one Historical Evidence request
reaches PostgreSQL.

Start from:

```text
Pipeline.analyze
```

or its current equivalent.

Trace every PostgreSQL call caused by one normal 22-card hot-position
request.

Produce a call graph such as:

```text
HE request
  |
  +-- moves_for(...)
  |
  +-- card 1
  |     +-- game(...)
  |     +-- moves(...)
  |
  +-- card 2
  |     +-- game(...)
  |     +-- moves(...)
  |
  ...
```

but use the actual code.

For every call record:

```text
caller
repository/API function
SQL/query
arguments
result shape
whether result is card-specific
whether gid repeats
whether query is sequential
whether query could theoretically be batched
```

Do not infer the number of round trips from the number of cards.

Measure it.

---

# Phase B — Count actual PostgreSQL round trips

Add focused instrumentation around the PostgreSQL calls used by HE.

For each HE request record:

```text
total PG calls
query type counts
unique gids requested
duplicate gids requested
rows returned
bytes returned if practical
total DB query execution time
total caller-observed wait time
```

Distinguish:

```text
database execution time
network/round-trip latency
Elixir processing time
```

Use Ecto telemetry or existing repository telemetry where possible.

Do not build a new observability framework.

The spike must answer:

> How many network round trips does one 22-card request actually perform?

and:

> How much of the ~10 seconds is SQL execution versus network waiting?

---

# Phase C — Establish network latency

Measure representative PostgreSQL round-trip latency from:

```text
ams → ams PG
ord → ams PG
```

Use a minimal safe query or existing lightweight repository operation.

Repeat enough times to establish:

```text
median
p90/p95
min/max
```

Then compare:

```text
measured RTT × observed sequential round trips
```

against the production `pg_ms`.

We want a quantitative explanation of the ~9–10 second result.

Do not merely state "cross-region latency".

---

# Phase D — Analyze data dependencies

For one representative 22-card request, determine exactly what PostgreSQL
data is required before the final DTO can be assembled.

Classify it:

## Reference/request-level data

Examples may include:

```text
moves_for(reference)
reference game/move information
```

Use actual code semantics.

## Card-level data

For every card determine whether it needs:

```text
game metadata
moves
route prefix
player information
event information
result
date
other fields
```

Again: use actual code.

Produce a concrete required-data inventory.

---

# Phase E — Determine unique hydration set

The final cards may not correspond to 22 unique games.

Measure for each permanent benchmark position:

```text
cards
unique gids
duplicate gids
unique move lists required
unique game rows required
```

Required positions:

* start
* after 1.e4
* after 1.d4
* Najdorf
* F1 KID
* A2 Ruy
* rare middlegame
* endgame

This tells us whether deduplication alone provides meaningful benefit before
batching.

---

# Phase F — Audit existing bulk APIs

Before adding anything, inspect the repository for existing APIs capable of
fetching:

```text
multiple games
multiple games' moves
moves grouped by gid
game + moves together
```

Also inspect whether similar batching already exists elsewhere in the
application.

Do not add a second abstraction if a correct existing one can be reused.

Document what exists and why it is or is not suitable.

---

# Phase G — Establish hypotheses

Based on measurement, rank possible solutions.

At minimum evaluate conceptually:

## H1 — Deduplicate existing hydration

Fetch each unique gid only once per request while retaining existing query
APIs.

Expected benefit:

```text
remove duplicate calls
```

but still potentially many round trips.

## H2 — Batch game metadata

Conceptually:

```elixir
games(gids)
```

rather than:

```elixir
Enum.map(gids, &game/1)
```

Measure the resulting round-trip reduction.

## H3 — Batch moves

Conceptually:

```elixir
moves_for_games(gids)
```

returning something like:

```elixir
%{
  gid => [...]
}
```

rather than one moves query per card/game.

Preserve move ordering exactly.

## H4 — Combined HE hydration

Evaluate whether one repository call can fetch the complete card hydration
set:

```text
game metadata
+
moves
```

for all required gids.

This does NOT necessarily mean one SQL statement.

A repository API using two bulk SQL queries may be cleaner and just as
effective.

Do not optimize for "fewest SQL statements" at the expense of maintainability.

The actual objective is:

```text
few sequential cross-region round trips
```

## H5 — Parallelize existing calls

Evaluate but do not assume this is desirable.

Parallel N+1 queries may hide latency while increasing:

```text
connection demand
DB load
scheduler work
failure complexity
```

Compare against batching.

Batching should generally be preferred if it naturally matches the data
shape.

Do not implement uncontrolled `Task.async_stream` fan-out as the default
solution.

---

# Phase H — Define the desired repository boundary

If batching is justified, design a product-oriented repository API.

Avoid leaking query mechanics throughout the Historical Evidence pipeline.

Possible conceptual shape:

```elixir
hydrate_games(gids)
```

returning:

```elixir
%{
  gid => %{
    game: ...,
    moves: [...]
  }
}
```

or separate:

```elixir
games(gids)
moves_for_games(gids)
```

Choose based on actual existing abstractions.

Requirements:

* input gids may be unordered
* duplicates must not cause duplicate database work
* output must be efficiently addressable by gid
* missing games must preserve existing behavior
* move ordering must be exact
* no global cache
* request isolation
* deterministic output

Do not change public HE DTOs.

---

# Phase I — Prototype batching

After the baseline is fully measured, implement the smallest viable
semantics-preserving prototype.

Preferred experiment order:

1. deduplicate hydration inputs
2. batch game metadata
3. batch moves
4. combine the repository-facing hydration flow if useful

Measure after each meaningful experiment.

Do not land all ideas at once without attribution.

For every experiment record:

```text
PG round trips
SQL queries
rows returned
pg_ms ams
pg_ms ord
total HE ams
total HE ord
memory
DTO parity
```

The most important metric is the production-like:

```text
ord → ams
```

path.

---

# Phase J — SQL design requirements

If bulk SQL is introduced:

* use parameterized queries / normal Ecto mechanisms
* avoid dynamically concatenated SQL
* preserve deterministic move ordering
* fetch only fields HE actually needs where practical
* avoid accidental Cartesian products
* avoid multiplying game metadata once per move unless measured and justified
* inspect query plans for representative batch sizes
* verify indexes are used
* test:

  * 0 gids
  * 1 gid
  * typical ~22 gids
  * duplicate gids
  * missing gid
  * larger safe batch

Do not add indexes unless measurement/query plans prove an existing indexing
problem.

The current evidence points to round-trip latency, not slow SQL.

---

# Phase K — Avoid payload amplification

Batching can reduce round trips while accidentally transferring far more data.

Measure approximate:

```text
rows
moves
payload size
```

before/after.

Pay special attention if using a join such as:

```text
games JOIN moves
```

because game metadata may be repeated for every move.

Compare:

```text
one joined query
```

against:

```text
one games query
+
one moves query
```

The latter may be preferable despite being two round trips.

Choose based on measured end-to-end cost and code clarity.

---

# Phase L — Preserve request-level work

Do not accidentally batch or repeat work that is already request-level.

Inspect `moves_for` carefully.

Determine:

* what it means
* whether it overlaps with card move hydration
* whether its result can share the same bulk query/data
* whether merging it would simplify or complicate semantics

Do not merge it merely to reach "one query".

If it describes a distinct product concept, preserve that boundary.

---

# Phase M — Correctness gates

Every retained optimization must preserve Historical Evidence output exactly.

Required DTO parity:

* start
* 1.e4
* 1.d4
* Najdorf
* F1
* A2
* rare
* endgame
* same-game-heavy fixture

Expected:

```text
9/9 identical
0 unexplained differences
```

Strip only timing/diagnostic fields.

Also explicitly verify:

```text
card ordering
game metadata
move ordering
route/context
occurrence support
independent-game support
same_game_only
family/menu output
```

Do not normalize away product-visible differences.

---

# Phase N — Failure semantics

Current individual hydration calls may have established behavior for:

```text
missing game
missing moves
database error
partial result
```

Determine those semantics before batching.

The batch API must preserve them.

Do not turn:

```text
one missing game
```

into:

```text
entire HE request crashes
```

unless that is already current behavior.

Likewise, do not silently ignore missing data that previously caused an error.

Add focused tests.

---

# Phase O — Local benchmarks

Benchmark with PostgreSQL colocated first to measure SQL/application overhead
without WAN latency.

Use the permanent positions:

```text
start
1.e4
1.d4
Najdorf
F1
A2
rare
endgame
```

Record:

```text
unique gids
PG round trips
query execution ms
pg_ms
HE total_ms
```

The colocated path must not materially regress.

A small difference is acceptable if the cross-region architecture becomes
dramatically better, but quantify it.

---

# Phase P — Production-like cross-region benchmark

This is the critical experiment.

Measure the optimized implementation from:

```text
ord
```

against PostgreSQL in:

```text
ams
```

Use the same representative requests used during the v2 cutover.

At minimum:

* start
* after 1.e4
* Najdorf
* A2

Record repeated runs.

Report:

```text
median
range/p90 where practical
PG round trips
pg_ms
total_ms
```

Do not compare one cold before-run with one warm after-run.

---

# Performance target

The goal is not an arbitrary query count.

The goal is to remove the pathological ~10 second cross-region latency.

Primary desired result:

```text
ord Historical Evidence:
  no longer dominated by sequential PG round trips
```

A strong success target is:

```text
start ord pg_ms < 1,000 ms
start ord total < 1,500 ms
```

Prefer substantially better if the natural batching design achieves it.

Do NOT reach the target by:

* returning fewer cards
* omitting moves
* reducing candidate limits
* caching across requests
* changing product semantics
* routing the request to ams
* moving the database

If a clean batching implementation reaches approximately the same order of
magnitude as ams, that is the preferred result.

---

# Phase Q — Database load / connection behavior

A solution that makes one request faster by hammering PostgreSQL is not
acceptable.

Compare before/after:

```text
queries/request
connections used/request
rows/request
query execution time
```

For the retained solution, run a small safe concurrency probe:

```text
n = 1
n = 2
n = 4
```

Record:

```text
wall time
pg_ms
errors
connection-pool pressure if observable
memory
```

Do not redesign the pool in this spike.

---

# Phase R — Decide whether topology work is still needed

After the batching prototype is measured, answer:

> Is PostgreSQL topology still a material Historical Evidence problem?

Choose one:

## Outcome A — Batching solves it

If ord becomes acceptably close to ams:

Recommend keeping the existing:

```text
single PostgreSQL location
ams + ord app regions
```

for now.

Do not propose replicas without a demonstrated need.

## Outcome B — Batching helps substantially but WAN RTT remains material

Quantify the residual.

Then identify the smallest topology follow-up, but do not implement it.

Possible future questions may include:

```text
route HE to ams
read replica in ord
regional data placement
```

These become a separate architecture decision.

## Outcome C — Batching does not solve it

Explain why.

Show whether the remaining cost is:

```text
query execution
payload transfer
network RTT
connection behavior
another dependency
```

Do not jump straight to a replica without evidence.

---

# Production implementation policy

This spike may retain a safe batching implementation in the codebase if:

* exact DTO parity passes
* repository semantics are clean
* local benchmarks do not materially regress
* cross-region measurements show clear improvement
* all tests pass

However:

Do NOT deploy to production automatically unless the existing task environment
and workflow explicitly authorize deployment for this spike.

If deployment is not authorized, stop with a deployment-ready recommendation
and exact verification procedure.

If the assignment/environment explicitly permits production verification,
use the same operational discipline as the v2 cutover:

* health first
* representative HE probes
* both regions
* memory
* logs
* rollback readiness

Do not make infrastructure changes.

---

# Instrumentation

Retain lightweight useful instrumentation if it helps future diagnosis.

A useful final `pg_ms` split may distinguish:

```text
reference/request-level PG
bulk game hydration
bulk move hydration
```

Do not expose excessive internal diagnostics in the public DTO unless the
current architecture already does so.

Do not leave heavyweight profiler hooks enabled in normal production.

---

# Tests

Add focused tests for the retained implementation.

At minimum:

1. empty gid batch
2. one gid
3. normal multi-gid batch
4. duplicate gids
5. missing gid
6. game metadata parity with individual lookup
7. move-list parity with individual lookup
8. exact move ordering
9. HE DTO parity
10. card ordering
11. route/context parity
12. same-game fixture
13. independent-game semantics unchanged
14. family/menu unchanged
15. failure behavior
16. request isolation
17. no duplicate DB work for duplicate gids
18. deterministic result independent of input gid order

Keep all existing tests.

Do not weaken assertions.

---

# Repository validation

Run:

```text
mix precommit
```

Current baseline after the CPU spike:

```text
480 tests
```

Final count may increase.

Also run all relevant:

```text
mix corpus.he_parity
mix corpus.he_bench
mix corpus.he_cpu --compare
```

plus the new PG hydration benchmark/instrumentation task if one is added.

No warnings.

---

# Required report

Write:

`docs/technical-spike-he-postgres-hydration.md`

Include:

## 1. Executive verdict

Choose exactly one:

```text
BATCHING SOLVES CROSS-REGION LATENCY
```

or:

```text
BATCHING HELPS, TOPOLOGY FOLLOW-UP STILL JUSTIFIED
```

or:

```text
BATCHING DOES NOT SOLVE THE BOTTLENECK
```

Do not give an ambiguous conclusion.

## 2. Production baseline

Use the successful v2 cutover measurements.

## 3. Current hydration call graph

Show every PG operation caused by one representative HE request.

## 4. Round-trip accounting

Provide:

```text
query type
call count
unique gids
DB execution time
caller-observed time
```

Explain quantitatively where the ~10 seconds comes from.

## 5. RTT measurement

Compare ams and ord.

## 6. Data requirements

Document exactly what the HE DTO needs from PostgreSQL.

## 7. Existing repository APIs

Document reusable bulk functionality and missing pieces.

## 8. Hypotheses

Evaluate:

* deduplication
* bulk games
* bulk moves
* combined hydration
* parallel individual calls

Explain why each was accepted/rejected.

## 9. Experiments

For each prototype:

```text
change
queries/request
round trips
ams pg_ms
ord pg_ms
total HE
payload
memory
parity
verdict
```

## 10. Final repository/API design

If batching is retained, document its exact contract and failure semantics.

## 11. SQL/query plans

Document relevant queries and index usage.

Do not dump enormous EXPLAIN output; summarize what matters.

## 12. Correctness

Provide full DTO parity and repository-level parity results.

## 13. Performance

Before/after for all permanent positions.

Include repeated cross-region measurements.

## 14. Concurrency / DB load

Report n=1/2/4 behavior and query-count reduction.

## 15. Remaining latency

Break final request time into:

```text
packed access
product CPU
PG hydration
DTO/other
```

## 16. Topology decision

Explicitly answer whether replicas/routing/DB relocation are still justified.

## 17. Recommendation

Choose one concrete next action.

---

# Acceptance criteria

The spike is complete only if:

1. the exact HE PostgreSQL call graph is documented;
2. actual round trips are counted;
3. ams and ord RTT are measured;
4. SQL execution is distinguished from network waiting;
5. unique hydration requirements are measured;
6. existing bulk APIs are audited;
7. at least the natural batching approach is prototyped;
8. exact HE DTO parity is preserved;
9. move ordering is preserved;
10. failure semantics are preserved;
11. local/ams performance does not materially regress;
12. ord cross-region performance is measured repeatedly;
13. DB query/load impact is quantified;
14. `mix precommit` is green;
15. the report gives one unambiguous architecture verdict.

---

# Hard stop

Do NOT continue into:

* PostgreSQL replica creation
* database migration
* database-region relocation
* Fly routing changes
* removing ord
* machine resizing
* connection-pool redesign
* global caching
* Corpus GenServer redesign
* Packed Corpus changes
* HE family changes
* candidate changes
* frontend work

If batching solves the problem, stop.

If it does not, the next task is a separately reviewed topology decision based
on the measurements from this spike.
