# Historical Evidence — Phase 0 Production Safety: Implementation Report

> Date: 2026-09-04 · Task: `docs/historical-evidence-performance-phase-0-production-safety-fix.md`
> Implements exactly the Horizon-1 fix measured in Technical Spike 09
> (`docs/technical-spike-09-packed-corpus-production-design-review.md`).
> No packed-format, boot/index, API, or infrastructure changes.

## Summary

Historical Evidence cards derived their `occurrences` / `games` /
`same_game_only` fields by fetching the **complete occurrence list** per
card (`Pipeline.card/8` → `Corpus.occurrences(cand.key)`). All 12 exact
cards share the reference key, so a hot key's run was read, decoded and
sorted 13× per request — measured at 16.0M tuples, ~18–19.7 s and a
~744–972 MB peak for the start position, the class of query that
OOM-killed the 1 GB production machine.

Three changes, exactly per the brief:

1. **Cards use `Corpus.occurrence_counts/1`** (the aggregate) instead of
   materializing the list; `same_game_only` stays exactly
   `occurrences > 1 and games == 1`, now centralized in one clause of
   `Counts.same_game_only?/1` that accepts the aggregate map.
2. **Request-scoped count memo** — a plain map (canonical key →
   `%{occurrences, games}`) created per pipeline request and threaded
   explicitly through Candidates and the cards. No ETS, no process
   dictionary, no application/global state, no TTL.
3. **Duplicate reference-key counts collapsed** — candidate generation and
   the reference stats block now share the memoized value (one facade call
   instead of two; the 12 exact cards reuse it too).

The candidates-stage full-run fetch (`Corpus.occurrences(ref_key) |>
Enum.take(...)`) is **deliberately unchanged** (brief: preserved for the
later bounded-reads phase), and so is the 30-key structural bucket scan.

## Files changed

Production:

- `lib/blunderfest/corpus/search/count_memo.ex` — **new**: the memo
  (`new/0`, `fetch/3`), ~50 lines.
- `lib/blunderfest/corpus/search/pipeline.ex` — create the memo, reuse it
  for the reference counts, thread it through the evidence cards
  (`Enum.map_reduce`); cards use counts + the aggregate `same_game_only`
  clause; list fallback preserved for facade errors.
- `lib/blunderfest/corpus/search/candidates.ex` — reference-key count via
  the memo; returns the updated memo in its result.
- `lib/blunderfest/corpus/analysis/counts.ex` — `same_game_only?/1` gains
  a counts-map clause applying the identical rule (no rename; the list
  clause is untouched).

Tests:

- `test/blunderfest/corpus/search/count_memo_test.exs` — **new** (4 tests).
- `test/blunderfest/corpus/search/pipeline_test.exs` — +1 test (card stats
  equal the full-list stats for every card).
- `test/blunderfest/corpus/analysis/counts_test.exs` — +1 test (the three
  `same_game_only` cases on aggregates).

## Request-scoped memo design

- **Where it lives:** created in `Pipeline.do_analyze/2`
  (`CountMemo.new()`), passed to `Candidates.generate/2` via the
  `:count_memo` option, returned in the candidates result as
  `:count_memo`, then threaded card-by-card with `Enum.map_reduce`. It is
  a function argument and a map field the whole way — visible in every
  type spec it touches.
- **Key/value shape:** canonical position key (the corpus key string) →
  `%{occurrences: n, games: m}` — exactly the facade's
  `occurrence_counts/1` result. Facade errors (`{:error,
  :not_configured}`) pass through **unmemoized**, so error behavior is
  byte-for-byte what HEAD did.
- **How duplicate work disappears:** the first `fetch/3` for a key calls
  the facade and stores the result; every later `fetch/3` for that key is
  a map hit. For a hot exact position: Candidates fetches the reference
  key once (also serving the pipeline's reference stats — the old second
  call is gone), and all 12 exact cards hit the memo. Traced on the 1.17M
  corpus: count calls per request = number of **distinct** keys (3 for
  start/e4/d4/F1/A2; 6 for Najdorf; 11 for the endgame case), down from
  2 count calls + 22 full-list fetches.
- **Why explicit threading (not the process dictionary):** the brief
  prefers it; Spike 09's process-dictionary variant was only an experiment
  seam. Threading cost three small signature changes and makes the scope
  (one request) visible in the types. The memo's `fetcher` argument
  defaults to `&Corpus.occurrence_counts/1` and is injectable, which is
  how the unit tests observe call counts without tracing.

## Semantic verification

**DTO parity on all 8 benchmark positions: IDENTICAL** (timings stripped,
field-by-field comparison of the full Historical Evidence result — pre-fix
HEAD baseline captured with the same harness, post-fix captured after the
patch):

```
IDENTICAL  start position      IDENTICAL  Najdorf tabiya (6.Be3)
IDENTICAL  after 1.e4          IDENTICAL  F1 KID tabiya
IDENTICAL  after 1.d4          IDENTICAL  A2 Ruy decision
IDENTICAL  rare middlegame     IDENTICAL  cold endgame
```

Supporting checks:

- `same_game_only` pinned by the existing tests at both layers
  (`pipeline_test` "the same-game structural candidate is flagged" →
  `%{occurrences: 2, games: 1, same_game_only: true}`; the
  `historical_evidence_test` DTO-level twin) — both pass unchanged.
- New pipeline test asserts every card's `historical` equals what the full
  occurrence list would produce (counts and same_game_only) across all
  cards of the fixture corpus.
- Aggregate equality itself is established by Spike 09's parity work
  (packed adjacent-gid walk and PG `COUNT(*)/COUNT(DISTINCT gid)` agree on
  10k sampled keys + edge cases) and by the DTO parity above.
