# Packed Corpus v2 — Phase 2: Format v2 Repack Behind a Flag: Implementation Report

> Date: 2026-09-05 · Task: `docs/packed-corpus-v2-phase2-format-v2-repack.md`
> Implements Phase 2 of Technical Spike 09
> (`docs/technical-spike-09-packed-corpus-production-design-review-report.md` §13),
> decision recorded in ADR-0038. No product/API cutover — Historical
> Evidence and the facade keep the existing APIs; the v2 fields are
> consumed only by the validation and parity tasks. Phase 0/1 behavior is
> untouched.

## Summary

The packed position header grew the three derived fields Spike 09 §6
designed and measured, written behind `mix corpus.pack --format-version 2`
and published as full repacks (v1 directories retained as rollback):

```
pos.bin header v2 (49 bytes, +13 over v1):
  <<hash::binary-size(16),          # as v1
    pawn_hash::unsigned-64,         # as v1
    occurrence_count::unsigned-32,  # NEW — run length in occ.bin
    game_count::unsigned-32,        # NEW — distinct gids in the run
    occ_run_offset::unsigned-40,    # NEW — first record index of the run
    first_gid::unsigned-32,         # as v1
    first_ply::unsigned-16,         # as v1
    string_offset::unsigned-32,     # as v1
    string_len::unsigned-16>>       # as v1
```

Manifest `"version": 2` records a per-segment `"pos_version"`; open accepts
v1 and v2 segments alike and rejects unknown versions, so both directory
formats coexist and rollback stays a `PACKED_DIR` flip. The builder computes
the statistics in the existing sorted-stream pass and verifies them against
occ.bin on a sampled pass before a segment may publish; the same
verification is available at read time (`Segment.verify_run/2`,
`Segment.verify_sampled_runs/2`) and wired into `corpus.validate` and
`corpus.parity`.

A latent v1 bug was found and fixed along the way: `book_stream` (and the
new v2 position stream) used `Stream.transform/4`, whose final callback is
a side-effect-only hook — its return value is **discarded**. Every build
since Spike 08 therefore dropped the *last* book key of the stream
(5,737,297 distinct book keys at 100k vs 5,737,296 built;
71,435,915 vs 71,435,914 at broadcast). Both streams now use
`transform/5`, where the final emission lives in `last_fun`. The v2 repacks
are the first builds with a complete book region; the retained v1
directories keep the latent one-key gap (documented, not repacked — they
are the rollback targets).

## Files changed

Production:

- `lib/blunderfest/corpus/packed/format.ex` — `pos_header_bytes/1`,
  `pos_header_v2/9`, `decode_pos_header_v2/1`; moduledoc documents both
  header layouts.
- `lib/blunderfest/corpus/packed/manifest.ex` — supported manifest
  versions 1+2 (unknown rejected), per-segment `pos_version` written and
  validated (missing ⇒ v1), `write!/3` takes the version.
- `lib/blunderfest/corpus/packed/segment.ex` — version-aware open (header
  width, size checks, anchor loading), version-aware header scan/decode,
  new `position_stats/2` (bounded O(log anchors) read of the stored stats,
  `{:error, :format_v1}` on v1), `verify_run/2` + `verify_sampled_runs/2`
  (O(run) re-derivation from occ.bin: run span, hash, adjacent-gid dedup,
  boundaries).
- `lib/blunderfest/corpus/packed.ex` — `position_stats/2`: sums
  occurrences/games across segments holding the key (exact — segment gid
  ranges are disjoint and a game is packed exactly once, Spike 09 §6);
  offsets stay segment-local.
- `lib/blunderfest/corpus/packed/builder.ex` — `pos_version: 2` builds
  (8-tuple position rows → 49-byte headers), sampled v2-stats
  verification (`validate_v2_stats!`, default 128 headers including first
  and last) that raises before publish on any mismatch; manifest entry
  carries `pos_version`.
- `lib/mix/tasks/corpus.pack.ex` — `--format-version 1|2` (default 1);
  `position_stream_v2/1` derives run length, adjacent-gid game dedup and
  run start offset in one pass; both it and `book_stream` fixed to
  `Stream.transform/5`; manifest written with the format version.
- `lib/mix/tasks/corpus.validate.ex` — `--sample N` (default 32) v2 run
  verification per segment on top of the checksum pass.
- `lib/mix/tasks/corpus.parity.ex` — v2 checks for every compared key:
  header `occurrence_count`/`game_count` vs the exact SQL oracles
  (`COUNT(*)` / `COUNT(DISTINCT gid)`), plus per-segment `verify_run`
  (run offset → first occurrence → boundaries); skipped on v1 directories.
- `lib/mix/tasks/corpus.broadcast_parity.ex` — v2 directories get the
  streamed re-count comparison: artifact run length/distinct-gid count vs
  the stored header statistics for every sampled key.
