# ADR-0037: Packed binary occurrence backend

Status: Accepted (2026-08-31)

## Context

Spike 08 measured the packed binary occurrence index against the PostgreSQL
occurrence store at the 100k corpus tier (6.8M occurrences, 5.8M positions).
The broadcast re-source (ADR-0036) landed ~1.17M extracted games locally,
but PG failed on the 94M-row occurrence COPY/index build in prod (OOM on
Fly's shared-cpu, volume → read-only), and the spike brief's trigger said
a packed backend becomes the plan at that scale. Spike 01 had already
proven the 22-byte occurrence record and the sparse-anchor lookup;
Spike 03 established the PG boundary (`Blunderfest.Corpus`) as the
correct place to replace the occurrence store piece-by-piece.

## Decision

Blunderfest now has two occurrence backends behind the `Corpus` facade:
`:postgres` (the original) and `:packed` (Spike 08's three-file segment
format, `occ.bin`/`pos.bin`/`bucket.bin` under a manifest). Selection is a
config flip (`occurrence_backend`, `PACKED_CORPUS=1`), not a code fork;
games, moves, metadata, and game export always come from PG regardless of
the occurrence backend. `Packed.open` merges segments in build order —
intended future incremental shape: immutable packed segments + a PG delta
tail + periodic compaction. `packed_book` computes the book aggregate
locally when packed, matching `Book.for_key`'s independent-game semantics.
Parity (10k sampled keys + edge cases) and the full Historical Evidence
pipeline on all six reference positions matched PG exactly.

## Consequences

The occurrence-store seam is closed: PG's UNLOGGED corpus occurrence/
position tables stop growing once the packed backend is flipped. The
100k corpus' occurrence store drops from ~2113 MB to ~1012 MB (packed
with the precomputed `book.bin`), lookups are ~3.5× faster (corrected
measurement), and the 1M-corpus rebuild path (`mix corpus.pack`) stays
under an hour. The corpus' status config in `config/config.exs` rests on
`:postgres` because deployments choose with `PACKED_CORPUS` — the PG
tables stay provisionable while the packed index validates on the broadcast
1M corpus.

After a reviewer's pass on the spike, eight findings were closed before
merging: the bench's broken probe now returns hit-only samples on both
sides (the earlier ~4× headline is corrected to ~3.5×); PG's text-column
ORDER BYs pin C collation (the sorted contract can't leak libc differences
into candidate caps); the hot-bucket regression (~2.4s→1.0s after
threading one fd per query); the facade routes `:book`/`:book_counts` to
the precomputed `book.bin` in packed mode (the SQL path serves PG-only
coexistence; `Book.for_key_packed/3` remains available as the
non-precomputed alternative); boot on packed open failure is now truthful
(never silently falls back); one `packed_book` lives in
`Book.for_key_packed/3` so the facade route and parity check are the same
code; stride-2 unit tests cover walk-back/boundary/crash; and
`mix corpus.validate` wires up `verify_checksums: true` (the failure/
recovery claim is exercised).

The follow-up validation against the full 1.17M broadcast corpus (the
closing condition) passed: broadcast artifact parity 72.4M keys streamed,
10,001 sampled, 0 failures; the packed build is ~9.4 GiB total with
`book.bin` (occ 1977.6 + pos 5959.3 + bucket 1657.0 + book ~975 MB).
The recommendation is A — production migration approved; deploy with
`PACKED_CORPUS=1` behind the existing PG tables, then drop the PG
occurrence tables once prod is validated.