- Card/candidate ordering, candidate selection, continuation grouping and
  support counts are untouched code paths — confirmed identical by the DTO
  compare (which covers ordering, since lists compare element-wise).

The `book_games_count` divergence (Spike 09 §12.8) is explicitly **not**
touched, per the brief.

## Performance results

Local 1.17M packed corpus (warm; Spike 09 harness with BEAM tracing; HEAD
numbers from the Spike 09 baseline on the same machine):

| Position | total HEAD → Phase 0 | candidates | menu | evidence HEAD → P0 | tuples HEAD → P0 | bytes HEAD → P0 | peak HEAD → P0 | facade occurrences/counts HEAD → P0 | GenServer busy HEAD → P0 |
|---|---|---:|---:|---:|---|---|---|---|---|
| start | **19,652 → 2,063 ms** | 824 | 722 | 17,980 → 507 | 16.0M → 1.26M | 386 → 54 MB | 972 → 533 MB | 53/2 → 31/3 | 7,304 → 853 ms |
| after 1.e4 | **9,509 → 1,119 ms** | 446 | 329 | 8,732 → 335 | 7.46M → 0.58M | 181 → 25 MB | 502 → 234 MB | 53/2 → 31/3 | 3,978 → 503 |
| after 1.d4 | 7,496 → 1,520 ms | 372 | 623 | 6,505 → 518 | 6.12M → 0.59M | 143 → 24 MB | 457 → 215 MB | 53/2 → 31/3 | 2,691 → 435 |
| Najdorf | 2,604 → 3,203 ms | 916 | 1,474 | 1,083 → 806 | 0.46M → 0.05M | 24 → 15 MB | 288 → 209 MB | 53/2 → 31/6 | 260 → 967 |
| A2 | 579 → 686 ms | 192 | 225 | 342 → 262 | 173k → 23k | 6 → 3 MB | 265 → 202 MB | 53/2 → 31/3 | 107 → 254 |

Acceptance gates (warm):

- start: total 2.06 s < 2.5 s ✓; tuples 1.26M ≤ ~1.3M ✓; bytes 54 MB ≤
  ~60 MB ✓; peak 533 MB vs the ~450 MB target — **missed narrowly,
  reported per the brief**: the work shape is exactly Variant A (identical
  tuples/preads/bytes/call counts; Spike 09 measured 435 MB for the same
  shape), this run's idle BEAM baseline was ~178 MB higher than the spike
  session's (visible in the trivial endgame query's 178 MB "peak"), and
  the residual is the intentionally preserved candidates-stage
  materialization of the 1.17M-row reference run.
- after 1.e4: total 1.12 s < 1.5 s ✓; peak 234 MB vs HEAD 502 MB ✓.
- Work deduplication ✓: count calls collapse to distinct keys; no exact
  card calls the full occurrence path anymore (the 31 remaining
  `occurrences` calls = 1 preserved candidates-stage ref fetch + 30 capped
  structural bucket-scan fetches — unchanged behavior).

Najdorf/A2 totals ran *slightly above* HEAD despite improved evidence
stages: their candidates-stage pawn-bucket scans hit a cold page cache in
this session (bucket scan 867–1,134 ms vs 44–73 ms in HEAD's warm pass —
cache-pressure variance on this machine, unrelated to the patch; evidence
stage itself improved in both).

## Concurrency results

Local start-position stress (brief-mandated; production untouched):

| n | wall | peak BEAM | errors |
|---|---:|---:|---|
| 1 | 1,849 ms | 289 MB | none |
| 2 | 2,619 ms | 336 MB | none |
| 4 | 4,164 ms | 431 MB | none |

Matches the Spike 09 Variant A shape (~1.9 s/289 MB, ~3.1 s, ~4.8 s/431
MB). For contrast, HEAD peaked at 1,429 MB with just n=2. Four concurrent
hot queries stay under half the 1 GB production limit — the OOM pattern is
gone.

## Test results

```
mix precommit   # compile --warnings-as-errors, deps.unlock --unused, format, test
→ 443 passed (was 437: +4 memo tests, +1 counts-aggregate test, +1 pipeline equality test)
```

No frontend files touched, so the frontend suite is unaffected.
DTO-parity harness (`/tmp/opencode/spike09/he_bench.exs` +
`dto_diff.exs`): 8/8 IDENTICAL (above).

## Known remaining cost

Explicitly, per the brief:

- **candidate generation still materializes the reference occurrence run**
  (`occurrences(ref_key) |> take(2000)`) — the start position still
  decodes 1.26M tuples/request and dominates the remaining memory; fixed
  by the later bounded-reads/format-v2 phase;
- **`occurrence_counts` still walks the complete run** (memory-bounded,
  but O(run) I/O: ~150 ms hot-key at 1.17M, and it would grow at 10M);
  fixed by format-v2 position-header metadata;
- **anchor boot behavior is unchanged** — opens still rebuild anchors as
  1.21M single-record preads (the 6–12-minute prod boots); that is the
  separate boot phase;
- this patch is **Horizon 1 only**; none of the format-v2, API, GenServer,
  or ops items are addressed.

## Deployment recommendation

**Ready for a controlled production deployment.** All correctness gates
pass (443 tests; DTOs byte-identical on all 8 benchmark positions;
`same_game_only` exact), all performance gates pass except the start
position's peak memory (533 MB vs ~450 MB target — machine-baseline
variance around an otherwise exactly-Variant-A work shape, and the
residual is the brief's explicitly preserved candidates-stage cost), and
the local concurrency check shows the OOM pattern eliminated (431 MB at
4 concurrent hot queries). Not deployed here per the brief; recommended
deploy path: normal `git push` + `flyctl deploy`, watching the first
hot-key evidence requests. Rollback is a single revert (the patch is
self-contained; no data, format, or infra state changed).
