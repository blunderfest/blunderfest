# OpenChessLab — Packed Corpus v2
## Phase 2: Format v2 Repack Behind a Flag

### Objective

Implement ONLY Phase 2 from Technical Spike 09:

- packed position format v2
- precomputed per-position statistics
- occurrence-run offsets
- manifest/version support
- builder/validation support
- full v2 repack and parity verification

Do NOT switch Historical Evidence or other product code to the new v2 API yet.

Phase 0 and Phase 1 are already complete:

- Historical Evidence no longer performs unbounded occurrence materialization
  for bounded consumers
- request-scoped count memoization is live
- bounded `Corpus.occurrences(key, limit)` is live
- persisted anchor sidecars are live
- production cold wake is now seconds instead of 6–12 minutes

Preserve all of that.

This phase prepares the new packed format.
It does NOT perform the product/API cutover.

---

# Required source material

Read completely before changing code:

1. `docs/technical-spike-09-packed-corpus-production-design-review.md`
2. `docs/historical-evidence-phase0-production-safety.md`
3. `docs/architecture.md`
4. relevant packed-corpus ADRs
5. current implementations of:
   - `Corpus`
   - `Packed`
   - `Packed.Format`
   - `Packed.Builder`
   - `Packed.Manifest`
   - `Packed.Segment`
   - extraction / packing tasks
   - corpus validation/parity tasks

Use the current code as the final authority when a document is stale.

Do not reopen the storage-architecture decision.
Spike 09 already concluded that packed remains the occurrence backend.

---

# Current production state that must remain intact

The current packed backend already has:

- immutable segments
- `occ.bin`
- `pos.bin`
- `bucket.bin`
- `book.bin`
- manifest validation
- persisted `<file>.anchors-<stride>` sidecars
- chunked sequential anchor rebuild fallback
- v1 runtime behavior
- bounded `occurrences(key, limit)` support

Do NOT regress any of these.

In particular, do NOT restore runtime anchor reconstruction as the normal path.

---

# Format v2 design

Implement the position header proposed and measured in Spike 09.

## Current v1 position header

Approximately:

```text
hash
pawn_hash
first_gid
first_ply
string_offset
string_len