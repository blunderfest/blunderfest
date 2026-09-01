# Technical Spike — Production Packed Binary Corpus Index

## Context

Blunderfest currently has approximately **100,000 chess games imported into PostgreSQL**.

The current Historical Evidence pipeline retrieves position occurrences from PostgreSQL.

This worked well enough for the initial vertical slice, but the next corpus target is approximately **1 million games**, with significantly larger corpora expected later.

The current PostgreSQL representation stores one row per position occurrence. That representation is becoming operationally expensive.

Earlier research already investigated alternative storage strategies.

### Relevant prior findings

Technical Spike 01 concluded that:

* the canonical position identity should be based on:

  * piece placement;
  * side to move;
  * castling rights;
  * en-passant only when legally capturable;
* move counters are excluded;
* position identity was hashed using deterministic **BLAKE2b-128**;
* a sorted packed binary occurrence index used approximately **22 bytes per occurrence**;
* packed binary was the smallest and fastest tested retrieval mechanism at:

  * 100k games;
  * 1M games;
  * 10M games;
* PostgreSQL remained acceptable at smaller scales but grew much faster in storage size.

Technical Spike 03 later established the architectural principle:

> canonical chess games are durable data; position occurrences and retrieval indexes are derived/rebuildable data.

The search/index layer should remain behind the `Blunderfest.Corpus` boundary.

Do not treat the packed index as canonical storage.

---

# Goal

Build a **production-oriented packed binary index prototype** for the existing 100k corpus and compare it directly against the current PostgreSQL-backed corpus implementation.

The objective is not only performance.

The prototype must answer:

1. Can the packed index reproduce the same observable retrieval results as PostgreSQL?
2. Can Historical Evidence operate against it without behavior changes?
3. How much storage does it save?
4. How does lookup latency compare?
5. What production architecture is required to support future imports and incremental writes?
6. Is the existing Spike-01 design sufficient, or does it require meaningful changes before becoming production infrastructure?

---

# Important constraint

Do not replace PostgreSQL yet.

The existing PostgreSQL implementation is the **reference implementation** for this experiment.

Both implementations should coexist temporarily:

```text
Blunderfest.Corpus
      │
      ├── PostgreSQL backend
      │
      └── Packed binary backend
```

The same test queries must be executable against both.

---

# 1. Inspect the current implementation first

Before writing code, inspect and document:

1. how corpus games are currently stored;
2. how position occurrences are currently stored;
3. how position keys are calculated;
4. how exact position lookup currently works;
5. how Historical Evidence obtains:

   * exact occurrences;
   * candidate games;
   * game metadata;
   * continuations;
   * route context;
6. where `Blunderfest.Corpus` currently acts as an abstraction boundary;
7. whether application code depends directly on Ecto/PostgreSQL details.

Do not assume the architecture described in old documentation is still identical to production code.

The repository is the source of truth.

---

# 2. Preserve current position-key semantics exactly

The packed backend must use the same position identity as the current validated system.

Conceptually:

```text
PositionKey =
  piece placement
  + side to move
  + castling rights
  + legal en-passant state
```

Do not include:

```text
halfmove clock
fullmove number
```

Use the existing production implementation if one already exists.

Do not introduce a competing position-key algorithm unless the current implementation demonstrably differs from the validated Spike-01 convention.

If there is a discrepancy, document it before changing anything.

---

# 3. Packed occurrence record

Start from the Spike-01 representation.

Conceptually:

```text
16 bytes  position key / hash
4 bytes   game id
2 bytes   ply
-----------------------------
22 bytes  per occurrence
```

Use fixed-width encoding unless there is a strong measured reason not to.

Do not prematurely introduce:

* variable-length integers;
* compression codecs;
* columnar encoding;
* entropy coding;
* complex page formats.

The first production experiment should remain understandable and verifiable.

---

# 4. Sort order

Build a deterministic sorted occurrence file.

Recommended order:

```text
(position_key, game_id, ply)
```