- `lib/mix/tasks/corpus.he_parity.ex` — extended with the three hot
  opening positions the original set lacked (start, after 1.e4, after
  1.d4 — Spike 09 §2's benchmark blind spot).
- `lib/mix/tasks/corpus.bench.ex` — header sampling follows the segment's
  `pos_version` width.

Docs: ADR-0038 (+ index), `docs/architecture.md` packed section,
`docs/operations.md` pack/validate commands.

Not touched (by design): `corpus.ex` facade, `search/pipeline.ex`,
`search/candidates.ex`, `analysis/counts.ex` — no product/API cutover in
Phase 2.

Tests: `test/blunderfest/corpus/packed_test.exs` +10 tests in a format-v2
describe block: v1/v2 round-trip equality across every query family,
stored stats vs independently computed run offsets, `verify_run` clean +
missing-key, `format_v1` reporting, builder rejection of corrupt
`occ_run_offset` and wrong `game_count`, manifest v2 write/open + unknown
version rejection, bounded-prefix equality on v2.

## Verification results

All local, 8-core desktop, NVMe; PG = docker Postgres with the 100k
occurrence tables + 100k games/moves (the tier-swap dance of Spike 09
§12.7 — with the broadcast-tier games/moves tables the PG book oracle
reads wrong games and book parity fails identically on v1 and v2,
confirming the trap is environmental and pre-existing).

**100k tier (PG oracle):**

- `mix corpus.pack --format-version 2` → 6,814,883 occurrences,
  5,833,794 positions, 5,737,297 book records (the previously dropped
  last book key is now present).
- `mix corpus.validate` — checksums + 32 sampled run verifications: OK.
- `mix corpus.parity --sample 10000` (including the v2 stats/run checks):
  **PARITY OK — all checks passed (19s)**.
- `mix corpus.he_parity` (extended set): **9/9 positions identical**
  PG vs packed v2 — start PG 7,764 ms / packed 7,972 ms; after 1.e4
  7,800 / 7,726; after 1.d4 10,539 / 10,379; the six original positions
  unchanged (≤1,068 ms).

**Broadcast 1.17M tier (artifact oracle):**

- Full repack via `--resume` on the retained v1 intermediates (no
  re-combine/re-sort): **1,490 s**; 1,174,661 games, 94,257,050
  occurrences, 72,393,592 positions, 71,435,915 book records.
- Storage: occ 2,073,655,100 + pos 7,189,943,585 + bucket 1,737,446,208 +
  book 3,067,706,174 = **13.1 GiB** (v1 12.2 GiB, +7.4% — the pos.bin
  delta is exactly 72,393,592 × 13 B = 941,116,696 bytes, the Spike 09
  projection to the byte).
- `mix corpus.validate --sample 64` — checksums + sampled run
  verification: OK.
- `mix corpus.broadcast_parity --sample 10000` — 72,393,592 keys streamed,
  10,001 sampled with full-list + v2-stats comparisons: **0 failures**.
- The stored hot-key statistics reproduce the Spike 09 measurements
  exactly: start 1,169,388 occ / 1,169,353 games; after 1.e4 569,153 /
  569,149; after 1.d4 337,062 / 337,058.

**Benchmark gate (hot-key stats lookup ≤100 µs):** broadcast v2, warm,
200 reps — start p50 **21 µs** (p99 301 µs), after 1.e4 p50 **31 µs**,
after 1.d4 p50 **27 µs**, vs the run-walk `occurrence_counts` at
198 ms / 78 ms / 56 ms. 100k tier: p50 15–26 µs. Gate passed ~3–5× over.

`mix precommit` (format, compile --warnings-as-errors, deps.unlock,
455 tests): green.

## What Phase 2 deliberately does not do

- No facade/product API change: `occurrence_counts` still walks the run,
  bounded `occurrences` still reads the whole run's bytes — both now have
  the header data to become O(log N) in Phase 3.
- No production corpus replacement: the prod volumes keep the v1
  directory; shipping the 13.1 GiB v2 directory and flipping `PACKED_DIR`
  is an ops step for the cutover phase (procedure as in ADR-0037: sftp to
  both volumes, checksum-verify against the manifest, flip, deploy).
- No anchor-sidecar change: a v2 directory's sidecars are produced by its
  first open (as Phase 1 established) and ship with it.

## Follow-ups (Phase 3+, not here)

- Facade API from product needs (`position_stats`, run-offset bounded
  reads) + pipeline cutover — Spike 09 §13 Phase 3; the gate there is
  start-position HE <1 s / <300 MB peak.
- `book_counts` served from `game_count` closes the Spike 09 §12.8
  `book_games_count` divergence (measured −87,264 at start).
- Optional: repack the retained v1 directories with the fixed
  `book_stream` (their one-key book gap is latent and harmless for
  rollback purposes).
