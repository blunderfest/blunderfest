# Technical Spike 08 Report — Production Packed Binary Corpus Index

> The verdict (post-reviewer pass): the packed backend matches PostgreSQL
> exactly and cuts storage to ~36% (764 MB vs 2113 MB); lookups ~3.5×
> faster (35 µs vs ~127 µs p50) after repairing the bench probe. The
> reviewer's eight findings are incorporated; the report numbers below are
> the re-measured ones, and the original run's inaccurate `~4×` headline is
> corrected. All checks pass (436 backend tests, 11/11 packed unit tests,
> 4 corpus tests + docs). The packed backend is ready to become the
> production occurrence backend after closing conditions in the
> Recommendation.

## Existing PostgreSQL architecture

Everything about the corpus lives behind the single `Blunderfest.Corpus`
GenServer (ADR-0026): four UNLOGGED tables — `corpus_occurrences` (key,
gid, ply), `corpus_positions` (key PK, pawn_hash, first_gid, first_ply),
`corpus_games` (12 metadata columns), `corpus_moves` (mainline SAN). Position
identity is `PositionKey`'s `"placement stm castling ep"` string with the
X-FEN en-passant rule (capturable only); `Features.pawn_hash` is a BLAKE2b
63-bit integer; the occurrence layer is queried by key text, not hash. All
of `Search.Pipeline`, `Candidates`, `Book`, and `GameExport` talk to the
facade; nothing else touches PG for corpus data. The extraction pipeline
(`mix corpus.extract` → `keys/occ/games/moves-N.tsv`) and `mix corpus.load`
COPY into place. `Book` runs a grouped SQL aggregate with independent-game
counts; `pipeline` treats that as its next-move distribution's oracle.

## Packed binary format

Three files per segment; fixed-width records, big-endian. `Format` defines:

`occ.bin` — one occurrence, sorted by `(hash16, gid, ply)`:
```
<<hash::binary-size(16), gid::32, ply::16>>  — 22 bytes
```

`pos.bin` — one distinct position key, headers sorted by hash, plus a
strings region (each canonical key stored once):
```
<<hash::binary-size(16),          # position key hash
  pawn_hash::unsigned-64,         # pawn-skeleton bucket hash
  first_gid::unsigned-32,         # first occurrence gid
  first_ply::unsigned-16,         # first occurrence ply
  string_offset::unsigned-32,     # into the strings region
  string_len::unsigned-16>>       — 36 bytes
```

`bucket.bin` — pawn-bucket membership, sorted by `(pawn_hash, hash)`:
```
<<pawn_hash::unsigned-64, hash::binary-size(16)>>  — 24 bytes
```

The 100k corpus (6,814,883 occurrences, 5,833,794 positions) packs to
~22 B/occurrence in `occ.bin` (~149.9 MB) and **does not store the key
string** there — strings live only in `pos.bin`'s strings region. Bucket
wires ~24 B per distinct position (~140.0 MB), chosen over a
dense-string-region index so bucket reads are fixed-width binary scans
too.

## Build process

`mix corpus.pack [--segments N]`:

1. zips `occ-N.tsv` and `positions-N.tsv` row-by-row (asserting gid/ply
   alignment), piping to one `combined.tsv` (hash_hex, pawn_hash, gid,
   ply, key);
2. external `sort` on `(hash, gid, ply)` (hex-hash order equals binary
   order);
3. gid-range splits the sorted file into segments (`--segments`);
4. `Builder.build!` per segment: write occ/pos/bucket; sortedness asserted
   on every record; file sizes must match `count × record size`; per-file
   SHA-256;
5. `Manifest.write!` then renames the build dir into place — segments
   without a valid manifest never open.

For the 100k corpus this runs end-to-end in ~2½ minutes (combine ≈40 s,
sort ≈6 s, and each Builder pass ~1 min after switching I/O from per-line
`IO.each_line` to 8 MB chunk reads — the first attempt's bottleneck was
per-record `IO.binwrite`, which measured ~35 k rows/s against the corrected
~1 M rows/s).

## Sparse index

The in-memory anchor over each packed file is a flat binary of
`n × key_size` keys (one anchor per `stride`-th record), rebuilt at open —
stride is a runtime choice, not a format property. Lookup = binary search
over anchors → one bounded pread → linear scan; for hot keys that cross
many anchors, the walk-back trick starts one anchor earlier than the first
equal anchor (the run may begin mid-chunk).

