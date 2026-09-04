# OpenChessLab — Historical Examples Performance Investigation
## Binary Corpus / Production Latency

## Objective

OpenChessLab recently deployed the binary-file corpus implementation from Spike 1.

Since that deployment, searching for Historical Examples in production takes approximately 10 seconds.

The feature is functionally correct, but the latency is unacceptable.

This task is a PERFORMANCE INVESTIGATION.

Do NOT optimize or refactor yet.

The objective of this ticket is to determine, with measurements and evidence:

> Why does Historical Examples take ~10 seconds in production after the binary corpus deployment?

The outcome must be a root-cause report, not a speculative optimization patch.

---

# Important product constraint

Historical Examples / Historical Evidence is intentionally richer than a simple exact-position lookup.

It may perform:

- candidate generation
- similarity-based retrieval
- historical context lookup
- independent-game handling
- filtering
- ranking
- game/position reconstruction
- result enrichment

Do NOT improve performance by silently changing:

- candidate-generation semantics
- similarity semantics
- filtering criteria
- ranking/relevance logic
- continuation/context logic
- independent-game semantics
- result quality
- number of conceptual retrieval stages
- number of returned examples

unless a semantic bug is explicitly discovered and documented.

The first optimization target must be the implementation:

- binary index access
- file I/O
- repeated reads
- decoding
- lookup strategy
- candidate expansion
- duplicated work
- data structures
- process boundaries
- batching
- request orchestration

Do not trade result quality for speed during this investigation.

---

# Current binary corpus architecture

The production corpus is segmented.

Each segment contains:

- `occ.bin`
- `pos.bin`
- `bucket.bin`

Conceptually:

    seg-000001/
      occ.bin
      pos.bin
      bucket.bin

    seg-000002/
      occ.bin
      pos.bin
      bucket.bin

    ...

The storage layer can open multiple segments and merge results across them.

Segmentation was introduced primarily for corpus build/update/compaction behavior.

Do NOT assume segment lookup overhead is negligible.

The current implementation may also use per-call file descriptors around `pread`
operations to avoid shared file-position / ownership issues.

Verify the actual implementation.

Do not assume this is the bottleneck.

Measure it.

---

# Investigation principles

Follow these rules throughout the investigation:

1. Measure before optimizing.
2. Do not assume disk I/O is the bottleneck.
3. Do not assume CPU is the bottleneck.
4. Do not assume production hardware is the bottleneck.
5. Do not assume segmentation is the bottleneck.
6. Do not assume binary storage is inherently faster or slower.
7. Do not add caching before understanding the underlying cost.
8. Do not parallelize blindly.
9. Do not change product semantics.
10. Account for as much of the ~10 seconds as possible.

Prefer measured evidence over code inspection alone.

---

# Phase A — Trace the complete request path

Trace the complete execution path for a Historical Examples request.

Start from the public application entry point and follow it through:

1. Phoenix controller / channel / API entry point
2. application/service layer
3. Historical Examples retrieval
4. candidate generation
5. binary storage/index layer
6. occurrence retrieval
7. game/position decoding
8. position reconstruction
9. filtering
10. independent-game handling
11. ranking / annotation
12. response construction
13. response serialization

Produce a call flow similar to:

    request
      ↓
    Phoenix entry point
      ↓
    historical examples service
      ↓
    candidate generation
      ↓
    binary index lookup
      ↓
    occurrence/game retrieval
      ↓
    decode/reconstruct
      ↓
    filter/rank
      ↓
    response

For every important step identify:

- module
- function
- input size
- output size
- whether it performs I/O
- whether it loops over candidates
- whether it loops over occurrences
- whether it loops over games
- whether it loops over segments
- whether it materializes intermediate lists
- whether it performs repeated work
- whether it can trigger nested storage lookups

Do not change implementation during this phase.

---

# Phase B — Establish a representative slow query

Choose at least one representative production query that reproduces the ~10 second latency.

Record enough information to reproduce it reliably.

Prefer a Historical Examples request that:

- is known to be slow in production
- returns a meaningful number of candidates
- exercises the normal retrieval pipeline
- is not an artificial edge case

Document:

- input position / identifier
- relevant request parameters
- candidate limit if applicable
- production response time
- final result count

If multiple distinct slow queries are available, use at least two to avoid drawing conclusions from one pathological position.

---

# Phase C — Measure stage timings

Instrument the request path.

Use existing telemetry/logging/profiling facilities where practical.

If lightweight temporary instrumentation is necessary:

