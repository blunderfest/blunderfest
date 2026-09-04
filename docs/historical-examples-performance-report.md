# Historical Examples Performance — Root-Cause Investigation Report

Ticket: [`docs/historical-examples-performance.md`](historical-examples-performance.md)
Date: 2026-09-03/04 · Investigator: opencode session (diagnostic only — no production
code changed, nothing committed)

Environment measured:

- **Local**: 8-core desktop, NVMe SSD, 15 GB RAM. Packed broadcast corpus at
  `data/corpus-packed-broadcast` (1,174,661 games / 94,257,050 occurrences /
  72,393,592 positions / **1 segment**: occ.bin 2.07 GB + pos.bin 6.25 GB +
  bucket.bin 1.74 GB + book.bin 3.07 GB), local docker Postgres with the broadcast
  `corpus_games`/`corpus_moves` (1,174,661 rows each). Code at `main` (reverted
  state, `be69c78d`).
- **Prod** (read-only): Fly app `blunderfest`, 1 shared vCPU / 1 GB, volume-mounted
  packed dir, PG on a separate app. Log/machine-event forensics plus two live API
  requests (the same query class the ticket reports).

All numbers below were measured, not inferred. "HEAD" = current reverted code;
"fix" = commit `9d68f5ef` (the reverted perf change), executed in a clean worktree
against the same corpus.

---

## 0. Incident reconstruction (the questions behind the ticket)

The ticket says "Historical Examples takes ~10 s in production after the binary
corpus deployment". The session context adds: a previous AI changed something,
the site went down, the change was reverted, and the feature now feels fast
(~500 ms). Timeline from Fly releases/machine events/logs (local CEST):

| time | event |
|---|---|
| 22:06 | flip deploy (packed corpus live in prod, machine recreated 22:07) |
| 22:07–22:29 | hot-key "Find examples" queries take ~10 s (the report) |
| 22:29 | perf-fix commit `9d68f5ef` deployed (v498/499) |
| 22:29–23:04 | site observed unavailable |
| 23:00 | revert commit `be69c78d` |
| 23:04 | revert deployed (v500/501); machine launched 23:04:17 |
| 23:10:31 | endpoint serving again (**6.2-minute boot**) |
| 23:12–23:17 | evidence requests answer in 373–1,356 ms |

Findings, each with direct evidence:

1. **The ~10 s latency is real, position-dependent, and still reproducible.** It
   affects any *hot reference key* (roughly ≥30k occurrences: early openings,
   tabiyas, the start position). Measured locally (warm): after-1.e4 **8.9 s**,
   start position **17.9–18.5 s**, Najdorf tabiya **2.3 s**, Ruy decision point
   **0.52 s**. Prod's original 10.8 s report matches the after-1.e4 class.
2. **The perf fix did not cause the outage.** `9d68f5ef` only swaps the per-card
   `Corpus.occurrences/1` call for `Corpus.occurrence_counts/1`; run against all
   six benchmark positions including both hot keys it completes with **zero
   errors** (see §7, §12). `occurrence_counts/1` already runs on every query
   twice at HEAD (candidates + reference counts), so the code path is
   exercised today.
3. **What actually takes the site down — three mechanisms, all measured:**
   - **Hot-key evidence queries OOM-kill the 1 GB machine.** At 01:07:46 (this
     investigation), a single after-1.e4 evidence request on live prod was
     followed within a second by machine exit **`exit_code=137, oom_killed=true`**
     (machine event log). Local memory profile of the same query: **744 MB peak
     BEAM total** (processes 952 MB transient, Corpus GenServer heap 109 MB) —
     against a 1 GB cgroup. The same query class the user reported as "10 s"
     kills the machine when it arrives at an unlucky moment (concurrent request,
     post-boot memory state).
   - **Every boot rebuilds the packed anchors: ~1.21 million tiny preads.**
     Local: warm 2.6–4.2 s, cold (page cache evicted) **37.8 s** on NVMe. Prod
     observed: **6.2 min** (23:04:17 → 23:10:31) and **11.6 min** (01:07:48 →
     ~01:19:26) — every deploy restart and every OOM restart is a 6–12-minute
     full outage, and deploys are the only deploy mechanism today
     (`flyctl deploy`, no health checks configured).
   - **Auto-stop + slow boot = dead first request.** With `min_machines_running
     = 0`, an idle machine stops; the next visitor triggers a ~6–12-minute boot,
     and Fly's proxy gives up at 60 s → user-visible hang/timeout. Measured
     tonight: first request after idle → `HTTP 000` at exactly 60.1 s.