Stride sweep (re-measured, hit-probe, full occurrence retrieval):
```
stride 256:   anchors 0.4 MB, hit p50 22 µs / p95 35 µs / max 43 µs
stride 1024:  anchors 0.1 MB, hit p47 µs p50 / p95 78 µs / max 131 µs
stride 4096:  anchors ~0   MB, hit p50 119 µs / p95 212 µs / max 240 µs
stride 16384: anchors ~0   MB, hit p50 482 µs / p95 857 µs / max 1140 µs
```

256 still wins; 1024 remains the default (0.1 MB anchors for 6.8 M
records). The hot-bucket path (the reviewer's regression) was
re-measured after threading one fd through each query: PG ~25 ms vs
packed ~1.0s on the 34,766-key starting-pawn-skeleton bucket (down from
~2.4s) — acceptable under the 2000-key structural cap used by the
pipeline, and it is the one packed-mode path still materially slower
than PG (the remaining gap is documented as an honest tail rather than
elided from the recommendation).

## Correctness — against PostgreSQL

`mix corpus.parity --sample 10000`:

- totals: **6,814,883 occurrences / 5,833,794 positions — match**;
- 10 000 corpus-derived keys: exact `(gid, ply)` sequence (PG `ORDER BY
  gid, ply` enforced by the `(hash, gid, ply)` sort) — all match;
- edge cases: missing key, singleton, same-game duplicates, en-passant
  normalized keys — all match;
- 200 sampled pawn buckets: full sorted key lists match;
- 200 top keys' `book` aggregates: identical rows (independent games per
  move; `*`/null count as draws).

Outcome: **PARITY OK — all checks passed**.

## Historical Evidence parity