- keep it isolated
- clearly mark it as diagnostic
- do not mix it with unrelated changes

Measure wall-clock duration for at least:

- request parsing/setup
- target-position preparation
- initial index lookup
- candidate generation
- bucket lookup
- position lookup
- occurrence lookup
- cross-segment merge
- game loading
- binary reads
- decoding
- chess position reconstruction
- move replay
- filtering
- similarity calculation
- historical-context enrichment
- independent-game deduplication
- ranking/sorting
- response serialization

The measurements should account for most of the observed ~10 seconds.

Do not report only total duration.

Desired structure:

    Total                          9.84 s
    Candidate generation           1.03 s
    Binary index lookups           0.42 s
    Game reads                     5.91 s
    Decoding/reconstruction        1.31 s
    Filtering/ranking              0.93 s
    Serialization                  0.24 s

Actual categories must follow the real implementation.

Try to account for at least ~90% of request time.

---

# Phase D — Quantify the work

For each representative slow request, capture counts for:

- production segment count
- logical storage lookups
- physical segment-level lookups
- index lookups
- bucket lookups
- position lookups
- occurrence lookups
- binary files opened
- file closes
- `pread` calls
- seeks if applicable
- total bytes read
- bytes read from `occ.bin`
- bytes read from `pos.bin`
- bytes read from `bucket.bin`
- number of candidate positions
- number of candidate occurrences
- number of distinct games touched
- number of games loaded
- number of games decoded
- number of positions reconstructed
- number of move sequences replayed
- number of duplicate candidate lookups
- number of duplicate game reads
- number of candidates discarded at each filtering stage
- number of final Historical Examples returned
- number of cross-segment merges

Where useful capture:

- min/median/max read size
- min/median/max lookup duration
- min/median/max decode duration
- min/median/max game load duration
- repeated reads of the same game
- repeated reads of the same binary region

We specifically want to distinguish patterns such as:

    500 candidate occurrences
      → 500 game loads
      → 500 decodes

from:

    500 candidate occurrences
      → 73 unique games
      → 73 game loads

or:

    200 logical lookups
      × 8 segments
      = 1,600 segment-level operations

or another expensive access pattern.

Do not assume which one is happening.

Measure it.

---

# Phase E — Segmented binary storage analysis

The production binary corpus is segmented.

Historical Examples lookups may therefore execute against multiple opened segments and merge the results afterwards.

Measure segmentation explicitly.

For the representative slow request determine:

- number of active/open segments
- which operations touch all segments
- which operations touch only one or a subset of segments
- number of logical lookups
- average segments touched per lookup
- total segment-level lookup invocations
- time spent inside individual segment lookups
- time spent merging segment results
- number of matches returned per segment
- whether the same logical lookup is repeated across stages

Produce a breakdown similar to:

| Operation | Logical calls | Segments/call | Segment calls | Time |
|-----------|--------------:|--------------:|--------------:|-----:|
| bucket lookup | ... | ... | ... | ... |
| position lookup | ... | ... | ... | ... |
| occurrence read | ... | ... | ... | ... |

Explicitly calculate the multiplicative effect where applicable.

Example:

    250 logical lookups
    × 8 segments
    = 2,000 segment-level operations

Do not conclude that segmentation is bad merely because the number is high.

Determine the actual measured cost.

---

# Phase F — Segment-count scaling

If practical, benchmark equivalent lookups against different segment counts.

Possible configurations:

- 1 segment
- 2 segments
- 4 segments
- current production segment count

Interpret results carefully.

The goal is to determine whether lookup latency grows primarily with:

- active segment count
- candidate count
- occurrence count
- distinct game count
- match count
- bytes read
- merge size
- another factor

Distinguish:

    lookup overhead per segment

from:

    result processing caused by more matches

Do not infer complexity from wall-clock time alone if the amount of returned work changes between tests.

---

# Phase G — File descriptor / pread lifecycle

Inspect the current segment reader implementation.

Verify whether storage access resembles:

    logical lookup
      → for each segment
          → open file descriptor
          → pread
          → close file descriptor

or another lifecycle.

Measure:

- file opens per request
- file closes per request
- `pread` calls per request
- `pread` calls per segment
- `pread` calls per binary file type
- time spent opening descriptors
- time spent closing descriptors
- time spent in actual reads
- average bytes read per `pread`
- repeated access to the same file
- repeated access to the same binary region

Produce a table such as:

| File | Opens | preads | Bytes read | Open/close time | Read time |
|------|------:|-------:|-----------:|----------------:|----------:|
| occ.bin | ... | ... | ... | ... | ... |
| pos.bin | ... | ... | ... | ... | ... |
| bucket.bin | ... | ... | ... | ... | ... |