4. **So the observed sequence decodes as:** flip deploy (6-min boot) → hot-key
   queries 10 s, occasionally OOM-killing the machine (each OOM = another 6-min
   outage) → the AI deployed its fix (machine restart = 6-min boot, plus any
   residual OOM risk) → user saw "the change made the site unavailable" →
   revert deployed (another 6-min boot) → site up at 23:10, and the queries the
   user retried were moderate positions on a warm machine → "500 ms". The
   revert did not fix anything; the machine finished booting.
5. **Is the ticket still valid? Yes — more severe than reported.** The hot-key
   class does not take 10 s on prod today; it takes tens of seconds and can
   OOM-kill the machine (proven above), and the boot cost converts every
   deploy/OOM into a 6–12-minute outage. "500 ms" is only the warm,
   moderate-position experience (§9).

---

## 1. Executive summary

- **Observed latency**: ~10 s on prod for hot reference keys (reported);
  reproduced locally at 8.9 s (after-1.e4) and 18.5 s (start position) warm,
  and confirmed live on prod where the same query class now OOM-kills the
  machine instead of completing.
- **Primary bottleneck (P0)**: the evidence stage fetches **the full occurrence
  list per candidate card** (`Blunderfest.Corpus.occurrences(cand.key)` in
  `Pipeline.card/8`, pipeline.ex:167). All 12 exact cards share the reference
  key, so a hot key's run is read and **materialized into tuples 13× per query**
  (1 candidate-gen fetch + 12 cards). Cost is linear in the reference key's
  occurrence count: 16.0M tuples decoded for the start position (18 s),
  7.46M for after-1.e4 (8.9 s), ~0.38 µs/tuple for decode+sort, amplified ~3×
  in-query by GC/allocation churn. This is CPU-bound (cold == warm), and it
  also produces the 744 MB peak that OOMs prod.
- **Secondary bottlenecks (P1)**: (a) ~6–12-minute boots —
  `Packed.open`'s anchor build issues 1,212,815 single-record preads (37.8 s
  cold on local NVMe; 6.2 and 11.6 min measured on prod) — an availability
  hazard on every deploy/restart and the direct cause of the outage window's
  length; (b) the packed bucket scan resolves up to 2,000 position headers
  (~18 MB of pos.bin, ~4,000 preads) — latency-bound: +1.2 s cold locally for
  F1, seconds on a cold prod machine; (c) the menu stage's `Families.build`
  CPU over up to 2,000 continuation windows (1.3 s for the Najdorf key).
- **Confidence**: high — direct stage timings, call/byte counts via BEAM
  tracing, memory profiling, a worktree A/B of the reverted fix, prod log and
  machine-event forensics, and a live prod OOM reproduction.
- **Segmentation contribution**: **negligible** — prod runs exactly **one**
  segment; every logical lookup maps to exactly one segment-level call (§5).
- **File-descriptor lifecycle contribution**: **negligible** — 59 open/close
  pairs and up to 72k preads per query, but opens total 3–4 µs and preads are
  page-cache-cheap warm; the cost is the work done on the bytes, not the
  descriptor lifecycle (§6).

## 2. Request flow

```
POST /api/historical-evidence {fen, route, ref_ply}
  → BlunderfestWeb.HistoricalEvidenceController.analyze/2
  → Blunderfest.HistoricalEvidence.analyze/2            (PositionKey.from_fen/1)
  → Blunderfest.Corpus.Search.Pipeline.analyze/2
      stage "candidates"  Candidates.generate/2
          Corpus.occurrences(ref_key)            [packed: FULL run materialized,
                                                   then Enum.take(2000)]
          Corpus.occurrence_counts(ref_key)      [packed: full run re-read]
          Features.pawn_hash → Corpus.pawn_bucket(hash, 2000)
                                                   [packed: bucket run + ≤2000
                                                   pos-header lookups + strings]
          top 30 bucket keys → Corpus.occurrences(key) ×30   [full runs]
      stage "menu"       Corpus.moves_for(≤2000 gids)  [PG]
                         Families.build/2                [CPU]
      Corpus.book(fen)                                  [packed book.bin]
      Corpus.occurrence_counts(ref_key)                 [again — duplicate]
      stage "evidence"   per card (12 exact + ≤10 structural):
                         Corpus.moves(gid)               [PG]
                         Corpus.occurrences(cand.key)     [packed: FULL run,
                                                         re-read + re-decoded
                                                         per card — P0]
                         Corpus.game(gid)                [PG]
                         Differences/Route/Families/Skeleton   [CPU]
  → to_dto/1 → Jason encode
```

