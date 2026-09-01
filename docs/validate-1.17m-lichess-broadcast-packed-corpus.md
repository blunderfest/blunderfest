# Follow-up Task — Validate the 1.17M Lichess Broadcast Packed Corpus

## Context

Technical Spike 08 concluded that the packed binary occurrence backend is functionally equivalent to the current PostgreSQL occurrence backend for the existing 100k corpus.

The spike established:

* exact occurrence parity against PostgreSQL;
* Historical Evidence parity on the known reference positions;
* lower storage usage on the 100k corpus;
* faster exact lookups;
* support for immutable packed segments;
* a viable path toward making packed binary the production occurrence backend.

The report currently recommends:

> **A. Packed index is ready to become the production occurrence backend, with one closing condition: validate the 1M Broadcast corpus on packed storage.**

That closing condition should now be completed.

The extracted Lichess Broadcast corpus currently contains approximately:

* 1.17M games;
* 94.3M position occurrences;
* 72.4M distinct positions.

The existing Spike 08 report contains inconsistent storage projections for this corpus. In particular, the reported `~0.8 GB packed` estimate cannot be reconciled with the documented record sizes and the measured 100k result.

This task must replace those projections with **measured production-scale numbers**.

---

# Goal

Build the real packed binary index for the complete extracted Lichess Broadcast corpus and validate that the packed backend remains:

1. correct;
2. operationally practical;
3. compatible with Historical Evidence;
4. suitable as the production occurrence backend.

Do not extrapolate where a real measurement can be made.

---

# 1. Build the complete Broadcast packed corpus

Use the already extracted Lichess Broadcast corpus.

Build the packed occurrence backend from the actual extracted data.

Do not route the 94M occurrences through PostgreSQL first.

Use the existing packed build pipeline from Spike 08.

The build must produce the real production-scale files, not a synthetic approximation.

---

# 2. Report exact corpus counts

Before and after the build, report:

```text
games
position occurrences
distinct positions
pawn-skeleton bucket memberships
segments
```

Confirm that counts remain consistent across:

```text
extraction artifacts
packed manifest
packed files
validation tools
```

Any discrepancy must be investigated rather than normalized away.

---

# 3. Measure real packed storage

Report exact on-disk size for every relevant file.

At minimum:

```text
occ.bin
pos.bin
bucket.bin
manifest
checksums / metadata
all segment files
total packed corpus size
```

For `pos.bin`, also report if practical:

```text
fixed-width header region
canonical position-string region
```

The final report must contain both:

```text
bytes
MiB / GiB
```

Do not use the previous `~0.8 GB` projection.

Replace it with measured values.

---

# 4. Explain the previous projection error

Inspect the current Spike 08 report and identify why the 1M storage projection was wrong.

The report currently combines statements such as:

```text
94.3M occurrences
22 bytes per occurrence
72.4M distinct positions
```

with a total packed estimate that is smaller than `occ.bin` alone would require.

Document the cause clearly.

Correct all affected projections in the Spike 08 report.

Do not merely change the headline number; verify every 1M / 10M / 50M storage projection for internal consistency.

Clearly distinguish:

* measured numbers;
* extrapolated numbers.

---

# 5. Measure build resource usage

Measure the full Broadcast packed build.

Report:

```text
total wall-clock build time
CPU usage if readily available
peak RAM
peak temporary disk usage
final disk usage
external sort time
builder time
validation time
```

Also document temporary artifacts.

For example:

```text
combined.tsv
sorted intermediate files
temporary segment directory
final packed files
```

We need to know the **peak disk requirement**, not only the final packed size.

This matters for production deployment and future imports.

---

# 6. Validate the complete packed corpus

Run the existing packed validation tooling against the finished Broadcast corpus.

At minimum validate:

```text
manifest integrity
file sizes
record counts
sorted order
checksums
position counts
occurrence counts
bucket counts
```

The build must not be considered complete until the packed corpus passes validation.

---

# 7. Correctness / parity validation

The 100k PostgreSQL corpus remains the strongest exact oracle available.

Do not try to load the complete 1.17M occurrence set back into PostgreSQL merely for parity testing.

Instead use two levels of validation.

### A. Existing 100k oracle parity

Re-run or preserve the Spike 08 parity results against PostgreSQL.

The existing guarantees must continue to pass.

### B. Broadcast internal consistency

For the new 1.17M packed corpus, verify consistency against the extraction artifacts.

Sample a large deterministic set of positions and independently reconstruct their occurrences from the source/extraction data.

Recommended minimum:

```text
10,000 sampled position keys
```

Compare exact:

```text
game_id
ply
```

sets.

Also test:

```text
missing key
singleton
multi-game key
same-game repeated occurrence
hot opening position
en-passant normalization
castling-right differences
side-to-move differences
```

No approximate equality is acceptable for exact lookup.

---

# 8. Historical Evidence validation on 1.17M

Run the known Historical Evidence reference positions against the Broadcast packed corpus.

Include at least:

* F1 King's Indian structure;
* A2 Ruy López decision point;
* Najdorf;
* rare middlegame;
* cold/endgame position;
* repeated/same-game occurrence case.

Report:

```text
exact occurrences
independent games
next-move distribution
candidate counts
Historical Evidence total time
```

The objective here is no longer PostgreSQL parity at 1.17M.

The objective is to confirm that the production-scale packed corpus behaves sensibly and that increasing corpus size does not expose new correctness or pathological-performance issues.

---

# 9. Exact lookup performance at 1.17M

Benchmark the packed backend on the real Broadcast corpus.