All occurrences for the same position must be contiguous.

Example:

```text
AAAA... | game 12  | ply 8
AAAA... | game 91  | ply 14
AAAA... | game 452 | ply 8
BBBB... | game 7   | ply 33
BBBB... | game 98  | ply 41
```

The exact byte ordering of the key must be documented.

Rebuilding the same corpus should produce deterministic output.

---

# 5. Sparse lookup index

Implement a small lookup structure over the packed occurrence file.

The Spike-01 concept was:

```text
position key
     ↓
small sparse in-memory index
     ↓
approximate file location
     ↓
local binary search / scan
     ↓
contiguous occurrence run
```

The sparse index may store, for example:

```text
position key
file offset
```

at regular intervals.

Do **not** blindly copy an assumed stride such as 4096 records.

Benchmark several sensible values, for example:

```text
256
1024
4096
16384
```

Measure:

* sparse index size;
* lookup latency;
* number of bytes read;
* behavior for hot and cold keys.

Choose based on evidence.

---

# 6. Lookup API

The packed backend should expose behavior equivalent to the current corpus abstraction.

At minimum:

```text
lookup exact position
→ occurrences
```

with each occurrence providing enough information to recover:

```text
game_id
ply
```

If the current Corpus API exposes counts separately, preserve that behavior.

Avoid materializing huge result sets unnecessarily.

Support bounded retrieval.

Conceptually:

```text
lookup(key, limit: N)
```

and ideally:

```text
count(key)
```

without decoding all occurrences when possible.

---

# 7. Hot-key behavior

The earlier spike showed that opening positions can occur in extremely large numbers of games.

The packed backend must therefore distinguish:

```text
finding the key
```

from:

```text
materializing every occurrence
```

Benchmark at least:

* missing key;
* singleton key;
* low-frequency key;
* medium-frequency key;
* very hot opening key.

Record:

```text
lookup location time
result materialization time
total count
bytes read
```

Do not hide hot-key costs behind averages.

---

# 8. Game access

Historical Evidence requires more than occurrence lookup.

For each occurrence it eventually needs the corresponding game and move context.

Inspect how this currently works.

For this spike, do not redesign canonical game storage unless required.

It is acceptable for the packed position index to return:

```text
game_id + ply
```

while the game itself is still retrieved from PostgreSQL.

This experiment is specifically about replacing the **position occurrence store**, not necessarily the complete corpus storage system.

Preferred initial architecture:

```text
Packed index
    ↓
game_id + ply
    ↓
existing game store
```

This reduces scope and makes comparison cleaner.

---

# 9. Historical Evidence compatibility test

Run the complete Historical Evidence pipeline against both backends.

Use the same reference positions that have already been important in earlier research, including at least:

* F1 King's Indian structure;
* A2 Ruy López decision point;
* Najdorf position;
* a rare middlegame;
* a cold/endgame position;
* a repeated position;
* a position with same-game duplicate occurrences.

For each reference:

```text
PostgreSQL backend
vs
Packed backend
```

Compare:

* exact occurrence counts;
* independent game counts;
* candidate IDs;
* candidate plies;
* next-move distribution;
* position differences;
* route comparison;
* continuation windows;
* historical support counts;
* final API/DTO shape.

The packed backend should not silently change Historical Evidence semantics.

---

# 10. Equality / parity requirements

Create a parity test suite.

For a sufficiently large deterministic sample of position keys:

```text
postgres.lookup(key)
==
packed.lookup(key)
```

after canonical ordering.

Test at least:

```text
10,000 random/corpus-derived keys
```

if practical.

Also explicitly test:

### Missing position

Both return no occurrences.

### Singleton

Exactly one occurrence.

### Multiple games

Same complete occurrence set.

### Same game at multiple plies

All occurrences preserved.

### Hot key

Same total count.

### En-passant normalization case

Same key semantics.

### Castling-right difference

Different keys where appropriate.

### Side-to-move difference

Different keys where appropriate.