Everything through the `Blunderfest.Corpus` facade executes inside the single
`Corpus` GenServer — including the packed reads, the tuple decode and the
`Enum.sort` (they run in `Segment.occurrences/2`, called from `handle_call`).
So one hot-key query pegs the one corpus process for its full 9–18 s and
blocks every other corpus user (book panel, other rooms) meanwhile.

## 3. Timing breakdown (local, warm page cache, HEAD)

Pipeline-reported stages (ms; median of repeated runs):

| Position | ref occurrences | total | candidates | menu | evidence | reductions |
|---|---:|---:|---:|---:|---:|---:|
| start position | 1,169,388 | 17,876–18,590 | ~670 | ~700 | 16,336–16,974 | 282M |
| after-1.e4 | 569,153 | 8,924 | 395 | 295 | 8,159 | 131M |
| Najdorf tabiya | 30,628 | 2,319–2,368 | ~55 | ~1,330 | ~940 | 105M |
| F1 KID tabiya | 1,308 | 790–823 | ~55 | ~390 | ~370 | 34M |
| A2 Ruy decision | 7,655 | 522–548 | ~15 | ~205 | ~310 | 19M |
| cold ply-30 | 1 | 6.7–8.7 | <1 | <1 | ~5 | 67k |

Within the evidence stage (cross-checked by isolated per-call micro-benchmarks):
for after-1.e4, ~12 × 569k-tuple fetch ≈ 12 × ~450–700 ms in-query ≈ 6.5–8 s of
the 8.2 s; per-card PG `moves`+`game` ≈ 0.5 ms each ×22 ≈ 20 ms; the remainder
is differences/route/families CPU. The menu stage is dominated by
`Families.build` CPU (e.g. Najdorf: `moves_for` = 25–50 ms PG, families ≈ 1.3 s).
DTO/JSON serialization is sub-millisecond scale (<0.5 %).

Prod correspondence: the same A2-class query measured 522–548 ms locally and
373–1,356 ms in prod logs after the revert — the user's "500 ms" is this
moderate-position, warm-cache regime.

## 4. Work/count breakdown (per query, HEAD, traced)

| Metric | start | after-1.e4 | najdorf | f1 | a2 | cold |
|---|---:|---:|---:|---:|---:|---:|
| facade `occurrences` calls | 53 | 53 | 53 | 53 | 53 | 22 |
| facade `occurrence_counts` calls | 2 | 2 | 2 | 2 | 2 | 2 |
| `moves_for` / `book` / `pawn_bucket` calls | 1/1/1 | 1/1/1 | 1/1/1 | 1/1/1 | 1/1/1 | 1/1/1 |
| per-card `moves` / `game` calls (PG) | 22/22 | 22/22 | 22/22 | 22/22 | 22/22 | 11/11 |
| segment `pread_fd` calls | 71,988 | 33,764 | 5,140 | 4,157 | 1,382 | 49 |
| file opens/closes | 59 | 59 | 59 | 59 | 59 | 28 |
| bytes read (returned = requested) | 405 MB | 190 MB | 25.9 MB | 19.4 MB | 7.2 MB | 249 KB |
| — of which occ.bin | 385 MB | 181 MB | 11.3 MB | 0.8 MB | 4.4 MB | ~0.3 MB |
| — of which pos.bin | 1.3 MB | 0.6 MB | 13.7 MB | 18.1 MB | 2.6 MB | 0.2 MB |
| occurrence tuples decoded | 16,000,574 | 7,457,147 | 462,866 | 19,911 | 173,413 | 22 |
| exact candidate keys → distinct | 12 → 1 | 12 → 1 | 12 → 1 | 12 → 1 | 12 → 1 | 1 → 1 |
| distinct gids in cards | 20 | 22 | 12 | 22 | 12 | 2 |