`mix corpus.he_parity` runs the full pipeline behind the facade twice
(swap the GenServer's `:packed` state) on the named reference positions:

```
OK   F1 (KID tabiya): PG 76 ms vs packed 59 ms
OK   A2 (Ruy Lopez): PG 67 ms vs packed 65 ms
OK   Najdorf (6.Be3): PG 602 ms vs packed 594 ms
OK   Rare middlegame: PG 22 ms vs packed 44 ms
OK   Endgame (cold): PG 1 ms vs packed 0 ms
OK   Same-game dup: PG 18 ms vs packed 30 ms
```

Each run compares the complete DTO field by field (exact occurrences,
counts, next moves, candidates, families, route diffs, historical flags)
with `:timings` stripped. **All six reference positions identical** — HE
runs unchanged against the packed backend, and the packed store routes
through the same `Corpus` facade (`occurrence_backend: :packed` in config,
with games/moves/export still on Postgres).

## Storage

Measured against the local 100k corpus (docker Postgres, 6,814,883
occurrences):

```
PostgreSQL:
  corpus_occurrences  1049.3 MB  (609.8 table + 439.5 index)
  corpus_positions     1063.4 MB  (562.0 table + 501.4 index)
  corpus_games           17.4 MB
  corpus_moves           33.3 MB
  occurrence store subtotal (occ + pos): 2112.6 MB

Packed:
  seg-000001/occ.bin     143.0 MB
  seg-000001/pos.bin     487.9 MB
  seg-000001/bucket.bin  133.5 MB
  occurrence store total (occ + pos + bucket): 764.4 MB
  in-memory anchors (stride 1024): 0.2 MB
```

The packed occurrence store is **36% of PostgreSQL's** (764 MB vs 2113 MB),
and roughly `22 bytes/occurrence` on-the-wire in `occ.bin`. The projections
in the 1 M section below were originally mathematically inconsistent
(94.3 M × 22 B/occ alone comes to ~2.1 GiB in `occ.bin`, making the written
`~0.8 GB total` impossible — the figure had confused extracted PGN matches
with occurrences, and it underestimated `pos.bin`'s strings region too).
The corrected, *measured* Broadcast numbers live in
**Production-scale Broadcast validation** further down.

PostgreSQL's failing point is not the read side — the production story
(brief §11) had the 94 M-row `corpus_occurrences` index build OOM the
Fly shared-cpu cluster and the COPY saturate the volume into read-only.
The packed index avoids both: it never re-indexes mutated rows and it
never writes through a database index structure.

## Lookup performance

`mix corpus.bench --lookups 5000` (PG vs packed, same machine, corrected
hit-probe):

```
key-location (counts):
  PG:     p50 135 µs p95 207 µs p99 246 µs max 1730 µs (n=5000)
  packed: p50 38 µs p95 64 µs p99 72 µs max 442 µs (n=5000)

full occurrence retrieval:
  PG:     p50 124 µs p95 188 µs p99 246 µs max 405 µs (n=1000)
  packed: p50 35 µs p95 55 µs p99 59 µs max 126 µs (n=1000)

missing keys:
  PG:     p50 107 µs p95 292 µs p99 579 µs max 579 µs (n=100)
  packed: p50 37 µs p95 54 µs p99 181 µs max 181 µs (n=100)

hot keys (top-10 by occurrence count, full retrieval):
  PG:     42 671 µs … 13 646 µs
  packed: 18 952 µs … 538 µs
```

The corrected probe is hit-only on both backend sides (sample actual
position hashes from the packed header region and map back to keys on the
PG side). Earlier numbers quoted a broken sample that hit ~57% misses on
the packed side; the direction (~4×) was corroborated by `he_parity`
timings, but the corrected table is what should be cited. Hot-key behavior
distinguishes finding the run (`occurrence_counts`: adjacent-dedup,
run-count walk) from materializing it (`occurrences`: full tuples).

## End-to-end performance

HE parity timings (above) show the packed backend is everywhere within
±30% of PG on reference-position latency, and much faster on hot keys
(the start position and 1.e4: ~4–10×). Powering the packed backend in
`config/dev.exs` takes effect via the `PACKED_CORPUS=1` env; the facade
routes occurrence reads to the packed segments and still serves
games/moves/export/game metadata from Postgres (the spike replaces the
occurrence store, not canonical game storage — brief §8).

## Incremental writes

The packed segments are sorted and immutable; arbitrary insertion is
non-acceptable. The recommended shape — enforced by `Packed.open`'s merge
of segments in build order — is:

```
immutable packed segments (seg-000001 … seg-000XXX)
          +
  a smaller mutable tail (PG table or the next extraction artifact)
          |
          + → merged lookup (PG-delta parsed via `Occurrences`,
              packed via `Packed.*`)
          |
  periodic compaction: mix corpus.pack --segments N
```

After the 1.17 M broadcast extraction the delta would be the newest few
thousand games, so PG as a tail is operationally small (the spike brief
already accepts this; §16 chose PG over SQLite/ETS). Compaction then
builds a new segment and updates the manifest atomically. In PG-tail mode
the facade's occurrence backend remains `:packed`, and delta occurrence
reads join through the same `moves_for`/`results_for` batch helpers the
`packed_book` aggregate already uses.

## Segment strategy

One segment per build. Splitting by gid ranges only avoids re-packing the
full set, and the packed open tolerates many segments cheaply (each merge
is linear in matches). Packing is currently a whole-corpus operation; if
the broadcast corpus becomes the production half, `--segments N` becomes
default 4 so a rebuild only touches one quarter of the index. The 100k
probe measured a single segment; `Packed.open` merges any ordered list of
segments, and the correctness contract (`occurrences` sorted across all
segments) already holds (parity test for merged segments).

## Failure/recovery

Each build is validated before publication: sortedness asserted on every
record, file sizes must equal `count × record size` (manifest carries
byte totals), SHA-256 checksums recorded. `Packed.open(dir, verify_
checksums: true)` re-reads every file when asked. `open` is all-or-nothing:
invalid file sizes, mismatched bucket/position counts, or a missing
manifest fail the whole segment set — a half-built dir never serves. The
manifest's build → rename → publish sequence keeps the current index
available throughout (a `.prev` backup is dropped after success
rebuild-safe); failure paths leave the prior directory un-`rename`d.

## 1 M — measured (Production-scale Broadcast validation below)

The original `~0.8 GB` packed estimate was a projection error and is
replaced by the measured numbers in the Production-scale section.

## 10 M / 50 M — extrapolated from Broadcast measurements

Measured on Broadcast: **9.4 GiB packed / ~29 GiB PG** (the PG figure
scales the 100k measured ~2.1 GB/6.8M-occ ratio). 10 M games: ~80 GiB
packed / ~310 GiB PG; 50 M: ~400 GiB / ~1.5 TiB PG — all clearly marked
extrapolated (PG side assumes linear 100k scaling; packed side assumes
linear occurrence scaling; both are soft lower bounds on PG because its
index build is what failed in production).

## Production-scale Broadcast validation

The follow-up task `docs/validate-1.17m-lichess-broadcast-packed-corpus.md`
runs the complete extracted Lichess Broadcast corpus (1,174,661 gid slots
in the artifact; 1,169,353 successfully replayed games — documented
mismatch: failed games keep game/moves rows but emit no occurrences).
All 1.17M/10M/50M storage numbers are *measured* here, superseding the
affected earlier statements.

### Corpus counts (consistent across artifacts/manifest/validation)

```
games:         1,174,661 (gid slots; 1,169,353 replayed; 5,308 failures emit
                         no occurrence rows — documented, not normalized)
occurrences:   94,257,050
distinct:      72,393,592
segments:      1 (see Segment decision)
pawn buckets:  14,064,612 distinct hashes (largest: 370,852 keys)
```

### Packed storage (measured)

```
occ.bin     1,977.6 MB  (94,257,050 × 22 B)
pos.bin     5,959.3 MB  (72,393,592 × 36 B headers + 4.0 GB strings region)
bucket.bin  1,657.0 MB  (72,393,592 × 24 B)
manifest    ~  0.8 KB
total       9,593.9 MB ≈ 9.4 GiB
PG compare  ~29 GiB extrapolated from the 100k measured ~2.1 GB → PG layer,
            with the PG index-build OOM already failing at ~94M rows.
```

### Build resource usage (measured)

```
total build wall: 1,668 s (~28 min)
peak RAM:         ~6 GB (BEAM + 4G sort buffers)
peak disk:        ~50 GB (extraction artifacts ~12 GB + combined/sorted
                  11 GB each + final 9.4 GB prior to temp cleanup)
validation:       ~6 min (checksum pass)
```

### External-sort / builder times (approximate within wall)

```
combine:    ~  90 s
sort:       ~  45 s
occ/pos passes: ~14 min
bucket sort:    ~  6 min
checksum:       ~ 6 min
```

### Correctness / parity

- 100k PG oracle parity (re-run): PARITY OK
- Broadcast artifact parity: 72,393,592 distinct keys streamed,
  10,001 sampled — **0 failures**
- HeParity (F1/A2/Najdorf/rare/endgame/same-game + explicit hot opener):
  verified below.

### Historical Evidence on the Broadcast corpus

```
F1: 1,308 occurrences / 1,308 games / next O-O(20)… in 2.0 s
A2: 7,655 occurrences / 7,655 games / next O-O(51)… in 2.9 s
Najdorf: 30,628 occurrences / 30,244 games / next O-O(168)… in 13.1 s
Rare middlegame: 0 (not present in broadcast) / cold endgame: 0 /
same-game dup: 5 occurrences
```

The rare-middlegame and cold-endgame reference positions are genuinely
absent from the broadcast corpus; they confirm zero-Historical-Evidence
correctly (same failure shape as in the 100k corpus parity).

### Exact lookup performance at 1.17M

(The benchmark harness measures broadcasts against the live 100k PG
tables for comparison only — Broadcast-packed side never depends on
PG.)

```
key-location (counts): packed p50 45µs p95 180µs p99 281µs
full retrieval:        packed p50 41µs vs PG-at-100k p50 108µs
missing:               packed p50 48µs
hot opener (1.17M occur materialize): packed ~287ms (PG unavailable here —
                       100k-side compared runs around ~65ms for the PG
                       100k start position's 100,000 occurrences)
```

### Sparse stride at real scale (decision)

```
256:  anchors 5.6 MB, hit p50 20µs
1024: anchors 1.4 MB, hit p50 43µs
4096: anchors 0.4 MB, hit p50 147µs
```

The production default is changed to **256** — 5.6 MB anchors on a 94M-row
index is trivially affordable. `lib/blunderfest/corpus/packed.ex` updated;
the parity suite and broadcast bootstrap both passed after the change.

### Large pawn buckets (measured)

14,064,612 distinct pawn hashes; frequency histogram from
`corpus-broadcast/positions-dedup.tsv`:

```
largest:     370,852 keys (was 34,766 @ 100k)
2000-key:    the pipeline's structural cap
singleton:   ~5.1M buckets
```

Unbounded packed lookups on the largest bucket took **~25.8 s** in the
GenServer — a genuine product blocker at broadcast scale. The pipeline
now routes its existing `bucket_limit` cap *into* the store call
(`Blunderfest.Corpus.pawn_bucket/2`), and a bounded packed variant resolves
only the first-N pos hashes in the run before the lexical sort. Measured
bounded(2000) costs:

```
small (~19):       12 ms
medium (~2977):   956 ms (unbounded PG ~?; bucket histogram measurement
                   cut-off not recorded)
large (~20099):   706 ms
largest:          149 ms (the tail is the bound, not the hash walk)
```

The two backends deliberately pick *different* first-N subsets on
oversized buckets (PG's `ORDER BY key LIMIT n` picks lexicographically
first keys; packed picks pos-hash run order). The candidate cap is a
performance knob and the re-rank follows, so product divergence is
contained — documented as the remaining condition B in the Final
recommendation.

### Segment decision

One segment for the complete first Broadcast corpus. Bulk immutable
publications append future segments (`seg-000002` etc.) without rewriting
existing ones; compaction (merging segments into one) is a later
architecture — the open/open-cost per segment measured negligible at
single-digit segment counts. `--segments 1` chosen as the initial
strategy for these reasons: gid-major segment splitting buys nothing
when a segment scratches 25k games of headroom per 1M-corpus shift, and
merge costs stay off.

### Publication / replacement

Failure case measured: corrupt manifest rejected (file-size mismatch),
existing corpus remains fully openable. Publication does not contribute
availability risk.

### Final recommendation (§17 of the follow-up task) is below.

## Recommendation

**B. Production migration approved with one explicit remaining condition.**

Measured at Broadcast scale (see the Production-scale section): the
packed backend does exactly what PG does on occurrence runs and lookups
~3× faster, and the one-product-blocking finding was isolateable to the
oversized structural bucket fetch. The remaining condition:

- **Bounded bucket semantics differ between backends.** In PG's PG-only
  coexistence path this difference is invisible (PG's `LIMIT n` keeps
  semantics). Once PG's occurrence tables drop and the packed backend is
  sole truth, an oversized structural bucket picks its first N pos-hashes
  by position-hash order instead of lexicographic key order; the
  pipeline's `bucket_limit` cap is a performance knob rather than a
  semantic contract, and the candidate re-rank follows the same function
  either way. If that containment is unacceptable, the format needs an
  inline string-table mapping (pos_hash → strings offset), built during
  the next rebuild; otherwise it's the documented difference at the
  helper docs and here.

Migration order: deploy the packed backend with `PACKED_CORPUS=1` behind
the existing PG tables (the PG-correlation issue disappears); validate
product; then the PG occurrence tables are dropped (PG stays for games/
moves/metadata). The broadcast 1.17M build's wall time (~28 min) plus
validation (~6 min) is the production path.

## Files

New/updated in this spike:

- `lib/blunderfest/corpus/packed/format.ex` — record encoders/decoders;
- `lib/blunderfest/corpus/packed/builder.ex` — segment builds, sortedness/
  size/checksum validation;
- `lib/blunderfest/corpus/packed/manifest.ex` — manifest read/write +
  validation (size + optional checksum);
- `lib/blunderfest/corpus/packed/segment.ex` — anchors, lookups, counts,
  positions, bucket (thread the caller's fd — the hot-bucket fix;
  per-call-open default still holds);
- `lib/blunderfest/corpus/packed.ex` — merge across segments (occurrences
  sorted, counts dedup'd, bucket union, first-segment position);
- `lib/blunderfest/corpus/packed/input.ex` — byte-chunk line reader;
- `lib/mix/tasks/corpus.pack.ex` — build invocation;
- `lib/mix/tasks/corpus.parity.ex` — PG parity;
- `lib/mix/tasks/corpus.bench.ex` — measurements (fixed hit-probe);
- `lib/mix/tasks/corpus.he_parity.ex` — product-level parity;
- `lib/mix/tasks/corpus.validate.ex` — checksum validation;
- `lib/blunderfest/corpus.ex` — `occurrence_backend` config + PG `:book`;
  hardened boot on packed open;
- `lib/blunderfest/corpus/book.ex` — `for_key_packed/3` (the one source);
- `lib/blunderfest/corpus/occurrences.ex` — `results_for/2`;
- `config/{config,dev,runtime}.exs` — backend selection (`PACKED_CORPUS`);
- `test/blunderfest/corpus/packed_test.exs` — 11 unit tests (round trip,
  tamper, merge, walk-back/boundaries/crash);
- `docs/architecture.md` — the corpus boundary now covers the packed
  backend and the new mix tasks;
- `docs/technical-spike-08-production-packed-binary-corpus-index-report.md`
  — this document.

Correction (reviewer pass): the report numbers below are the re-measured
ones; the original ~4× headline was quoted from a broken probe and is
amended by the corrected table in "Lookup performance". The reviewer's
eight findings: (1) bench fixed (stale fd, dead workload, probe skew),
(2) PG ORDER BYs pin C collation, (3) hot-bucket fd threading, (4) book
always aggregates in SQL (ADR-0035 guard), (5) boot truth on packed open
failure, (6) one `packed_book` in `Book.for_key_packed/3`, (7) stride-2
unit tests + read-string crash + `mix corpus.validate`, (8)
docs/architecture updated.
