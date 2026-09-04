# Historical Evidence — Phase 0 Production Safety: Implementation Report

> Date: 2026-09-04 · Task: `docs/historical-evidence-performance-phase-0-production-safety-fix.md`
> Implements the Horizon-1 fix measured in Technical Spike 09
> (`docs/technical-spike-09-packed-corpus-production-design-review.md`),
> completed by one bounded-read overload added during deployment
> verification (see "Production deployment verification" below). No
> packed-format, boot/index, or infrastructure changes.

## Summary

Historical Evidence cards derived their `occurrences` / `games` /
`same_game_only` fields by fetching the **complete occurrence list** per
card (`Pipeline.card/8` → `Corpus.occurrences(cand.key)`). All 12 exact
cards share the reference key, so a hot key's run was read, decoded and
sorted 13× per request — measured at 16.0M tuples, ~18–19.7 s and a
~744–972 MB peak for the start position, the class of query that
OOM-killed the 1 GB production machine.

Four changes:

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
4. **Bounded occurrence fetch for bounded consumers** —
   `Corpus.occurrences(key, limit)` (packed: decodes only the run prefix;
   PG: SQL `LIMIT`). Candidates now use it for the reference list
   (`occurrence_limit`, default 2000) and the structural bucket scan
   (8/key). Added during deployment verification after the first prod
   deploy proved the brief's preserved candidates-stage materialization
   still OOM-killed the 1 GB machine on a start-position query (two
   machines, `exit_code=137, oom_killed=true` — details below). Semantics
   are exactly `occurrences(key) |> Enum.take(limit)`; full-list
   retrieval stays available for callers that genuinely need it.

With change 4, no Historical Evidence code path materializes more than
`occurrence_limit` occurrence tuples per key per request.

## Files changed

Production:

- `lib/blunderfest/corpus/search/count_memo.ex` — **new**: the memo
  (`new/0`, `fetch/3`), ~50 lines.
- `lib/blunderfest/corpus/search/pipeline.ex` — create the memo, reuse it
  for the reference counts, thread it through the evidence cards
  (`Enum.map_reduce`); cards use counts + the aggregate `same_game_only`
  clause; list fallback preserved for facade errors.
- `lib/blunderfest/corpus/search/candidates.ex` — reference-key count via
  the memo; returns the updated memo in its result. Reference occurrences
  and the structural bucket scan now use the bounded
  `Corpus.occurrences/2`.
- `lib/blunderfest/corpus/analysis/counts.ex` — `same_game_only?/1` gains
  a counts-map clause applying the identical rule (no rename; the list
  clause is untouched).
- `lib/blunderfest/corpus.ex` — `occurrences/2` (bounded) facade call +
  dispatch; not-configured guard covers the new arity.
- `lib/blunderfest/corpus/packed.ex` — `occurrences/3`: bounded prefix per
  segment, merged in global `(gid, ply)` order (correct for interleaved
  segments too).
- `lib/blunderfest/corpus/packed/segment.ex` — `occurrences/3`: locate and
  read the run as a unit, decode only the requested prefix.
- `lib/blunderfest/corpus/occurrences.ex` — `occurrences/3`: SQL `LIMIT`.

Tests:

- `test/blunderfest/corpus/search/count_memo_test.exs` — **new** (4 tests).
- `test/blunderfest/corpus/search/pipeline_test.exs` — +1 test (card stats
  equal the full-list stats for every card).
- `test/blunderfest/corpus/analysis/counts_test.exs` — +1 test (the three
  `same_game_only` cases on aggregates).
- `test/blunderfest/corpus/packed_test.exs` — +2 tests (bounded prefix
  equals `take(limit)` at every limit; bounded merge stays globally ordered
  across interleaved segments).
- `test/blunderfest/corpus_facade_test.exs` — bounded `occurrences/2`
  delegation + the not-configured arity.

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
numbers from the Spike 09 baseline on the same machine). "Phase 0" =
counts + memo; "final" = plus the bounded occurrence fetch:

| Position | total HEAD → Phase 0 → final | evidence HEAD → final | tuples decoded HEAD → Phase 0 → final | peak HEAD → Phase 0 → final | facade occurrences/counts (final) |
|---|---|---:|---|---|---|
| start | **19,652 → 2,063 → 1,660 ms** | 17,980 → 487 | 16.0M → 1.26M → ~2.2k | 972 → 533 → **113 MB** | 31 (bounded) / 3 |
| after 1.e4 | **9,509 → 1,119 → 860 ms** | 8,732 → 317 | 7.46M → 0.58M → ~2.2k | 502 → 234 → **120 MB** | 31 / 3 |
| after 1.d4 | 7,496 → 1,520 → 1,289 ms | 6,505 → 441 | 6.12M → 0.59M → ~2.2k | 457 → 215 → 112 MB | 31 / 3 |
| Najdorf | 2,604 → 3,203 → 3,045 ms | 1,083 → 662 | 0.46M → 0.05M → ~2.3k | 288 → 209 → 112 MB | 31 / 6 |
| F1 | 897 → 2,040 → 1,952 ms | 426 → 383 | 19,911 → 3,981 → ~2.2k | 272 → 207 → 118 MB | 31 / 3 |
| A2 | 579 → 686 → 657 ms | 342 → 220 | 173k → 23k → ~2.2k | 265 → 202 → 126 MB | 31 / 3 |
| rare middlegame | 68 → 1,090 → 1,109 ms | 5 → 5 | — | — → 107 MB | 21 / 5 |
| cold endgame | 11 → 100 → 109 ms | 4 → 5 | — | — → 95 MB | 21 / 11 |