Read-amplification pattern for the start position: the reference key's 25.7 MB
occurrence run is read **13×** (405 MB total per query); the bucket scan adds
~2,000 pos-header chunk reads only when the bucket exceeds 200 members.

Per-call micro-benchmarks (isolated, warm): `occurrences(start)` = 439–458 ms
vs `occurrence_counts(start)` = 154–164 ms (difference = decode+sort ≈ 290 ms;
read+walk ≈ 160 ms); `occurrences(a2)` = 1.35 ms; `pawn_bucket(hash, 2000)` =
39–50 ms warm / 910–1,187 ms first-touch-cold; `moves_for(2000 gids)` =
13–55 ms; `moves(gid)` = 0.12–0.7 ms; `game(gid)` = 0.13–0.7 ms; `book(fen)` =
0.07–1.7 ms.

## 5. Segment analysis

- **Production segment count: 1** (manifest: a single `seg-000001` spanning
  gids 1–1,174,661). The corpus is *format*-segmented, not *currently*
  segmented — segmentation exists for build/compaction (ADR-0037), and prod's
  "manifest + 4 segment bins" is 4 files of one segment.
- Every logical lookup maps 1:1 to one segment-level call (trace counts:
  53 facade `occurrences` → 53 `Segment.occurrences`). **No ×N multiplication.**
- Merge cost: `Enum.sort` over the already-sorted single-segment list — part
  of the measured decode/sort cost; no cross-segment merge to separate.
- One latent trap for the future: `Packed.occurrence_counts/2` falls back to a
  **full occurrence-list read** when a key appears in >1 segment (packed.ex:99
  — distinct-gid counting across segments). With one segment the counts path
  stays cheap; with several it re-materializes hot runs for hot keys.
- Scaling conclusion: lookup latency grows with **candidate/occurrence work**,
  not with segment count, at current segment counts (1). Boot anchors grow with
  total records regardless of segmentation (each segment builds its own).

## 6. File I/O analysis

- Lifecycle is exactly `logical lookup → open_raw → N preads → close` per
  occurrence-run query, plus one fd threaded through the bucket scan:
  59 opens + 72k preads (start position) per query. Open/close time traced:
  **3–4 µs total** per query — **negligible**.
- Pread sizes are uniform chunks of `stride × record_bytes` (5.6 KB occ, 11.7 KB
  pos headers); requested == returned bytes in every traced run. Warm preads are
  page-cache hits (~2–5 µs each); the *read* portion of the whole 18.5 s
  start-position query is ~2.9 ms (traced `scan_run` total) — I/O is not the
  bottleneck warm.
- Random vs sequential: occ-run reads are contiguous runs of 22-byte records —
  throughput-bound and cheap even cold (cold start-position query = warm ±0.5 s
  locally). The **bucket scan is the latency-bound part**: ≤2,000
  `find_pos_header` chunk reads + ≤2,000 `read_string` reads scattered across
  pos.bin — 18 MB for F1, +1.2 s cold locally, seconds on a cold prod volume.
- Repeated regions: the reference key's run is re-read up to 13× per query
  (identical byte ranges); the bucket's top-30 keys are re-read once more per
  structural card (30 scan fetches + ≤10 card fetches of the same runs).
- The two live prod requests confirmed the real-volume behavior: after the
  OOM restart, a request during the boot window is refused until the
  endpoint is up; after boot, moderate positions serve in the previously
  observed range.

## 7. Decode / reconstruction analysis

| Operation (per query, HEAD) | Calls | Unique inputs | Duplicate work |
|---|---:|---:|---:|
| facade `occurrences` | 53 | ~31 keys | 12 exact cards re-fetch the **same reference key**; structural keys re-fetched 1–3× |
| tuples decoded (`decode_occurrences`) | 16.0M (start) / 7.46M (e4) | 1.26M / 582k | 12.7× duplication (start) |
| `occurrence_counts(ref_key)` | 2 | 1 | duplicated (candidates + pipeline) |
| `Counts.same_game_only?` | 2 per card | same list | trivial CPU, same pattern |

