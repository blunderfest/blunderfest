# ADR-0038: Packed format v2 — position headers carry pack-time run statistics

Status: Accepted (2026-09-05) — built and validated behind a flag; Phase 3 product/API cutover implemented locally 2026-09-05 (facade cost-explicit API + Historical Evidence cutover; production `PACKED_DIR` flip pending)

## Context

Spike 09 found the packed occurrence backend architecturally sound but
missing precomputation: every count/stat question (the dominant Historical
Evidence operation) answered by walking the whole occurrence run — 150 ms
for the start position's 1.17M-occurrence run at the broadcast tier, and
bounded occurrence reads still read the whole run's bytes before keeping a
prefix. The packer streams exactly the numbers needed (run length, distinct
gids, run start offset) and throws them away. Phase 0/1 fixed the pipeline
and boot; the format is the remaining storage-side fix.

## Decision

pos.bin gains a format-v2 header (49 bytes, +13 over v1) with three derived
fields computed during packing: `occurrence_count` (u32), `game_count`
(u32, distinct gids in the run) and `occ_run_offset` (u40, the run's first
record index in that segment's occ.bin). Segment gid ranges are disjoint and
a game is packed exactly once, so per-segment counts sum exactly across
segments. Manifest version 2 records `"version": 2` and a per-segment
`"pos_version"`; open accepts v1 and v2 and rejects anything else. v2 is
built behind `mix corpus.pack --format-version 2`, validated at build time
by a sampled re-count against occ.bin, and published as a full repack into a
new directory — no in-place migration, rollback is a `PACKED_DIR` flip, v1
and v2 directories coexist. Historical Evidence and the facade stay on the
existing APIs for now: Phase 2 ships the format, validation and parity only.

## Consequences

Count/stat lookups become O(log anchors) header reads independent of run
length, and bounded occurrence reads can go straight to the run span —
measured ≤100 µs for the broadcast hot keys (Spike 09 §12.5). Storage grows
+7.4% at the broadcast tier (12.2 → 13.1 GiB). The builder's
`Stream.transform` book/position streams were fixed to `transform/5` in the
process — `transform/4`'s final callback discards its return value, which
had silently dropped the last book key of every build (latent since Spike
08). Phase 3 (this repo's `docs/packed-corpus-phase3-runtime-cutover.md`)
performed the API cutover: the facade's cost-explicit primitives
(`position_stats`/`first_occurrence`/bounded `occurrences`) and Historical
Evidence consume the v2 fields; v1 directories keep the run-walking
fallbacks and remain the rollback target.