No approximate equality is acceptable for exact retrieval.

---

# 11. Storage comparison

Report actual disk usage for the current 100k corpus.

Measure:

```text
PostgreSQL occurrence table
PostgreSQL indexes
combined PostgreSQL footprint

packed occurrence file
sparse index
any metadata/index overhead
combined packed footprint
```

Do not compare only raw row payload size.

Compare real on-disk storage.

Also calculate projected sizes for:

```text
1M games
10M games
50M games
```

using measured bytes per occurrence and measured average plies/game.

Clearly distinguish:

* measured;
* extrapolated.

---

# 12. Performance comparison

Benchmark both backends on the same machine.

Measure at least:

```text
p50
p95
p99
max
```

for exact lookup.

Use a mixed workload including:

* misses;
* cold keys;
* repeated keys;
* hot opening keys.

Benchmark two modes separately:

### Key lookup only

Find where the occurrence run lives.

### Full occurrence retrieval

Materialize the requested occurrences.

This distinction matters.

---

# 13. Historical Evidence end-to-end timing

Also measure full Historical Evidence requests.

For each test position:

```text
PostgreSQL occurrence backend
Packed occurrence backend
```

Record:

```text
occurrence retrieval
candidate generation
continuation/family work
total request time
```

We need to know whether the packed index materially improves actual product latency or only storage.

Do not optimize unrelated Historical Evidence stages in this spike.

---

# 14. Incremental-write architecture investigation

The packed file is read-optimized and sorted.

Therefore, arbitrary insertion into the main file is not acceptable.

Investigate and prototype the smallest credible production write strategy.

The current working model is:

```text
immutable packed segments
+
small mutable delta
+
periodic compaction
```

Conceptually:

```text
                   Corpus
                     │
           ┌─────────┴─────────┐
           │                   │
 immutable packed        mutable delta
     segments                  │
           └─────────┬─────────┘
                     ↓
               merged lookup
```

Do not build a full LSM database.

We only need to establish whether this model fits Blunderfest.

---

# 15. Bulk import path

For large trusted corpus imports such as Lichess Broadcast:

```text
source PGN
   ↓
parse / validate
   ↓
assign game IDs
   ↓
extract occurrences
   ↓
sort
   ↓
build packed segment
   ↓
publish atomically
```

This path should not insert millions of position rows into PostgreSQL.

Prototype or document how this would work.

---

# 16. Interactive/small import path

For small PGN imports or recently added games, investigate a mutable delta.

Candidate implementations may include:

* PostgreSQL;
* SQLite;
* ETS + durable journal;
* append-only log + in-memory index.

Do not choose based on elegance.

Choose the smallest mechanism that satisfies:

```text
new game becomes searchable quickly
data survives restart
lookup can merge with packed segments
later compaction is possible
```

For the spike, PostgreSQL as a small delta is perfectly acceptable.

Example:

```text
packed:
1,000,000 games
~67M occurrences

delta:
5,000 recent games
~335k occurrences
```

The problem is PostgreSQL holding the entire corpus, not a small mutable tail.

---

# 17. Segmentation experiment

Investigate whether the packed corpus should be one file or multiple immutable segments.

Test at least conceptually or experimentally:

```text
1 x 100k
vs
4 x 25k
```

Compare lookup overhead.

The important question is not only speed.

Consider:

* importability;
* compaction;
* atomic publication;
* corruption isolation;
* replacement;
* backup/deployment;
* future multi-million corpus growth.

Do not introduce segment Bloom filters or global routing unless measurement shows they are necessary.

---

# 18. Atomic publication

A newly built segment must not become visible partially.

Design a simple publish mechanism.

For example:

```text
build temp files
validate
fsync
rename atomically
update manifest
```

The Corpus backend should only open complete validated segments.

Document failure behavior.

---

# 19. Manifest

A simple corpus manifest will likely be useful.

Conceptually:

