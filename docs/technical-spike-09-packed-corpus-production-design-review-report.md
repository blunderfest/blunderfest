# Technical Spike 09 — Packed Corpus Production Design Review

> Date: 2026-09-04 · Status: design review complete — no production code
> changed, nothing committed (diagnostic/experimental only, per the brief).
>
> **Verdict in one paragraph:** the packed-binary architecture is sound and
> remains the correct occurrence backend. The production failures were caused
> by (a) the pipeline using the full-occurrence-list API where a count was all
> that was needed — 13× per request on keys shared by all exact cards,
> (b) the format carrying no precomputed per-position counts/run offsets, so
> even the "cheap" count API walks the whole occurrence run, and (c) anchor
> indexes rebuilt at every boot as ~1.21M single-record preads. Spike 08 and
> production do not conflict: the spike measured one bounded lookup at a time
> on positions with ≤30k occurrences; production's hot keys carry 30k–1.17M
> occurrences and Historical Evidence issues 53 fetches per request. Every
> claim below carries a measured number; projections are labeled.

Sources read in full before forming conclusions: Technical Spike 08 report,
the Historical Examples Performance root-cause report + ticket, ADR-0026/
-0027/-0035/-0036/-0037, `docs/architecture.md`, `docs/corpus-scale-readiness.md`,
the 1.17M broadcast validation doc, and the current implementation (the
complete call graph, not just the modules named in the reports).