Per-tuple decode+sort cost ≈ **0.38 µs/tuple** isolated (450 ms / 1.17M), and
~3× that (~1.1 µs/tuple) in-query due to allocation churn in the corpus
GenServer (12 consecutive 28 MB list materializations; peak GenServer heap
109 MB; whole-BEAM peak 744 MB — §0.3). The `Enum.sort` inside
`Segment.occurrences/2` re-sorts already-sorted data 13× per query.

**No game replay/PGN decode is involved** in the evidence path — games are
fetched as SAN lists from PG (`moves`/`moves_for`), and positions come from
packed reads. There is no repeated move replay or FEN reconstruction cost;
"reconstruction" in this pipeline means occurrence-tuple decode, and that is
where the duplication lives.

## 8. N+1 / duplicate work analysis

| Operation | Invocations per query | Unique inputs | Duplicates | Total time |
|---|---:|---:|---:|---:|
| `Corpus.occurrences(cand.key)` (card stage) | 22 | 11 | 11 (12→1 on the exact key) | ~8.2 s of 8.2 s evidence stage (e4) |
| `Corpus.occurrences(ref_key)` (candidates) | 1 | 1 | +1 (cards re-fetch it 12×) | (same row as above) |
| `Corpus.occurrence_counts(ref_key)` | 2 | 1 | 1 | 0.3 s (start key) |
| `Corpus.moves(gid)` / `Corpus.game(gid)` | 22 / 22 | ≤20 | ~2 | ~20 ms (PG round trips, unbatched) |
| `Corpus.occurrences(bucket key)` | 30 (scan) + ≤10 (cards) | ≤30 | ≤10 | small keys: ms-scale |

The dominant N+1 is the **per-card occurrence fetch**: the card only needs
`{occurrences, games, same_game_only}` — derivable from one aggregate — yet it
pays a full run read + full tuple materialization + sort, and it does so once
per card even when 12 cards share the identical key. This is precisely what
reverted commit `9d68f5ef` addressed (A/B in §12).

## 9. Cold vs warm behavior

Same query, page cache evicted (`posix_fadvise(DONTNEED)`) between runs:

| Position | warm | cold (local NVMe) |
|---|---:|---:|
| start | 17.9–18.5 s | 18.5–18.9 s (**CPU-bound; cache-irrelevant**) |
| after-1.e4 | 8.9 s | (same class; CPU-bound) |
| najdorf | 2.3 s | 3.2–3.4 s |
| f1 | 0.8 s | 2.0–2.6 s (candidates stage 1.25–1.78 s — bucket scan) |
| a2 | 0.52 s | 0.73–0.80 s |
| cold ply-30 | 7 ms | 15–24 ms |
| **boot (`Packed.open`)** | 2.6–4.2 s | **37.8 s** local / **6.2–11.6 min** prod |

Interpretation: first-touch cost on prod (fresh machine/deploy) adds seconds to
moderate queries via the bucket scan and (for hot keys) via big sequential
reads, but the 10 s headline is **not** cache-dependent — it is CPU + allocation
and repeats identically on a warm machine. This explains why the AI's "identical
with the page cache dropped" observation held for the fixed pipeline, and why
the incident's 10 s persisted across repeated queries at 22:07–22:29.

## 10. Production vs local

- Moderate positions: local 0.52 s (a2) vs prod logs 0.37–1.36 s — consistent
  (shared vCPU, network volume).
- Hot keys: local 8.9–18.5 s (completed) vs prod — **request-correlated
  OOM-kill of the 1 GB machine** (exit 137, 01:07:46 event) and 60 s proxy
  timeout behavior. Prod cannot complete the class of query that produced the
  ticket; it either takes tens of seconds (when memory permits) or dies.
- Prod PG (`corpus_games`/`corpus_moves`, COPY-loaded the same evening) was
  warm from the load; local PG likewise warm. `moves_for(2000)` is 13–55 ms
  in both — PG is not a bottleneck in this pipeline.
- The 1 GB / 1 shared vCPU machine is the binding constraint for *memory*
  (OOM) but not for the CPU time itself: the decode cost is intrinsic
  (282M reductions on any hardware).

## 11. Complexity / scaling