Explicitly determine whether descriptor lifecycle overhead is:

- insignificant
- measurable but secondary
- major

Do not optimize descriptor handling in this ticket.

---

# Phase H — Binary index access pattern

Inspect how the binary indexes are used.

Determine:

- whether the intended index is actually used
- whether lookup remains O(1) / O(log n) where expected
- whether any stage scans:
  - all positions
  - all occurrences
  - all games
  - all entries in a bucket
  - an entire binary section
  - an entire binary file
- whether binary search is performed correctly
- whether lookup boundaries are computed efficiently
- whether position keys are repeatedly reconstructed or compared
- whether index payloads cause downstream expensive reconstruction

Document any pattern resembling:

    index lookup
      → game id
      → game read
      → full game decode
      → move replay
      → reconstruct position
      → extract a small piece of metadata

Do not redesign the format yet.

Only identify the cost and its cause.

---

# Phase I — Random I/O and locality

Look for poor locality.

Measure and inspect:

- many small random reads
- seek/read/seek/read loops
- repeated reads from the same file
- same game regions accessed multiple times
- game IDs accessed in arbitrary order
- inability to exploit sorted offsets
- reopening files inside inner loops
- one physical read per candidate/occurrence
- reading one game at a time where requests could theoretically be coalesced

If possible, record:

- file offsets read
- sequence of offsets
- average distance between successive reads
- frequency of repeated regions

Do not batch or reorder reads yet.

The goal is to prove whether random I/O materially contributes to latency.

---

# Phase J — Decoding and reconstruction

Measure decoding/reconstruction separately from physical I/O.

Look for:

- full-game decoding when only metadata is needed
- repeated decoding of the same game
- repeated move replay
- repeated board reconstruction
- repeated SAN generation
- repeated FEN generation
- repeated hashing
- repeated transformations between representations
- decoding more data than Historical Examples ultimately uses

Build counts such as:

| Operation | Calls | Unique inputs | Duplicate calls |
|-----------|------:|--------------:|----------------:|
| load_game | ... | ... | ... |
| decode_game | ... | ... | ... |
| replay_moves | ... | ... | ... |
| reconstruct_position | ... | ... | ... |

Determine whether duplicate decoding is a major cost.

---

# Phase K — Occurrences vs independent games

OpenChessLab distinguishes conceptually between:

- historical occurrences
- independent games

A single game may contain multiple relevant occurrences.

Explicitly measure whether the implementation pays full game-level cost per occurrence.

For example:

    420 candidate occurrences
    → 61 distinct games
    → 420 game loads

would indicate a likely N+1-style problem.

Capture:

- occurrence count
- unique game IDs
- game-load count
- game-decode count
- repeated game-load count
- repeated game-decode count

Do NOT change independent-game semantics.

Do NOT collapse occurrences incorrectly.

This investigation is only about avoiding redundant work while preserving product meaning.

---

# Phase L — N+1 / duplicate work audit

Explicitly search for N+1-style behavior.

Build a table:

| Operation | Invocations | Unique inputs | Duplicates | Total time |
|-----------|------------:|--------------:|-----------:|-----------:|
| load_game | ... | ... | ... | ... |
| read_occurrence | ... | ... | ... | ... |
| decode_moves | ... | ... | ... | ... |
| position_lookup | ... | ... | ... | ... |

Inspect for:

- storage calls inside candidate loops
- storage calls inside occurrence loops
- storage calls inside segment loops
- repeated lookup of the same key
- repeated loading of the same game
- repeated decoding of the same game
- repeated computation of the same position-derived values

Report duplicate work explicitly.

---

# Phase M — Elixir / BEAM-specific audit

Inspect for common BEAM performance problems relevant to this request path.

Look for:

- nested `Enum.map`
- nested `Enum.filter`
- repeated `Enum.find`
- repeated linear scans
- repeated `Enum.group_by` / `sort_by`
- materialization of large intermediate lists
- repeated conversion between lists/maps/tuples/binaries
- large allocation churn
- avoidable binary copying
- failing to use sub-binaries where appropriate
- repeated hashing
- repeated parsing
- repeated map creation
- GenServer serialization bottlenecks
- ETS lookup patterns
- process creation inside inner loops
- excessive `Task.async_stream`
- sequential independent I/O
- overly fine-grained concurrency
- scheduler pressure
- mailbox bottlenecks

Do not mechanically parallelize anything.