Measure:

```text
p50
p95
p99
max
```

for:

### Missing key

### Singleton / rare key

### Medium-frequency key

### Hot opening key

Separate:

```text
key/run location
full occurrence materialization
```

Do not report only averages.

---

# 10. Revisit sparse-index stride at the real scale

Spike 08 found:

```text
stride 256 faster
stride 1024 current default
```

Re-run a limited stride comparison on the 1.17M corpus.

At minimum compare:

```text
256
1024
4096
```

Report:

```text
anchor memory
p50
p95
p99
```

If 256 remains materially faster and still uses trivial memory, explicitly decide whether the production default should change from 1024 to 256.

Do not retain 1024 merely because it was previously the default.

---

# 11. Re-test large pawn buckets

Spike 08 exposed an important asymmetry:

```text
large pawn bucket:
PostgreSQL ~158 ms
Packed ~1.0 s
```

The current Historical Evidence pipeline limits structural candidate processing to approximately 2000 keys, so this was not considered blocking.

Re-test bucket behavior on the 1.17M corpus.

Report at least:

```text
small bucket
~2,000-key bucket
large bucket
largest observed bucket
```

Measure:

```text
bucket size
lookup time
bytes read
```

Do not optimize this path unless it becomes product-blocking.

The purpose is to understand its real production behavior.

---

# 12. Segment strategy

Do not assume that the correct production model is:

> four fixed 250k-game segments.

The stronger working principle is:

> **bulk corpus publications create immutable segments; compaction policy is separate.**

Evaluate the actual Broadcast build and recommend a practical initial segment strategy.

Possible examples:

```text
one segment for the entire first Broadcast corpus
```

or:

```text
a small number of build-time segments
```

Future imports should be able to append:

```text
segment 0005
segment 0006
...
```

without rewriting existing immutable segments.

Do not implement a complex compaction policy yet.

Document:

* why the chosen segment size/count is reasonable;
* expected lookup overhead as segment count grows;
* when compaction would become necessary.

---

# 13. Publication / replacement test

Test the production publication path.

A new packed corpus should be built separately from the currently active corpus.

Expected model:

```text
build temp directory
    ↓
validate completely
    ↓
publish / rename atomically
    ↓
new readers open new manifest
    ↓
old corpus remains available until replacement succeeds
```

Test at least one failure case.

Examples:

```text
corrupted file
missing manifest
checksum mismatch
interrupted build
```

A failed new build must not make the existing corpus unavailable.

---

# 14. Keep PostgreSQL for games and moves

This task is still specifically about the exploding position-occurrence layer.

Do not migrate unrelated corpus data unless required.

The preferred production boundary remains:

```text
Packed binary
- position occurrences
- distinct-position headers
- pawn bucket index

PostgreSQL
- game metadata
- move sequences
- existing application data
```

Historical Evidence should continue through `Blunderfest.Corpus`.

Do not let downstream code depend directly on packed file internals.

---

# 15. Incremental writes are not a blocker for this task

Do not broaden this task into fully implementing the mutable-tail architecture.

For the global Lichess Broadcast corpus, bulk immutable ingest is sufficient.

It is acceptable to leave:

```text
small PG mutable tail
periodic compaction
```

as the recommended architecture for a later focused implementation.

If the existing Spike 08 code already contains partial support, verify it does not interfere with the Broadcast build, but do not expand scope unnecessarily.

---

# 16. Update Spike 08 report

Update:

`technical-spike-08-production-packed-binary-corpus-index-report.md`

The report must no longer contain internally inconsistent storage projections.

Add a new section:

```text
Production-scale Broadcast validation
```

containing:

* exact corpus counts;
* exact packed sizes;
* build duration;
* peak RAM;
* peak disk usage;
* lookup benchmarks;
* stride measurements;
* bucket measurements;
* Historical Evidence observations;
* segment decision;
* final production recommendation.

Where old projected values are now superseded by measured values, clearly say so.

Do not silently rewrite history.

For example:

> The original 1M storage projection was incorrect because [...]. The actual measured Broadcast packed corpus is [...].

---

# 17. Final recommendation

End with one of:

### A. Production migration approved

The Broadcast packed corpus is validated and the production occurrence backend can switch from PostgreSQL to packed storage.

### B. Production migration approved with a small explicit condition

Name the exact remaining condition.

### C. One more focused experiment required

Explain exactly what remains uncertain.

### D. Packed backend is not suitable at this scale

Explain why.

Do not choose based on the previous Spike 08 recommendation.

Choose based on the new measured 1.17M results.

---

# Definition of done

This task is complete when:

1. The complete extracted Lichess Broadcast corpus has a real packed index.
2. Exact file sizes are known.
3. The previous storage projection error is understood and corrected.
4. The complete packed corpus passes validation.
5. Sampled exact retrieval is independently verified against extraction data.
6. Historical Evidence has been exercised against the 1.17M corpus.
7. Exact lookup performance is measured.
8. Large structural bucket behavior is measured.
9. Build time, peak RAM, and peak disk usage are known.
10. A concrete initial segment strategy is documented.
11. Spike 08 contains corrected and production-scale measurements.
12. A production migration decision is made.

---

## Final principle

This task is not:

> “Optimize the packed format further.”

It is:

> **“Prove the already-validated packed design at the actual next production corpus size, using measured numbers rather than projections.”**

If the 1.17M Broadcast corpus passes this validation, we should have enough evidence to make packed binary the production position-occurrence backend and stop trying to scale the global occurrence store in PostgreSQL. 