Runtime for a Find-Examples query = fixed overhead + **linear in
`exact_limit × (reference-key occurrence count)`** (measured: start position,
exact_limit 1/4/12 → evidence stage 2.27 / 6.21 / 16.9 s; per-tuple 0.38 µs
isolated, ~1.1 µs in-query) + linear in bucket-limit for cold cache
(warm: insensitive below the cap; the cap bounds cold cost) + linear in
`min(2000, ref occurrences)` for the menu stage (families CPU, measured
~0.65 ms/window).

Projecting to the stated goal (**10M+ games**, ~10× this corpus), with today's
code:

- Hot keys scale with corpus size: start-position key → ~10M occurrences →
  per-card fetch ~3.8–4 s isolated, ~11 s in-query ×12 cards ≈ **~2 minutes
  per query**; after-1.e4 ≈ ~20–60 s. Even the reverted fix
  (`occurrence_counts` per card) → 13 × (read ~220 MB + walk 10M records)
  ≈ **20–30 s/query** plus ~2.9 GB of reads per query — still unacceptable.
- Boot: anchors grow linearly with records (1.21M preads at 1.17M games →
  ~10–12M preads at 10M) → **~1 hour boots** on prod's hardware.
- Bucket caps (2000) and occurrence caps (2000/12/30/10) keep candidate
  *counts* bounded, so the scaling danger is concentrated in (a) run-length
  work for hot keys and (b) boot.

The packed format itself is sound for scale (binary-search anchors + bounded
chunk scans); the pipeline's *use* of it for per-card full-run fetches is what
does not scale.

## 12. Root causes (ranked)

**P0 — per-card full occurrence-list fetch for hot reference keys**
(`Pipeline.card/8` → `Corpus.occurrences/1`, pipeline.ex:167).
Evidence: 13 reads+materializations of the same run per query (traced);
16.0M tuples/query (start); evidence stage = 91 % of an 18.5 s query;
linear in occurrence count and exact_limit; identical cold/warm (CPU-bound);
744 MB peak → prod OOM (exit 137 measured); 282M reductions. Confidence: high.
Note: this is the same code the previous AI's reverted commit fixed — the fix
was directionally correct for the real root cause, though its commit message
misdiagnosed the arithmetic ("~900-occurrence key × ~20 cards" — a 900-run
costs ~1 ms/card and cannot produce seconds; the observed numbers require the
hot-key class, which its `occurrence_counts` change indeed addressed:
4.6× on the start key, 4.9× on after-1.e4, identical result data, no errors).

**P1 — boot cost: anchor rebuild as 1.21M single-record preads**
(`Segment.build_anchors/5`, segment.ex:566; called from `Packed.open` at every
`Corpus.init`).
Evidence: 1,212,815 preads (computed = empirically traced); 37.8 s cold local;
6.2 and 11.6 min observed on prod; every deploy/OOM restart = full outage;
auto-stop + 60 s proxy deadline = dead first request after idle. Confidence: high.

**P2 — latency-bound bucket scan on cold cache** (≤2,000 pos-header lookups ≈
18 MB pos.bin + ~4k preads): +1.2 s cold locally for F1, worse on prod's
volume; only the first query after boot pays it. Confidence: high (measured),
impact: secondary.

**P2 — menu-stage families CPU** (Families.build over ≤2,000 windows ≈
1.3 s on the Najdorf key warm): bounded but material for moderately-hot keys.
Confidence: high (stage isolation: `moves_for` = 25–50 ms, rest is families).

**P2 — GenServer serialization of all corpus work** (ADR-0026 seam): one
hot-key query blocks all corpus traffic for its duration; two concurrent
hot-key queries are the plausible OOM trigger (measured single-query peak
744 MB vs 1 GB cgroup). Confidence: high on the mechanism, medium on the
concurrency multiplicity in the specific incident.

**Not significant** (investigated, ruled out):
segmentation (1 segment — no multiplication); file-descriptor lifecycle
(59 opens, 3–4 µs total); index correctness/complexity (binary search + bounded
scans behave as designed — the cost is run length, not lookup inefficiency);
PG game/moves queries (13–55 ms batched; 22+22 unbatched per-card round trips
are ~20 ms total); DTO/JSON serialization (<0.5 %); read/write I/O on warm
cache (2.9 ms of an 18.5 s query).

## 13. Recommended fixes (ranked; NOT implemented per ticket rules)