Only report measured or strongly evidenced issues.

---

# Phase N — Cold vs warm behavior

Run the same representative request multiple times if the environment allows it.

Capture at least:

- first request
- immediate second request
- third request

Example:

    first:   10.2 s
    second:   9.8 s
    third:    9.7 s

versus:

    first:   10.2 s
    second:   1.2 s
    third:    1.1 s

These suggest very different causes.

Determine whether latency is primarily related to:

- filesystem cache
- OS page cache
- application cache
- repeated deterministic CPU work
- repeated storage operations regardless of cache
- startup effects

Do not add a cache to hide the root cause.

---

# Phase O — Production vs local/staging

If the same request can be reproduced outside production, compare:

- production latency
- local latency
- staging latency if available
- candidate counts
- occurrence counts
- segment count
- corpus size
- bytes read
- number of storage calls
- number of game loads
- CPU
- memory
- filesystem
- storage medium
- deployment environment

Determine whether the issue is primarily:

1. algorithmic
2. corpus-size dependent
3. segment-count dependent
4. random-I/O dependent
5. production-storage dependent
6. CPU dependent
7. a combination

Do not blame production hardware without evidence.

---

# Phase P — Scaling characteristics

Determine what runtime grows with.

Potential dimensions include:

- candidate count
- occurrence count
- distinct game count
- active segment count
- logical lookup count
- physical segment lookup count
- total bytes read
- game move count
- number of reconstructed positions
- number of comparisons
- result count

Where practical, benchmark bounded candidate counts such as:

- 10
- 25
- 50
- 100
- 250
- 500

Record:

- total latency
- storage latency
- read count
- bytes read
- game load count
- decode count

Determine whether latency shows:

- fixed overhead
- linear growth
- superlinear growth
- step changes
- pathological duplication

Explicitly distinguish:

    logical lookup count

from:

    logical lookup count × active segment count

if lookups are broadcast to all segments.

---

# Phase Q — Compare with pre-binary behavior

If the previous Historical Examples implementation still exists in:

- git history
- branches
- old modules
- tests
- Spike documentation
- previous commits

compare execution strategies.

Do NOT argue generally that one storage technology is better.

Compare concretely:

- lookup granularity
- candidate representation
- candidate count
- index richness
- batching
- game loading
- game decoding
- move replay
- position reconstruction
- number of storage operations
- random vs sequential access
- caching
- repeated work
- number of intermediate allocations

Identify whether the regression comes from:

- the binary format itself
- the storage API
- the adaptation layer
- Historical Examples retrieval behavior
- missing batching
- missing deduplication
- a semantic mismatch between old and new storage APIs

---

# Phase R — CPU profiling if warranted

Only perform CPU profiling if stage timing shows substantial CPU cost.

Do not profile the entire application indiscriminately.

Use an appropriate BEAM profiling technique.

Identify hotspots by:

- total time
- call count
- time per call

Potential areas:

- similarity calculation
- move application
- chess position reconstruction
- sorting/ranking
- decoding
- hashing
- key comparison
- binary parsing
- serialization

If I/O dominates clearly, state that and avoid unnecessary CPU profiling.

---

# Phase S — Memory / allocation behavior

If measurements indicate significant GC or allocation pressure, investigate:

- process memory
- heap growth
- garbage collection time
- intermediate list sizes
- large copied binaries
- repeated map/list construction
- response materialization

Determine whether allocation pressure is a primary, secondary, or insignificant contributor.

Do not refactor solely for memory unless measurements justify it.

---

# Phase T — Identify root causes

Rank findings.

Use these categories:

## P0 — Proven major bottleneck
Measured and responsible for a substantial portion of total latency.

## P1 — Proven secondary bottleneck
Measured and meaningful, but not dominant.

## P2 — Plausible optimization opportunity
Likely useful but not yet proven as a major contributor.

## Not significant
Investigated and shown not to matter materially.

For every finding include:

- evidence
- timing
- invocation counts
- scaling behavior
- affected code path
- confidence level

Example:

    P0 — repeated game decoding

    412 candidate occurrences refer to 67 unique games.
    `decode_game/1` is invoked 391 times.
    Total decode/replay time = 6.2 s of 9.8 s.

Do not write conclusions like:

    "This probably looks slow"

without measurements.

---

# Phase U — Explicit segmentation conclusion

The final report must explicitly state whether segmentation materially contributes to the latency.

Separate the possible causes:

- per-segment lookup overhead
- number of active segments
- repeated logical lookups multiplied by segment count
- file descriptor lifecycle
- physical reads
- result merging
- candidate volume
- none of the above