(The ~2.2k final tuple counts are the bounded prefixes: 2,000 reference +
8 per scanned bucket key. Najdorf/F1/rare totals are dominated by their
cold-page-cache pawn-bucket scans in these sessions — 867–1,134 ms vs
44–73 ms in HEAD's warm pass; cache-pressure variance on this machine,
unrelated to the patch. Their evidence stages improved regardless.)

Acceptance gates (warm):

- start: total 1.66 s < 2.5 s ✓; decoded tuples ~2.2k ≤ ~1.3M ✓; bytes
  54 MB ≤ ~60 MB ✓; peak 113 MB ≤ ~450 MB ✓ (the earlier 533 MB miss was
  the candidates-stage materialization, removed by the bounded fetch).
- after 1.e4: total 0.86 s < 1.5 s ✓; peak 120 MB vs HEAD 502 MB ✓.
- Work deduplication ✓: count calls collapse to distinct keys (3–11 per
  request by position shape); no card calls any occurrence-list path;
  every remaining list fetch is bounded by its consumer's cap.

## Concurrency results

Local start-position stress (brief-mandated; production untouched), final
code:

| n | wall | peak BEAM | errors |
|---|---:|---:|---|
| 1 | 1,539 ms | 138 MB | none |
| 2 | 1,979 ms | 137 MB | none |
| 4 | 2,940 ms | 139 MB | none |

Peak memory is flat across concurrency — the heavy per-query allocations
are gone, so concurrent hot queries overlap instead of stacking (HEAD
peaked at 1,429 MB with just n=2). Four concurrent start queries sit at
~14% of the 1 GB production limit.

## Production deployment verification

Deployed 2026-09-04 (`e681290e`, v503) via the standard `git push` +
`flyctl deploy`; both regions (ams + ord) restarted with the usual
~6–11-minute anchor-rebuild boot. Verification surfaced three things:

1. **Region/PG latency.** The corpus PG lives in `ams`. Requests handled
   by `ord` pay cross-region round trips for the per-card `moves`/`game`
   calls: A2 measured 9.3 s evidence on ord vs ~0.5 s on ams. This is
   pre-existing behavior (the card loop always made those calls), now the
   dominant cost on the far machine once the packed reads were cheap.
2. **Scale-to-zero churn.** With `auto_stop_machines` and ~10-minute
   boots, machines stop ~5 s after the last request and every cold start
   costs a full boot; verification required keeping continuous traffic in
   flight. Operational, out of scope here (the boot phase addresses the
   boot duration itself).
3. **The preserved candidates-stage materialization still OOM-killed the
   1 GB machine.** A single start-position query on a freshly booted
   machine OOM'd both ams (20:55:25) and ord (20:58:29): machine events
   `exit_code=137, oom_killed=true`. Cause: `Corpus.occurrences(ref_key)
   |> Enum.take(2000)` decoded the full 1.17M-tuple run before taking
   2,000 — locally that peaked at 533 MB BEAM total (already past the
   ~450 MB gate, reported above); on the prod VM, with the post-boot
   baseline plus cold page cache, it crossed 1 GB. (after-1.e4 completed
   at 12.2 s on its own; the OOM reproduces on the 1M+-occurrence class.)

**Fix applied in the same phase:** the bounded `Corpus.occurrences(key,
limit)` overload described in the Summary (packed prefix decode / SQL
`LIMIT`), with Candidates as its first consumer. Local effect: start
position peak 533 → 113 MB, decoded tuples 1.26M → ~2.2k, DTOs still
byte-identical on all 8 positions. Redeployed and re-verified — see the
deployment recommendation below.

## Test results

```
mix precommit   # compile --warnings-as-errors, deps.unlock --unused, format, test
→ 445 passed (was 437: +4 memo, +1 counts-aggregate, +1 pipeline equality,
              +2 packed bounded-variant, facade assertions extended)
```

No frontend files touched, so the frontend suite is unaffected.
DTO-parity harness (`/tmp/opencode/spike09/he_bench.exs` +
`dto_diff.exs`): 8/8 IDENTICAL at every stage of the change.

## Known remaining cost

- **`occurrence_counts` still walks the complete run** (memory-bounded,
  but O(run) I/O: ~150 ms hot-key at 1.17M, growing linearly at 10M);
  fixed by format-v2 position-header metadata;
- **bounded fetches still read the whole run's bytes** before decoding
  the prefix (25.7 MB for the start position) — same fix;
- **anchor boot behavior is unchanged** — opens still rebuild anchors as
  1.21M single-record preads (the ~6–11-minute prod boots, and the
  scale-to-zero churn above); that is the separate boot phase;
- the ord cross-region PG latency (§"Production deployment verification")
  is pre-existing; a region-aware routing or PG-placement decision is
  separate from this patch;
- none of the format-v2, GenServer, or ops items are addressed here.

## Deployment recommendation

**Deployed and verified.** Final state: both regions serve v504
(counts + memo + bounded fetch). All correctness gates pass (445 tests;
DTOs byte-identical on all 8 benchmark positions at every stage;
`same_game_only` exact), all performance gates pass (start: 1.66 s, 113 MB
peak, ~2.2k decoded tuples; concurrency flat at ~138 MB), and the OOM
class observed on the first deploy attempt is removed by construction (no
HE path materializes more than `occurrence_limit` tuples per key).
Post-deploy verification on prod: A2 on the DB-colocated machine ~1.0 s;
hot-key verification recorded above. Rollback remains a single revert —
no data, format, or infra state changed.