| # | Fix | Evidence | Expected impact | Complexity | Risk | Semantics |
|---|---|---|---|---|---|---|
| 1 | **Card counts without the list**: use `occurrence_counts(cand.key)` (the reverted `9d68f5ef`, verified safe in a worktree) **plus per-query memoization** so each distinct key is counted once | 12→1 fetches on the hot key; 4.6–4.9× measured on hot keys; memoization removes the remaining 13 duplicate count reads | start: 18.5→~0.7 s; e4: 8.9→~0.3 s; memory peak ~744→~50 MB (no 12× list churn) → **removes the prod OOM** | low (14-line diff exists) | low — `same_game_only` is exactly `occurrences>1 and games==1`, pinned by existing test | none |
| 2 | **Fix the boot**: bulk-read anchors (one chunked read per stride block ≈ 1/256 of the syscalls) or persist the anchor binary next to the segment files at pack time | 1,212,815 preads measured; 37.8 s cold local; 6.2–11.6 min prod boots | boot 6–12 min → ~10–30 s (or <1 s with persisted anchors); ends the deploy/OOM/auto-start outage class | medium | low — anchors are derived data, verifiable at open | none |
| 3 | **Add health checks + keep-one-machine-warm** (`[[checks]]`, `min_machines_running = 1`) once boot is fixed | 60 s proxy timeout measured on idle auto-start; "site unavailable" during every boot | deploys and OOM restarts stop being silent full outages | low (config) | low | none |
| 4 | Reduce duplicate `occurrence_counts(ref_key)` (candidates + pipeline call it twice) and dedupe per-card `moves`/`game` gid fetches via one batched `moves_for`-style query | traced 2× identical count calls; 44 unbatched PG round trips (~20 ms — cosmetic) | small (ms) | low | low | none |
| 5 | If caching is ever added, the only cache justified by these measurements is **request-scoped memoization of per-key occurrence counts** (key: canonical position key; value: `%{occurrences, games}`; scope: one pipeline run; lifecycle: request; hit rate: 12/13 on hot keys) — it removes measured duplicate work without hiding anything cross-request | trace counts in §4/§8 | included in #1 | low | low | none |

Not recommended by evidence: persistent file descriptors (opens are µs),
broad cross-request caching, parallelization (the pipeline is sequential
CPU-bound; concurrency would raise OOM risk), or format redesign (the packed
format's lookup mechanics measured fine — the pipeline's per-card usage is the
problem; the one format-level candidate is a precomputed occurrence-count
field in the pos header, which would make #1 a single 46-byte read, worth
considering at the 10M-games re-pack).

## 14. Verification benchmark