Measurement environment (this spike's own runs, all local unless noted):

- 8-core desktop, 15 GB RAM, NVMe; packed broadcast corpus at
  `data/corpus-packed-broadcast` (1 segment: occ 2,073,655,100 B +
  pos 6,248,826,889 B + bucket 1,737,446,208 B + book 3,067,706,132 B =
  12.2 GiB); docker Postgres with broadcast `corpus_games`/`corpus_moves`
  (1,174,661 rows each) and 100k `corpus_occurrences`/`corpus_positions`
  (6,814,883 / 5,833,794 rows).
- Code at HEAD = `be69c78d` (the reverted state — the per-card
  `occurrences/1` code path is live).
- Harnesses: `/tmp/opencode/spike09/*.exs` (HE request bench with BEAM
  tracing, boot/anchor bench, posmeta prototype build+bench, PG-compare,
  concurrency probe). Experiments ran in a throwaway git worktree
  (removed afterwards) and `/tmp`; **no file under `lib/` changed**.

---

## 1. Executive verdict

**Is packed binary still the correct occurrence backend?** Yes.

- Storage: 12.2 GiB measured for 94.26M occurrences vs ~29 GiB extrapolated
  PG (and the PG occurrence tables could not even be built at this scale in
  prod — the 94M-row `key` index build OOM-killed the Fly shared-cpu
  Postgres repeatedly and the COPY stage filled the volume into read-only;
  measured operationally 2026-08-30, ADR-0036).
- Reads: bounded lookups (position existence, headers, book) are 5–10×
  faster than PG at the 100k tier (§9); parity remains exact (re-verified
  this spike: 6/6 HE DTOs identical, §12.7).
- Build: ~28 min + ~6 min validation, ~6 GB peak RAM, no index-build wall.

**Was the architecture wrong, the implementation wrong, or both?**
The architecture is right; the implementation and the format's metadata do
not serve the product's dominant access pattern. Concretely, three causes —
none of them "packed binary is unsuitable":

1. **Implementation misuse (P0).** The evidence stage fetches the *full*
   occurrence list per card (`pipeline.ex:167`) only to derive
   occurrences/games/same_game_only. All 12 exact cards share the reference
   key, so a hot key's run is read and materialized 13× per request
   (measured: 53 facade `occurrences` calls, 16.0M tuples decoded, 18 s
   warm for the start position — §12.1).
2. **API/access-pattern mismatch (P0 enabler).** The facade offers
   "give me every occurrence" as the easy path and nothing cheaper for
   "how many?" apart from `occurrence_counts/1` — which itself still reads
   and walks the whole run (bounded in memory, unbounded in I/O/CPU:
   150 ms for the start position, §12.5). There is no bounded retrieval
   (`limit:`) and no O(1) stats, so callers accidentally pay O(run length)
   for count questions.
3. **Missing precomputation (P0 root).** The packer streams the sorted
   occurrence file — where every run's length, distinct-gid count and start
   offset are trivially available — and throws those numbers away. The
   position header carries `first_gid/first_ply` but no counts and no run
   offset (§6).
4. **Boot index rebuild (P1, availability).** Anchors are rebuilt at every
   open as 1,212,815 single-record preads (measured exactly; 41.8 s cold
   local, 6.2 and 11.6 min observed on prod). A design that is correct at
   100k (26.6k anchors) became a deploy/OOM outage multiplier at 1.17M.

**What specifically caused the spike → production discrepancy?** A workload
mismatch, quantified in §2: the spike benchmarked (a) single lookups, not
53-fetch requests; (b) positions with runs ≤ ~30k, not the 30k–1.17M hot
class the product actually surfaces first; (c) warm single-query latency,
never memory or concurrency. Cost here is linear in
`fetches-per-request × run length`, and both factors grew between spike and
prod (corpus ×11.7 in occurrences; HE's per-card fetch pattern unchanged).

---

## 2. Evidence reconciliation

Spike 08 vs production measurements — reconciled claim by claim:

| Spike 08 claim (measured then) | Production observation (measured) | Reconciliation |
|---|---|---|
| Exact corpus parity with PG | Re-verified: 6/6 HE DTOs identical at 100k (§12.7); 10,001-key broadcast artifact parity 0 failures | **Vindicated.** Correctness never regressed. |
| Packed store ~36–48% of PG storage | 12.2 GiB packed vs ~29 GiB extrapolated PG at 1.17M | **Vindicated** (both scale linearly; note the actual `book.bin` is 3.07 GB, ~3× the ~975 MB the validation doc projected — the 12.2 GiB prod payload reflects the real file). |
| Normal lookup ~3.5× faster than PG | Position existence 16–23 µs packed vs 110–155 µs PG; counts for cold keys 5–8× faster (§12.6) | **Vindicated for bounded lookups.** |
| Hot-key retrieval generally faster than PG | Start-position *materialize* is ~287 ms packed at 1.17M — but HE does that 13× per request, in one GenServer, plus decode+sort | **True but irrelevant to the real workload.** The spike measured one full retrieval of ≤100k-record runs (top-10 keys at the 100k tier); HE multiplies the same operation by 13–53 per request on runs 10–100× longer. Latency-per-fetch hid fetch-count × run-length. |
| Immutable segments + sparse anchors, "rebuilt at open" | 1,212,815 preads per open; 41.8 s cold local; 6.2–11.6 min prod boots | **Assumption disproven at scale.** Rebuild-at-open was fine at 26.6k anchors (100k tier); anchor count grows with total records (1.21M at 1.17M, ~10.4M at 10M). The sparse index itself is sound; its *lifecycle* is the defect (§7). |
| `occurrence_counts` distinct from `occurrences` | Cards used `occurrences` anyway (HEAD); and `occurrence_counts` still walks the full run (150 ms hot) | **The distinction existed but did not go far enough.** Counts avoid tuple materialization (memory) but not run-length I/O. Missing precomputation, not API absence (§6). |
| PG retained for games/moves/metadata | PG `moves_for(2000)` = 13–55 ms; 22+22 per-card round trips = ~20 ms total | **Vindicated.** PG is not a bottleneck in this pipeline. |
| HE parity on 6 reference positions (≤602 ms PG worst case at 100k) | Start 18–19.7 s, after-1.e4 8.9–9.5 s at 1.17M | **Benchmark blind spot, confirmed.** The parity set contained no ply-0/ply-1 position: the corpus' three hottest keys (start 1,169,388 occ; 1.e4 569,153; 1.d4 337,062) were absent; its hottest member (Najdorf, 30,628) already took 13.1 s packed on the 1.17M corpus in the validation's own `he18` run — the signal was visible, just not on the parity pass/fail set. |

**Why the two reports can both be true:** Spike 08's conclusions were
correct for the workload it measured. The root-cause report's findings are
correct for the workload production actually serves. The gap is the
workload: `cost = fetches/request × run-length × per-tuple work`, and the
spike held the first factor at 1 and the second below ~30k while production
runs 13–53 and up to 1.17M. Nothing in Spike 08's machinery failed; the
machinery was never asked this question.

---

## 3. Current access-pattern map

Data model (one segment; format v1): `occ.bin` 22 B/occurrence sorted
`(hash, gid, ply)`; `pos.bin` 36 B headers sorted by hash + strings region;
`bucket.bin` 24 B `(pawn_hash, pos_hash)` sorted; `book.bin` 22 B headers +
per-key move blobs; `manifest.json` with sizes + SHA-256. In-memory: four
flat anchor binaries (every 256th record's key), rebuilt at open
(`segment.ex:566`), totaling 17,142,736 B at this corpus.

Every public corpus operation (callers from the actual call graph):

| Operation | Callers | Files touched | Records scanned | Materializes tuples | Bounded | Hot-key complexity | Runs in Corpus GenServer |
|---|---|---|---|---|---|---|---|
| `occurrences/1` | Candidates (1 ref + 30 bucket scans), Pipeline cards (22) | occ.bin | **entire run** (start: 1,169,388 rec = 25.7 MB) | yes, full list + re-sort | **no** | **O(run)** read+decode+sort | yes |
| `occurrence_counts/1` | Candidates (1), Pipeline (1) | occ.bin | entire run | no list; recursive walk of run binary | memory-bounded only | **O(run)** read+walk (no decode) | yes |
| `position/1` | (none in the live product path; parity tasks) | pos.bin header + strings | ≤1 chunk | no | yes | O(log anchors) | yes |
| `pawn_bucket/2` | Candidates (1, limit 2000) | bucket.bin run + ≤2000 pos headers + ≤2000 strings | bucket run + 2000 header chunks | no | yes by `limit` (cold cost not bounded) | O(bucket cap) but ~4000 preads cold | yes |
| `book/1` | Pipeline (1), BookController `GET /api/book` | book.bin header + blob | 1 chunk + blob | no | yes | O(log anchors + moves) | yes |
| `book_counts/1` | BookController `POST /api/book/counts` | book.bin per FEN | per-FEN header + blob | no | yes | O(FENs × log anchors) | yes |
| `game/1`, `moves/1` | Pipeline cards (22 + 22) | PG | PK lookup | no | yes | O(1) | yes |
| `moves_for/1` | Pipeline menu (1, ≤2000 gids) | PG | batch | no | yes | O(gids) | yes |
| `export_game/1` | HistoricalEvidence add-to-room | PG | 1 game | no | yes | O(1) | yes |

Per HE request at HEAD (traced, warm; §12.1): 53 `occurrences`, 2
`occurrence_counts`, 1 `pawn_bucket`, 1 `book`, 1 `moves_for`, 22 `moves`,
22 `game` — **all executed inside the single Corpus GenServer** (facade
calls; decode and `Enum.sort` included — they happen in
`Segment.occurrences/2` under `handle_call`). The start position reads
405 MB and decodes 16,000,574 tuples per request; 12 of the 13 hot-run
reads are byte-identical duplicates.

---

## 4. Root architectural issues (ranked)

1. **No precomputed position statistics (missing precomputation).** The
   product's dominant HE operations — per-card counts, reference counts,
   `same_game_only`, transposition support counts — are count questions,
   and the store answers every one of them by reading the whole run. This
   is what makes hot keys expensive at all; everything else multiplies it.
2. **Full-list API used where counts suffice (implementation mistake).**
   `Pipeline.card/8` fetches the full run per card; 12 exact cards share
   the reference key → 13× read+decode of the same run (measured: 16.0M
   tuples, 91% of the start-position query, 744–972 MB peak → the prod
   OOM). The reverted commit `9d68f5ef` fixed exactly this and was safe
   (re-verified: DTOs identical, §12.2).
3. **No bounded occurrence retrieval (API mismatch).** Even the "bounded"
   consumer (`Enum.take(2000)` in Candidates) pays the full run read +
   materialization first; there is no `limit:` path, so every list fetch
   is O(run) regardless of how little the caller keeps.
4. **Anchors rebuilt at open as 1.21M single-record preads
   (implementation mistake / ops hazard).** Measured 41.8 s cold local,
   6.2–11.6 min prod; every deploy and every OOM restart is a full outage
   of that length, and auto-stop + the 60 s proxy deadline kills the first
   request after idle.
5. **Single-GenServer serialization amplifies 1–4 (architecture
   interaction).** The seam itself (ADR-0026) is deliberate and cheap for
   bounded operations (measured busy share: 115 ms of a 579 ms A2 query).
   It becomes toxic only because unbounded work parks in it: a start
   query pegs the corpus for 7.3 s of GenServer time and blocks the book
   panel and every other room.
6. **`book_games_count` semantic divergence (latent bug, measured).**
   Packed-mode `book_counts` sums per-move games from `book.bin`; that
   equals "games that played some recorded move", not `COUNT(DISTINCT
   gid)`. Measured at 1.17M: start −87,264 (games with no recorded next
   move drop out), Najdorf +95 (one game reaching the position twice with
   different continuations counts twice), A2 −1. PG mode returns the true
   count, so packed vs PG disagree on the transposition-support numbers.
   Rare per-key, systematically wrong for the hot keys.
7. **Cold bucket-scan latency (format cost, bounded).** ≤2000 pos-header
   + ≤2000 string preads scattered across `pos.bin`: +0.9–1.2 s first-touch
   cold locally (measured F1/Najdorf/rare), seconds on the prod volume.
   Only the first query after boot pays it.

Investigated and ruled out (with measurements in the root-cause report,
re-confirmed here): segmentation (1 segment; every logical lookup maps 1:1
to one segment call), file-descriptor lifecycle (59 opens, 3–4 µs total),
PG games/moves access (≤55 ms batched), DTO/JSON serialization (<0.5%).

### Phase C classification of every expensive operation

| Operation | Class | Evidence |
|---|---|---|
| Repeated card occurrence retrieval | **B** implementation mistake + **C** API mismatch | 13× identical run reads traced; DTO identical when replaced by counts (§12.2) |
| Occurrence counting | **D** missing precomputation | `occurrence_counts` walks the full run: 150 ms start key vs 14 µs prototype with stored counts (§12.5) |
| Independent-game counting | **D** missing precomputation | same walk; adjacent-gid dedup is exactly what the packer already streams past (§6) |
| Occurrence sorting | **B** implementation mistake | `Segment.occurrences` re-sorts already-sorted file data 13×/query (~0.38 µs/tuple isolated, ~3× in-query) |
| Candidate occurrence retrieval | **C** API mismatch | full run materialized to keep 2000 (start: 1.26M tuples in Variant A still, §12.2) |
| Pawn-bucket lookup | **A** inherent (bounded) + cold component **F** deployment | ≤2000 header+string preads; warm 5–73 ms, cold +0.9–1.2 s first-touch |
| Menu family construction | **E** product algorithm cost | `Families.build` over ≤2000 windows: Najdorf menu stage 1.39–1.41 s with `moves_for` ≤50 ms |
| Anchor rebuilding | **B** implementation mistake | 1,212,815 single-record preads; chunked/persisted prototypes 5–140× faster cold (§12.4) |
| Corpus GenServer serialization | **C** access-pattern amplifier (deliberate seam) | busy time = sum of facade calls: 7.3 s start at HEAD; 0.84 s Variant A |
| Opening/closing file descriptors | not significant | 59 open/close pairs, 3–4 µs total per query |
| PostgreSQL game/move access | not significant | 13–55 ms batched; 22+22 unbatched ≈ 20 ms |

---

## 5. Immediate production-safe fix (Horizon 1)

**The smallest safe change is the reverted fix plus request-scoped
memoization** — implemented and measured this spike in a throwaway worktree
(2 files, +13/−6, plus a 25-line memo module; not on `main`):

1. Cards use `occurrence_counts/1` instead of `occurrences/1`
   (identical to reverted commit `9d68f5ef`); `same_game_only` =
   `occurrences > 1 and games == 1` (pinned by the existing
   same-game-candidate test).
2. Request-scoped memoization of counts keyed by canonical position key —
   the 12 exact cards sharing the reference key count it once, not 12
   times; the duplicate `occurrence_counts(ref_key)` in Candidates +
   Pipeline collapses to one facade call (traced: 3–6 distinct-key count
   calls per query, down from 2 + 22 list fetches).
3. Fallback to the list only when the facade is unconfigured.

Measured effect (same harness, same corpus, warm):

| Position | HEAD | Variant A | tuples decoded (HEAD → A) | peak BEAM (HEAD → A) |
|---|---:|---:|---|---|
| start | 19,652 ms | **1,979 ms** | 16.0M → 1.26M | 972 → 435 MB |
| after-1.e4 | 9,509 ms | **1,011 ms** | 7.46M → 0.58M | 502 → 234 MB |
| after-1.d4 | 7,496 ms | 1,374 ms | 6.12M → 0.59M | 457 → 216 MB |
| Najdorf | 2,604 ms | 2,212 ms | 0.46M → 0.05M | — |
| F1 | 897 ms | 898 ms | 19,911 → 3,981 | — |
| A2 | 579 ms | 482 ms | 173,413 → 22,619 | — |

**Semantics: DTOs are byte-identical (timings stripped) on all 8 benchmark
positions** — verified field-by-field this spike (§12.2). The Najdorf/A2
floors are the menu-stage `Families.build` CPU (class E), not storage.

Regression risk: low — the count path already runs twice per query at
HEAD, the fallback preserves unconfigured behavior, and the equality proof
is mechanical (same run, same dedup convention). What it does **not** fix
(and must not be confused with fixing): the candidates stage still
materializes the reference run once (1.26M tuples for the start position —
why the peak is still 435 MB), boot is untouched, and counts still walk
the run (visible at 10M, §10). This is a production-safety patch, not the
10M architecture.

---

## 6. Recommended packed format vNext (Horizon 2)

The position header grows three derived fields; nothing else changes:

```
pos.bin header v2 (49 bytes, +13 over v1):
  <<hash::binary-size(16),          # as today
    pawn_hash::unsigned-64,         # as today
    occurrence_count::unsigned-32,  # NEW — run length in occ.bin
    game_count::unsigned-32,        # NEW — distinct gids in the run
    occ_run_offset::unsigned-40,    # NEW — first record index of the run
    first_gid::unsigned-32,         # as today
    first_ply::unsigned-16,         # as today
    string_offset::unsigned-32,     # as today
    string_len::unsigned-16>>       # as today
```

(`occ_run_length` is `occurrence_count`; storing both would be redundant.
u40 offsets address 1.1 T occurrences — u32 would suffice to ~4.29B
occurrences but leaves no headroom at 50M games.)

Field-by-field, answering the brief's ten questions:

**`occurrence_count` (4 B).**
1. Requested: every HE request (reference counts + per-card counts =
   15–30 count questions at HEAD) + book counts.
2. Cost today: read+walk of the entire run — 150,164 µs start, 71,346 µs
   e4, 754 µs A2 (measured, §12.5).
3. Pack-time deterministic: yes — the builder streams runs sorted
   `(hash, gid, ply)`; run length is a counter (the prototype computed all
   72.4M of them in a 94 s pass over the sorted stream).
4. +4 B/position. 5. Current corpus +290 MB; 10M games ≈ +2.5 GB
   (~616M positions, projected linearly); 50M ≈ +12 GB. 6. Count queries
   become O(log anchors) header reads — bounded, independent of run length.
7. Correctness: exact by construction (validated 500/500 random + all hot
   keys against the run walk, §12.5). 8. Multi-segment: per-segment counts
   sum (occurrences are additive; see the independent-games proof below).
9. PG tail: tail positions absent from the header get their counts from
   the tail table — same merge shape as today's `Packed.occurrence_counts`.
10. Parity-checkable: exact SQL equivalents (`COUNT(*)`,
   `COUNT(DISTINCT gid)`) — the packer can validate against PG at build
   time on sampled keys.

**`game_count` (4 B) — independent games.** The brief's critical question,
verified rather than assumed:

- Segment gid ranges are disjoint by construction (`corpus.pack`'s
  `gid_boundaries` partitions `[1, games_count]` into non-overlapping
  ranges and `split_segments` filters rows into exactly one segment per
  gid).
- A game is packed exactly once: extraction emits one row stream per game,
  the packer never repacks an existing segment, and compaction merges
  whole segments.
- Therefore a gid can never appear in two segments, distinct-gid sets
  across segments are disjoint, and **per-segment `game_count`s sum
  exactly**. The current code's fallback to full-list distinct counting
  when a key appears in >1 segment (`packed.ex:99`) exists only because
  the counts aren't stored; with stored per-segment counts that fallback
  (a latent hot-key trap at >1 segment) disappears.
- Incremental tail: the PG tail's `COUNT(DISTINCT gid)` stays separate and
  adds to the packed sum — safe because tail gids are allocated above all
  packed segments' ranges (today's gid-monotonic import convention; make
  it an explicit compaction invariant).
- Same request frequency, cost, determinism, parity story as
  `occurrence_count` (adjacent-gid dedup in the sorted run; measured exact
  on all samples). This is what makes `same_game_only` an O(1) header
  read: `occurrence_count > 1 and game_count == 1`.

**`occ_run_offset` (5 B).**
1. Requested by every occurrence retrieval — first occurrence (position
   headers already carry `first_gid/first_ply`, which the offset makes
   derivable instead of stored), bounded samples (candidate scan keeps 8,
   menu keeps 2000), and full lists.
2. Cost today: a *second* hash search in occ.bin per retrieval (anchor
   binary search + walk-back + chunk scan) before any record is read;
   bounded reads don't exist at all.
3. Pack-time deterministic: the run's start record index at the moment the
   run is written (prototype: stored u40, verified `occ.bin[offset]`
   decodes to `(first_gid, first_ply)` for all hot keys and 500 random
   positions — matches the header fields exactly, §12.5).
4. +5 B/position. 5. +362 MB current; +3.1 GB at 10M; +15.5 GB at 50M.
6. First occurrence and `occurrences(limit: n)` become one pread of
   `n × 22 B` at a known offset — measured 3/11/41 µs for n = 1/12/2000 on
   the start position vs 150 ms+ for the walk path. Full retrieval stays
   available as `all_occurrences` (explicitly O(run)).
7–10. Same answers as `occurrence_count`; per-segment offsets are
segment-local (each segment's `occ.bin` is its own address space), so
multi-segment merging needs no offset arithmetic.

**Storage impact of vNext headers** (measured current; 10M/50M linear
projections from measured ratios — 80.2 occ/game, 61.6 positions/game,
50.3 B avg key string):

| Corpus | occ.bin | pos.bin (v1 → v2) | bucket.bin | book.bin | total (v1 → v2) |
|---|---:|---:|---:|---:|---:|
| 1.17M (measured) | 1.93 GiB | 5.82 → **6.72 GiB** | 1.62 GiB | 2.86 GiB | 12.2 → **13.1 GiB** (+7.4%) |
| 10M (projected) | ~16.6 GiB | ~49.6 → **~56.5 GiB** | ~13.8 GiB | ~24.5 GiB | ~104 → **~112 GiB** |
| 50M (projected) | ~83 GiB | ~248 → **~282 GiB** | ~69 GiB | ~122 GiB | ~522 → **~556 GiB** |

Metadata added: 941 MB at current scale (measured prototype file). The
brief's warning is honored: no field is added because space is available —
each buys a measured O(run) → O(1)/O(log N) conversion on the product's
hottest path.

---

## 7. Boot/index design

Measured options (all prototypes verified byte-equal to current anchors):

| Option | Warm open | Cold open (local NVMe) | preads | On-disk | Memory | Notes |
|---|---:|---:|---:|---:|---:|---|
| 1. Current rebuild | 4,987 ms | 41,799 ms (prod: 6.2–11.6 min) | 1,212,815 | 0 | 17.1 MB | syscall-bound cold; scales linearly with records |
| 2a. Chunked/windowed rebuild | 13,693 ms | **4,782 ms** | ~4,700 (≈1.4 MB each) | 0 | 17.1 MB | reads whole files sequentially (13 GB); cold wins via readahead; warm run measured under memory pressure — treat warm as ≤ cold |
| 2b. Batched multi-position pread | 2,750 ms | 49,828 ms | 1,212,815 (batched in BEAM) | 0 | 17.1 MB | proves the cold cost is syscall latency, not BEAM round trips |
| 3. **Persisted anchors at pack time** | **6 ms** | **7 ms** | 4 | +17.1 MB (sidecars) | 17.1 MB | derived data; checksum in manifest; rebuild fallback if missing |

Recommendation: **Option 3 with Option 2a as the fallback.** The packed
corpus is immutable derived data; the anchor set is a deterministic
function of the segment files and the stride, so the packer should emit
`*.anchors` next to each segment (build cost measured: 5 ms to write once
the open has run — in production the packer writes them directly during
the build pass, no open needed). Manifest gains per-anchor checksums;
`open` reads 4 binaries (~17 MB, single-digit milliseconds warm or cold)
and, on missing/corrupt sidecars, falls back to the chunked rebuild
(Option 2a — 4.8 s cold local, still ~8× better than today). Versioning:
anchor files carry stride + format version in a small header; a stride or
format change invalidates them cleanly (they're rebuildable).

Scaling: anchors = `records/stride × key_bytes` — 17.1 MB now, ≈145 MB at
10M games (occ 802M/256×16 + pos/bucket/book), still a sub-second
sequential read. **Boots stop scaling with corpus size in any observable
sense** — the acceptance principle of seconds-scale recovery holds at 50M.

Why not runtime reconstruction at all, given determinism: because the
rebuild's cost is pure waste paid on every deploy, every OOM restart, and
every auto-start — exactly the moments availability matters. The packer
already spends ~28 min; writing 17 MB of anchors is unmeasurable within it.

---

## 8. Runtime concurrency model

Measured state (Variant A — i.e., after the hot-key work is bounded;
concurrency before bounding is excluded by design, and HEAD measurements
show why: two concurrent start queries peak **1,429 MB** BEAM total and
each takes ~25 s):

| Concurrency (start position, Variant A) | Wall | Peak BEAM |
|---|---:|---:|
| 1 query | 1,897 ms | 289 MB |
| 2 queries | 3,069 ms | 289 MB |
| 4 queries | 4,782 ms | 431 MB |

Findings:

- **What the GenServer protects:** the Postgrex pool handle and the packed
  backend struct (segments + anchors). The packed side is immutable after
  open; reads never mutate it (`Segment` even keeps no fds — every read
  opens/closes its own). There is no correctness requirement to serialize
  packed reads.
- **Serialization is an implementation convenience elevated to
  architecture** (ADR-0026's replaceability seam). With bounded operations
  it costs little (busy share: 7.3 s/19.7 s start at HEAD → 0.84 s/1.98 s
  Variant A; 115 ms/579 ms A2) but still caps corpus throughput at one
  query at a time — visible above as wall time growing ~linearly with n.
- **Memory:** bounding first is what made concurrency safe — 4 concurrent
  hot queries stay at 431 MB because each one's heavy phase (the run read)
  is serialized inside the GenServer and short.

Recommendation: **keep the GenServer as the facade/coordinator now** (it
remains the replaceability seam and PG-pool owner), and schedule one
specific relaxation for the vNext phase: immutable packed reads may run in
the caller process (the facade hands out the open backend struct; each
caller opens its own fd — the existing per-call-open discipline already
makes fds process-local), while PG-backed calls keep their single
serialized path. Do this only if queueing is measured after bounding
(the corpus-GenServer mailbox metric from the root-cause report's telemetry
list is the trigger). Explicitly rejected, per measurements: parallelizing
the current unbounded implementation (OOM amplifier, 1.4 GB at n=2),
persistent shared fds (owner-only pread constraint), broad cross-request
caching (nothing measured justifies it).

---

## 9. PostgreSQL comparison (fair, per-operation)

100k tier — the one scale where both backends are fully loaded (PG
occurrence tables at 1.17M are the build that failed in prod; §"build"
below). Warm, medians of 20–200 reps (§12.6):

| Operation | PG | packed | Winner |
|---|---:|---:|---|
| position existence | 110–155 µs | 16–23 µs | packed ~6× |
| occurrence count (cold key, a2) | 187 µs | 22 µs | packed ~8× |
| occurrence count (hot key, e4) | 85,712 µs | 4,836 µs | packed ~18× |
| independent-game count | same query | same walk | tie (both O(run)) |
| first occurrence | 144–87,826 µs (sort-then-limit) | 16–25 µs (header field) | packed, decisive |
| bounded sample, limit 12 (hot e4) | 86,879 µs | 9,702 µs (unbounded read + take) | packed, but see below |
| bounded sample, limit 12 (start, 100k) | 9,459 µs | 14,957 µs | **PG** — packed has no LIMIT; SQL's index LIMIT beats a 2.2 MB full read |
| complete occurrence list (e4) | 114,442 µs | 32,587 µs | packed ~3.5× |
| pawn bucket (2000 keys, warm) | 408–1,204 µs | 1,910–4,339 µs | **PG** — packed resolves ≤2000 headers+strings (known tail since Spike 08) |
| HE end-to-end, 6 positions | 17–1,069 ms | 9–1,058 ms | parity + packed ≈ PG (slight edge packed) |
| build at 1.17M | **failed** (index-build OOM ×N, volume read-only) | 28 min + 6 min validation, ~6 GB RAM | packed, decisive |
| storage 100k occ store | 2,112 MB | 996 MB (47%) | packed |
| storage 1.17M occ store | ~29 GiB (extrapolated) | 12.2 GiB (measured) | packed |

Interpretation, without ideology:

- Packed wins the operations the product runs most (existence, counts,
  first occurrence, full runs, HE end-to-end) and the operation PG cannot
  do at all (building the 1.17M index). PG wins exactly two: SQL `LIMIT`
  semantics packed lacks (vNext's run offsets close this — §6) and warm
  pawn-bucket scans (packed's bucket path stays a documented tail; the
  pipeline already caps it).
- The honest hybrid is **already the production architecture**: packed for
  occurrences, PG for games/moves/metadata. No component of this review
  argues for moving occurrences back to PG (its load path is a measured
  wall at this scale) or for pulling games/moves out of PG (measured
  non-bottleneck, and canonical PGN belongs in a real store).
- At 1.17M, PG query latency would likely stay ms-scale per bounded lookup
  (btree depth +1 level — projection, labeled) — but the product's hot
  queries are count/full-run operations on 10⁵–10⁶-row runs, where PG's
  100k-tier behavior (85 ms count, 114 ms full list for e4's 58k run)
  projects to seconds, and the build wall arrives before any of it can be
  queried.

---

## 10. 10M+ scaling model

Ratios measured on the 1.17M corpus: 80.2 occurrences/game, 61.6 distinct
positions/game, 50.3 B average key string, 20.9 B average book blob/header.
"Measured" = observed this spike or in the validation doc; "projected" =
linear scaling on those ratios; "assumption" = flagged.

| Quantity | 1.17M (measured) | 10M (projected) | 50M (projected) |
|---|---:|---:|---:|
| Occurrences | 94.26M | ~802M | ~4.01B |
| Distinct positions | 72.39M | ~616M | ~3.08B |
| Packed storage v1 | 12.2 GiB | ~104 GiB | ~522 GiB |
| Packed storage v2 (+13 B/pos) | 13.1 GiB | ~112 GiB | ~556 GiB |
| Anchor memory @256 | 17.1 MB | ~145 MB | ~725 MB (assumption: stride stays 256; 1024 halves it for +2× lookup p50) |
| Boot, current rebuild | 5 s warm / 42 s cold / 6–12 min prod | ~40 s warm / ~6 min cold / (assumption) ~1 h prod | untenable |
| Boot, persisted anchors | ~10 ms | ~0.5–1 s | ~2–3 s |
| Count lookup (current walk) | 150 ms hot | ~1.3 s hot | ~6 s hot |
| Count lookup (v2 header) | 14 µs (prototype) | ~15–20 µs (assumption: +1 btree level) | ~20–25 µs |
| Full occurrence lookup, hot | 287 ms materialize | ~2.5 s | ~12 s (explicitly expensive by design) |
| HE hot key, HEAD | 18–19.7 s | (root-cause projection, confirmed in kind) ~2 min | untenable |
| HE hot key, Horizon-1 fix | ~2.0 s | ~10–15 s (candidate materialization dominates: 10M tuples ≈ 800 MB — still OOM-class at 1 GB) | untenable |
| HE hot key, vNext + bounded API | — | **<1 s target** (counts O(1); candidates read ≤2000×22 B; menu CPU unchanged ~1.4 s worst case — the remaining floor is class-E product CPU) | same class |
| Peak request memory, hot | 744–972 MB | worse | — |
| Peak request memory, Horizon-1 fix | ~435 MB | ~1 GB+ (candidate materialization) | — |
| Peak request memory, vNext + bounded | ≤ ~50 MB (assumption: no list >2000 tuples anywhere in HE) | same | same |

The architectural property the numbers argue for: **after vNext, no
storage-side cost of a count/stat/first/bounded query grows with a
position's occurrence count** — the only remaining hot-key costs are the
menu's ≤2000-window family CPU (bounded, class E) and explicitly requested
full lists.

---

## 11. Migration plan

Format v2 is derived data, so the migration is a **full repack, not an
in-place conversion** — no migration machinery, no dual-format read paths
beyond what open() already does:

1. **Versioning:** manifest `"version": 2` with per-segment
   `"pos_version": 2` and the anchor sidecar entries; `Manifest.open`
   rejects unknown versions (today's all-or-nothing validation, extended).
   The v1 reader keeps opening v1 dirs — both coexist during rollout.
2. **Rebuild:** `mix corpus.pack` gains the three header fields (they fall
   out of the existing sorted-stream pass — the prototype computed all
   72.4M in 94 s on top of the current combine/sort, inside the ~28 min
   build) and emits `*.anchors` sidecars. Same external-sort pipeline,
   same ~50 GB temp-disk envelope.
3. **Validation before publish (all have exact oracles):**
   - parity vs PG on the 100k oracle: `occurrence_count` = `COUNT(*)`,
     `game_count` = `COUNT(DISTINCT gid)`, `occ_run_offset` decodes to
     `(first_gid, first_ply)` = the `corpus_positions` row — sampled keys
     plus hot keys, same shape as `mix corpus.parity`;
   - artifact parity at 1.17M: streamed re-count of `sorted.tsv` vs the
     packed headers (the prototype's check, productized);
   - `he_parity` on both backends, extended with the three hot opening
     positions the parity set lacks;
   - checksum validation (`mix corpus.validate`) including sidecars.
4. **Atomic publish:** the existing build-dir → rename swap; the old dir
   survives as `.prev` until the new one opens (already implemented in
   `corpus.pack`'s `publish!`).
5. **Prod replacement:** sftp the new dir to both region volumes (the
   established 12.2 GiB procedure; +0.9 GiB), SHA-256-verify against the
   manifest, flip `PACKED_DIR`, deploy. Rollback = point `PACKED_DIR` back
   at the retained v1 dir + redeploy — seconds, no data risk. PG tables
   untouched throughout.
6. **Horizon-1 patch ships independently and first** — it needs no repack,
   no format change, and removes the OOM class while v2 is built.

---

## 12. Benchmark results (this spike's measurements)

Benchmark set: the existing six positions plus the brief's required hot
positions — start, after-1.e4, after-1.d4 (added hot opener), Najdorf
tabiya, F1 KID tabiya, A2 Ruy decision, rare middlegame, cold endgame.
Harness records per query: stage timings, all-process reductions, facade
call counts + busy time, segment call counts, decoded tuples, pread
count + bytes, BEAM peak (50 ms sampler), GenServer heap delta; DTOs
stored for byte comparison.

### 12.1 HEAD baseline (packed 1.17M, warm, medians)

| Position | total | candidates | menu | evidence | reductions | preads | bytes | tuples | peak | facade busy |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| start | 19,652 ms | 807 | 691 | 17,980 | 382M | 71,988 | 386 MB | 16,000,574 | 972 MB | 7,304 ms |
| after-1.e4 | 9,509 | 384 | 319 | 8,732 | 183M | 33,764 | 181 MB | 7,457,147 | 502 MB | 3,978 |
| after-1.d4 | 7,496 | 340 | 605 | 6,505 | 173M | 26,723 | 143 MB | 6,115,630 | 457 MB | 2,691 |
| Najdorf | 2,604 | 111 | 1,406 | 1,083 | 108M | 5,140 | 24 MB | 462,866 | 288 MB | 260 |
| F1 | 897 | 62 | 407 | 426 | 35M | 4,157 | 18 MB | 19,911 | 272 MB | 96 |
| A2 | 579 | 21 | 212 | 342 | 20M | 1,382 | 6 MB | 173,413 | 265 MB | 107 |
| rare middlegame | 68 | 62 | 0 | 5 | 1M | 4,060 | 18 MB | 115 | 250 MB | 50 |
| cold endgame | 11 | 6 | 0 | 4 | <1M | 373 | 1 MB | 41 | ~0 | 9 |

Facade calls per hot query: `occurrences×53`, `occurrence_counts×2`,
`pawn_bucket×1`, `book×1`, `moves_for×1`, `moves×22`, `game×22`.
Cold-vs-warm: hot keys are CPU-bound (start 19.8 s both ways); only the
bucket scan is cache-sensitive (Najdorf pawn_bucket 976 ms cold → 73 ms
warm; F1 1,185 → 44; rare 1,110 → 43). Concurrency: n=2 start queries →
wall 24,944 ms, peak **1,429 MB**.

### 12.2 Variant A (counts + request-scoped memo)

| Position | HEAD → A | tuples (HEAD → A) | preads (HEAD → A) | peak (HEAD → A) |
|---|---:|---|---|---|
| start | 19,652 → **1,979 ms** | 16.0M → 1.26M | 71,988 → 10,174 | 972 → 435 MB |
| after-1.e4 | 9,509 → **1,011 ms** | 7.46M → 0.58M | 33,764 → 4,704 | 502 → 234 MB |
| after-1.d4 | 7,496 → 1,374 ms | 6.12M → 0.59M | 26,723 → 4,538 | 457 → 216 MB |
| Najdorf | 2,604 → 2,212 ms | 0.46M → 0.05M | — | — |
| F1 | 897 → 898 ms | 19,911 → 3,981 | — | — |
| A2 | 579 → 482 ms | 173,413 → 22,619 | — | — |
| rare | 68 → 62 ms | — | — | — |
| endgame | 11 → 11 ms | — | — | — |

Count calls collapse to distinct keys: 3 (hot 3-key positions) to 11
(endgame, 10 structural keys + ref). **DTOs byte-identical on all 8
positions** (field-by-field compare, timings stripped). Concurrency: n=4
start queries → wall 4,782 ms, peak 431 MB.

### 12.3 Residual cost after Variant A (what vNext removes)

- Candidates stage still materializes the reference run once: start
  1,260,570 tuples (bounded consumer keeps 2,000) — 565 ms facade busy +
  the 435 MB peak's main component.
- Each distinct-key count still walks its run: 3 calls × up to 150 ms.

### 12.4 Boot/anchor options (anchors verified byte-equal)

| Option | warm | cold | preads | sidecar bytes |
|---|---:|---:|---:|---:|
| current | 4,987 ms | 41,799 ms | 1,212,815 | 0 |
| chunked sequential | 13,693 ms | 4,782 ms | ~4,700 | 0 |
| batched multi-pread | 2,750 ms | 49,828 ms | 1,212,815 | 0 |
| persisted sidecars | 6 ms | 7 ms | 4 | 17,142,736 |

Anchor footprint: occ 5,891,072 B + pos 4,524,608 B + bucket 2,262,304 B +
book 4,464,752 B. Boot idle BEAM total with the corpus open: 85 MB. Prod
observed boots: 6.2 and 11.6 min (root-cause forensics).

### 12.5 Position-metadata prototype (vNext stand-in)

Built from the pack-time sorted stream: 94,257,050 rows in 94 s →
72,393,592 records × 13 B (run offset u40, occ count u32, game count u32)
= 941,116,696 B, index-aligned with pos.bin headers.

- Correctness: hot keys + 500 random positions — counts match the run
  walk exactly (0 mismatches); `occ.bin[offset]` decodes to the header's
  `(first_gid, first_ply)` on every check.
- Stats lookup vs run walk: start 14 µs vs 150,164 µs; e4 91 µs vs
  71,346 µs; A2 10 µs vs 754 µs; F1 9 µs vs 139 µs.
- Bounded reads via run offset (start): limit 1 → 3 µs; 12 → 11 µs;
  2000 → 41 µs; each equals the full-run prefix.

### 12.6 PG vs packed at 100k

See §9's table (full run in `/tmp/opencode/spike09/pg_compare_results.txt`).
Storage measured same session: PG occ 1,049 MB + pos 1,063 MB vs packed
occ 142 + pos 487 + bucket 133 + book 234 MB.

### 12.7 HE parity re-run (100k, both backends, 6/6 identical DTOs)

F1 PG 427 vs packed 365 ms; A2 412 vs 366; Najdorf 1,069 vs 1,058; rare
179 vs 168; endgame 17 vs 9; same-game dup 207 vs 185. (One environment
trap found and documented: the local PG games/moves tables are broadcast
while the occurrence tables are 100k — gids collide across corpora, so any
PG-side run must use matching-tier tables or the book join silently reads
the wrong games. The parity task now needs the tier-swap dance.)

### 12.8 Semantic check: `book_games_count` vs true independent games (1.17M)

| Key | true games | book-sum | diff |
|---|---:|---:|---:|
| start | 1,169,353 | 1,082,089 | −87,264 |
| after-1.e4 | 569,149 | 566,861 | −2,288 |
| after-1.d4 | 337,058 | 335,919 | −1,139 |
| Najdorf | 30,244 | 30,339 | +95 |
| A2 | 7,655 | 7,654 | −1 |

vNext's `game_count` header gives packed-mode `book_counts` the true
number; until then this divergence is latent in prod's packed mode.

---

## 13. Implementation plan (small, independently verifiable phases)

**Phase 0 — Horizon-1 pipeline fix (this week).**
Scope: card counts via `occurrence_counts` + request-scoped count memo +
collapse of the duplicate reference count (the measured Variant A; the
memo threaded explicitly through Pipeline/Candidates rather than via
process dictionary). Expected: start ≤2.5 s / e4 ≤1.5 s warm; peak ≤450 MB;
no DTO change. Tests: existing same-game-candidate test + a DTO-parity
harness run (this spike's) against the pre-fix output for the 8 positions.
Benchmark gate: start warm <2.5 s, tuples/query ≤1.3M, bytes ≤60 MB.
Rollback: revert one commit.

**Phase 1 — Boot fix: persisted anchors (next).**
Scope: packer emits `*.anchors` (+ stride/version header, manifest entries
+ checksums); `Packed.open` loads sidecars, falls back to a chunked
sequential rebuild (Option 2a) when absent/mismatched; `Corpus.init` logs
open duration + source. Expected: prod deploy-to-serving minutes → seconds;
cold open <60 s local, <1 s with sidecars. Tests: anchor byte-equality
(sidecar vs rebuilt), corrupt/missing-sidecar fallback test, existing open
tests. Benchmark gate: cold `Packed.open` ≤5 s local without sidecars,
≤100 ms with. Rollback: delete sidecars → rebuild path (behavior = today
minus the syscall pattern).

**Phase 2 — Format v2 repack behind a flag.**
Scope: `pos_version 2` headers with `occurrence_count`, `game_count`,
`occ_run_offset`; builder validation extended (counts recomputed and
compared on a sampled pass); parity tasks extended (PG oracles for all
three fields); manifest v2. No API switch yet. Expected: v2 dir validated
locally and on prod volumes; v1 dir retained. Tests: builder round-trip,
sampled parity at both tiers, he_parity (extended set) on v2. Benchmark
gate: hot-key stats lookup ≤100 µs; parity 0 failures. Rollback: keep v1
dir; `PACKED_DIR` flip.

**Phase 3 — API from product needs + pipeline cutover (Phase K shape).**
Scope, per the investigation's evidence (not prescribed names):
`position_stats(key)` → O(log N) `%{occurrences, games}` (bounded);
`first_occurrence(key)` → O(log N) via run offset; `occurrences(key,
limit: n)` → O(log N + n); `all_occurrences(key)` → explicit O(run), used
nowhere in HE; `book_counts` served from `game_count` (fixes §12.8).
Complexity contract documented per function in the facade moduledoc.
Pipeline/Candidates switch to stats + bounded reads; the full-list fetch
disappears from the HE path. Tests: parity of the new API against PG at
100k (exact SQL equivalents exist for every new operation); HE DTO parity
again. Benchmark gate: start-position HE warm <1 s, ≤40 MB read, peak
<300 MB; moderate positions unchanged or faster. Rollback: config flag
back to the v1 API mapping.

**Phase 4 — Ops + concurrency follow-through (after Phases 0–3 are live).**
Scope: health checks + `min_machines_running = 1` (root-cause fix #3);
GenServer mailbox telemetry; then, only if queueing is measured, the §8
caller-side packed reads. Not parallelization of the current code.

Each phase leaves prod serving a strictly safer state than it found; no
phase depends on a later one for correctness.

---

## 14. Decision table

| Criterion | Current packed (HEAD) | Packed + pipeline fix (Horizon 1) | Packed vNext (format v2 + API) | PostgreSQL-only | Hybrid (status quo architecture) |
|---|---|---|---|---|---|
| Hot-key HE latency (start, 1.17M) | 18–19.7 s | ~2 s | <1 s | seconds (count = full index scan; projected) | = packed side |
| OOM safety (1 GB machine) | kills it (744 MB single, 1.43 GB ×2) | safe-ish (435 MB; candidate materialization remains) | safe (<300 MB by construction) | unknown (untested at this scale) | = packed side |
| Boot/recovery | 6–12 min | 6–12 min | seconds (persisted anchors) | PG restart fast, but 1.17M tables unbuildable there | seconds (packed side fixed) |
| Count/stat boundedness | O(run) | O(run) ×fewer | **O(log N)** | O(run) | O(log N) |
| Storage (1.17M) | 12.2 GiB | 12.2 GiB | 13.1 GiB | ~29 GiB (projected; unbuildable) | 12.2 GiB + small PG |
| Build at 1.17M+ | works (28 min) | works | works (+fields free) | **fails (measured OOM)** | works |
| 10M viability | no (minutes/query, hour boots) | partial (counts still walk; candidate materialization OOMs) | yes (bounded hot path) | no | yes |
| Semantics risk | — | none proven (DTOs identical) | low (fields have exact PG oracles) | n/a | low |
| Effort | — | ~1 day | repack + API phase | rebuild PG load path nobody can run | sum of parts |

## 15. Final recommendation

One recommendation, two horizons, no branch points left open:

1. **Ship Horizon 1 now** (Phase 0): the counts+memoization patch exactly
   as measured — byte-identical semantics, start position 19.7 s → 2.0 s,
   OOM fuel removed. It is the reverted commit `9d68f5ef` completed with
   request-scoped dedup; it is safe, tiny, and the product cannot run
   hot-key queries at all without it.
2. **Build format vNext** (Phases 1–3): position headers carrying
   `occurrence_count`, `game_count`, `occ_run_offset` (+13 B/position,
   +7.4% storage), anchors persisted at pack time, and an API where counts
   and bounded reads are O(log N) and full lists are explicit. A full
   repack publishes it; no in-place migration machinery.
3. **Keep the hybrid split as-is**: packed for occurrences, PG for
   games/moves/metadata. Do not return occurrences to PostgreSQL (its
   1.17M build is a measured wall), do not parallelize the unbounded
   path, and do not add cross-request caches — none of these has a
   measurement in its favor.

The acceptance principles, checked: (1) counts bounded — vNext headers;
(2) full retrieval remains, explicitly expensive — `all_occurrences`;
(3) start-position card metadata allocates kilobytes, not hundreds of MB —
Phase 3's bounded reads (measured: 41 µs for 2000 tuples); (4) no
million-pread boots — persisted anchors (7 ms cold); (5) light queries
unchanged or faster in every measurement; (6) HE semantics unchanged —
DTO parity proven for Horizon 1, oracle-backed for vNext; (7)
independent-game counts provably segment-summable; (8) storage/build
advantages retained (47% storage at 100k, 28-min builds); (9) viable at
10M and 50M per the §10 model; (10) recovery becomes seconds-scale.

*Stop here, per the brief: the recommended architecture is designed and
measured, not implemented. All harnesses live in `/tmp/opencode/spike09/`;
the experimental worktree was removed; `main` is untouched.*