Example structure:

    Segmentation contribution: major / secondary / negligible

    Logical lookups: ...
    Active segments: ...
    Physical segment operations: ...
    Time in segment lookups: ...
    Time in merge: ...

Do not leave this implicit.

---

# Phase V — Explicit file-descriptor conclusion

Explicitly state whether the `open → pread → close` lifecycle contributes materially.

Include:

- total opens
- total closes
- total `pread`s
- open/close time
- read time
- percentage of request

Classify as:

- major
- secondary
- negligible

Do not recommend persistent descriptors unless the measurements support it.

---

# Phase W — Recommended fixes

Do NOT implement fixes in this ticket.

Produce a ranked recommendation table:

| Fix | Evidence | Expected impact | Complexity | Risk | Product semantics affected? |
|-----|----------|-----------------|------------|------|-----------------------------|

Possible fixes may include, but only if supported by evidence:

- deduplicate game IDs before loading
- request-scoped memoization
- decode each unique game once
- batch binary reads
- sort reads by offset
- reduce repeated segment scans
- reuse file descriptors
- keep segment readers open
- reduce repeated key reconstruction
- avoid full game replay where unnecessary
- enrich index payload
- reduce redundant conversions
- reduce intermediate materialization
- improve data locality
- reorganize one part of the binary format
- add narrowly targeted caching

Do not recommend generic "add caching".

If caching is recommended, specify:

- exact key
- exact value
- scope
- lifecycle
- expected hit rate
- why it removes measured work

---

# Phase X — Verification benchmark

Define a benchmark suite for the eventual fix.

Include at least:

- 2–3 representative Historical Examples positions
- cold run
- warm run
- candidate counts
- occurrence counts
- distinct game counts
- segment count
- storage call counts
- decode counts
- total latency

Define target metrics.

Example target:

    p50 < 1.0 s
    p95 < 2.0 s

Do not invent target values if existing product targets already exist.

If no target exists, propose a reasonable target and label it as proposed.

The benchmark must be reusable before and after fixes.

---

# Phase Y — Diagnostic instrumentation

List every instrumentation change added during the investigation.

Classify each as:

- temporary diagnostic only
- useful long-term telemetry candidate

Do not leave large amounts of ad hoc logging in production code.

---

# Deliverable

Return one markdown report with this structure.

## 1. Executive summary

Include:

- observed latency
- primary bottleneck
- secondary bottlenecks
- confidence level
- whether segmentation contributes materially
- whether file descriptor lifecycle contributes materially

## 2. Request flow

Show the full important call chain with module/function names.

## 3. Timing breakdown

| Stage | Time | % total |
|-------|-----:|--------:|

Account for as much of the total latency as possible.

## 4. Work/count breakdown

Include:

- candidates
- occurrences
- distinct games
- segments
- logical lookups
- physical segment calls
- file opens
- preads
- bytes read
- decodes
- position reconstructions
- duplicate operations

## 5. Segment analysis

Include:

- production segment count
- lookups × segment multiplication
- per-segment cost
- merge cost
- segment-count scaling

## 6. File I/O analysis

Include:

- file descriptor lifecycle
- pread counts
- read sizes
- random/sequential characteristics
- repeated regions

## 7. Decode / reconstruction analysis

Include:

- game loads
- unique games
- repeated decodes
- move replay
- position reconstruction

## 8. N+1 / duplicate work analysis

Provide concrete duplicate counts.

## 9. Cold vs warm behavior

Report measured differences.

## 10. Production vs local/staging

Report measured differences where available.

## 11. Complexity / scaling

Explain what runtime scales with.

## 12. Root causes

Rank:

- P0
- P1
- P2
- Not significant

## 13. Recommended fixes

Provide ranked recommendations only.

Do not implement.

## 14. Verification benchmark

Define the before/after benchmark.

## 15. Instrumentation changes

List temporary diagnostics and possible long-term telemetry.

---

# Hard rules

Do NOT:

- optimize before measuring
- change Historical Examples semantics
- reduce candidate quality
- reduce result count
- remove retrieval stages
- add broad caching as a first response
- parallelize blindly
- redesign the binary format immediately
- rewrite Historical Examples
- refactor unrelated code
- change UI behavior
- change public API behavior
- change ranking logic
- collapse occurrences incorrectly
- change independent-game semantics

Do not commit a production fix as part of this ticket.

This ticket ends when the cause of the ~10 second latency is:

- measured
- demonstrated
- quantified
- ranked

Stop there.