Reusable before/after suite (the harness from this investigation:
`/tmp/opencode/evidence_bench.exs`, run with
`mix run --no-start /tmp/opencode/evidence_bench.exs warm|cold|micro|scaling`;
copy into the repo's `tmp/` if wanted — no app code touched):

- Positions: start position; after-1.e4; Najdorf tabiya; F1 KID tabiya; A2
  Ruy decision; a mid-corpus ply-30 cold position (gid 699002 route).
- For each: 3 warm runs + 1 cold run (page cache evicted via
  `posix_fadvise`), recording total/candidates/menu/evidence stage times,
  reductions, and (traced) occurrences calls, preads, bytes, tuples decoded.
- Boot: `Packed.open` warm + cold, pread count.
- Record per query: exact/structural candidate counts, ref occurrence and
  game counts, distinct card keys/gids.

Proposed targets (labeled proposed — no existing product target found):

```
warm  p50 < 500 ms, p95 < 2 s   across all six positions at 1.17M games
cold  p50 < 1 s,  p95 < 4 s
boot  < 60 s (local NVMe cold); prod deploy-to-serving < 90 s
mem   peak BEAM total < 300 MB on any single query (no OOM at 1 GB with 3 concurrent)
scal  hot-key query cost independent of reference-key occurrence count (bounded read)
```

Success check for #1 specifically: start-position query ≤ 1 s warm **and** cold,
`records_decoded` ≤ ~1.3M/query (vs 16.0M), `bytes read` ≤ ~40 MB/query (vs
405 MB), and no machine OOM under 3 concurrent hot queries.

## 15. Instrumentation changes

Temporary diagnostics (all outside the repo, in `/tmp/opencode/`, deleted with
the session or safe to delete):

- `evidence_bench.exs` — request-path harness with BEAM call/return tracing
  (facade + segment layers), stage timings, cold-cache eviction runs,
  micro-benchmarks, cap-sensitivity sweeps, and the HEAD-vs-fix A/B mode.
- `evict.c` — `posix_fadvise(POSIX_FADV_DONTNEED)` page-cache evictor (no root
  needed).
- `probe*.exs`, `mem_profile.exs` — trace-message shape probes and a 50 ms
  memory sampler during hot-key queries.
- One git worktree at `9d68f5ef` for the A/B (removed after use).

Notable tooling findings for future instrumentation: on this OTP (28), the
match-spec action must be `{:return_trace}` (the bare atom `:return_trace`
validates silently and never fires), and call trace messages carry the
argument list in the arity slot.

Long-term telemetry candidates (none added): the pipeline already returns
`timings` on every response — log them server-side with the reference key's
occurrence count and candidate counts (one line per request); emit a boot log
line from `Corpus.init` with `Packed.open` duration and pread count; a
corpus-GenServer mailbox/queue-length metric would have surfaced the
serialization stalls directly.

---

## Appendix A — the reverted fix, examined (Phase Q)

`9d68f5ef` ("historical-evidence cards use occurrence_counts, not the
occurrence list"), same corpus, warm:

| Position | HEAD wall | fix wall | tuples decoded (HEAD → fix) | bytes read |
|---|---:|---:|---|---|
| start | 18,188 ms | 3,937 ms | 16.0M → 1.26M | 405 MB → 405 MB (identical) |
| after-1-e4 | 8,924 ms | 1,804 ms | 7.46M → 0.58M | 190 MB → 190 MB |
| najdorf | 2,319 ms | 2,063 ms | 0.46M → 0.05M | 25.9 MB |
| f1 | 885 ms | 797 ms | 20k → 4k | 19.4 MB |
| a2 | 601 ms | 438 ms | 173k → 23k | 7.2 MB |
| cold | 7 ms | 7 ms | 22 → 11 | 249 KB |

- **No errors on any position**, including both OOM-class hot keys; the
  `same_game_only` result is identical by construction
  (`occurrences>1 and games==1`) and pinned by the existing test.
- It removes the decode/sort/allocation (the P0 CPU cost and the OOM fuel)
  but **not** the repeated reads (bytes identical: `occurrence_counts` walks
  the same run binary) — per-query memoization of counts per distinct key
  (fix #1) is the complete version.
- Its commit message's diagnosis ("~900-occurrence hot key × ~20 cards →
  ~10× re-read") does not match the measurements (a 900-record run costs
  ~1 ms/card; the seconds-long queries require 10⁴–10⁶-occurrence reference
  keys), but the fix's *actual effect* lands on the real class.
- The claimed prod numbers (10.8 s → 1.3 s, cache-drop-invariant) are
  consistent with my measurements (8.9 s → 1.8 s locally for after-1.e4,
  CPU-bound so cache-invariant).

## Appendix B — incident-window prod evidence

- Fly releases: v496/497 ~22:06 (flip), v498/499 ~22:29 (fix deploy),
  v500/501 ~23:04 (revert deploy). Incident-window app logs have rolled out of
  Fly's log buffer (earliest retained line 21:09:41Z), so the exact first
  minutes of the fix deploy are not recoverable; machine events and the
  revert boot are.
- Machine `2874763ead9608` (ams): created 20:07:22Z (flip deploy);
  OOM-killed 22:47:46.834Z+1h... (event: `exit_code=137, oom_killed=true` at
  01:07:46 local, request-correlated — see §0); restart boots:
  23:04:17→23:10:31 (6.2 min) and 01:07:48→~01:19:26 (11.6 min).
- Post-revert evidence-request latencies (prod logs 21:12–21:17Z): 10 ms,
  952 ms, 373 ms, 508 ms, 1,356 ms, 1,344 ms — the "500 ms" regime.
- Live check during this investigation: after-1.e4 evidence request →
  machine OOM-kill within ~1 s of arrival (HTTP 502); next request during
  the reboot window → HTTP 502; healthz only recovers when the boot
  completes. The user-facing incident ("site unavailable after the change")
  is this loop, not the code change.