```json
{
  "version": 1,
  "segments": [
    {
      "id": "000001",
      "games": 25000,
      "occurrences": 1684321,
      "positions_file": "...",
      "index_file": "..."
    }
  ]
}
```

Keep it small and explicit.

Do not create a generalized distributed metadata service.

---

# 20. Checksums / validation

A packed index is derived, but corruption must still be detectable.

At minimum consider:

* file size validation;
* record-count validation;
* checksum;
* sorted-order verification;
* occurrence count verification.

A segment build should fail before publication if validation fails.

---

# 21. Deletion / tombstone investigation

Do not fully implement deletion unless necessary.

But document how future deletion would work.

Likely model:

```text
game tombstone
→ filter occurrence results
→ remove physically during compaction
```

This is especially relevant for user-owned data, less so for trusted global corpora.

---

# 22. Important semantic boundary: historical games vs analyses

Do not treat all stored chess data as historical corpus evidence.

Maintain the distinction:

```text
Historical corpus
- Lichess Broadcast
- future trusted corpus sources

User data
- uploaded games
- saved analyses
- room analysis trees
```

An analysis tree must not silently become Historical Evidence.

The same indexing technology may eventually serve both namespaces, but they are different sources of truth and different product concepts.

---

# 23. Scope exclusions

Do not:

* migrate the 1M corpus yet;
* remove PostgreSQL;
* rewrite Historical Evidence;
* change continuation-family logic;
* change candidate ranking;
* change position similarity;
* build a generic storage engine;
* implement distributed sharding;
* introduce RocksDB/LevelDB merely because the problem resembles an LSM tree;
* redesign canonical game storage unless required;
* optimize compression before measuring the plain packed representation;
* change user-facing UI.

This is a storage/retrieval parity experiment.

---

# 24. Required test corpus

Use the existing **100k PostgreSQL corpus**.

Do not create a synthetic replacement corpus for the main comparison.

Synthetic fixtures are fine for low-level binary-format tests.

The production comparison must use the exact same 100k games currently used by Historical Evidence.

---

# 25. Deliverables

Implement the prototype and create:

`technical-spike-packed-binary-production-index-report.md`

The report must contain:

## Existing PostgreSQL architecture

What currently exists in the repository.

## Packed binary format

Exact byte layout.

## Build process

How the 100k index is generated.

## Sparse index

Structure and chosen stride, including measurements.

## Correctness

Parity results against PostgreSQL.

## Historical Evidence parity

Results for the known reference positions.

## Storage

Actual disk comparison.

## Lookup performance

PostgreSQL vs packed.

## End-to-end performance

Historical Evidence timings.

## Incremental writes

Recommended strategy for future added games.

## Segment strategy

Whether immutable segments are justified.

## Failure/recovery

How incomplete or corrupt builds are handled.

## 1M projection

Measured projection for the next corpus step.

## 10M+ projection

Expected scaling and remaining uncertainties.

## Recommendation

Choose one:

```text
A. Packed index is ready to become the production occurrence backend.

B. Packed index is promising but requires one more focused experiment.

C. PostgreSQL should remain the occurrence backend for now.

D. Neither approach is suitable; investigate another architecture.
```

Support the recommendation with measurements.

---

# 26. Definition of done

The spike is complete when:

1. The existing 100k PostgreSQL corpus can produce a packed occurrence index.
2. Exact lookup results match PostgreSQL exactly.
3. Historical Evidence can run against both backends.
4. Known reference positions produce equivalent observable results.
5. Storage usage is measured.
6. Lookup latency is measured.
7. End-to-end Historical Evidence timing is measured.
8. The incremental-write problem is addressed architecturally.
9. The 1M import path is clear.
10. No PostgreSQL data has been removed or migrated irreversibly.

---

# Final principle

The purpose of this spike is not:

> “Build a clever binary database.”

It is:

> **“Prove that Blunderfest can move its exploding position-occurrence workload out of PostgreSQL without changing the product behavior.”**

The existing PostgreSQL implementation is the oracle for correctness.

The packed backend must earn its place by matching it first.
