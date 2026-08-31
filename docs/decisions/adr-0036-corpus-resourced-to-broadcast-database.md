# ADR-0036: Corpus re-sourced to the Lichess Broadcast Database

Status: Accepted (2026-08-30); prod rollout **deferred** — see Consequences

## Context

The corpus was the first 100k games of `lichess_db_standard_rated_2017-05`
(11.7M-game file) — an arbitrary prefix, unfiltered by rating, eight years
old. Two goals drove the re-source: get to ~1M games (the search gate per the
roadmap/FEATURES), and raise quality (the corpus's whole point is "good
historical examples"). The owner picked the Lichess **Broadcast Database**
over MillionBase and over bumping the standard-rated dump to 1M.

The broadcast database is ~1.19M elite over-the-board tournament games
(2020-01 → 2026-07, monthly `.pgn.zst`, CC0), with real Elo/FIDE IDs and
per-move `[%eval]`/`[%clk]`. Verified sample: World Championship match games
(Goryachkina–Ju, both ~2580 Elo).

## Decision

Re-source the corpus to the broadcast database, broadcast-only (the 100k
2017-05 slice is dropped, not merged). Extraction-policy decisions (owner):

- **Drop non-standard games entirely** — Chess960 (`[Variant "Chess960"]`) and
  From-Position (any `[SetUp]` tag) are skipped at extraction. Replaying them
  from the standard start would silently mis-key every position; their game
  count (~11.7k of 1.19M) is noise.
- **No Elo floor** — all standard games are kept; broadcasts skew elite anyway.
- Import is the full broadcast set: ~1.174M standard games.

Extraction was made variant/FEN-correct to support this (non-standard games
are counted in a `games_skipped` stat, not silently extracted), plus the
header fixes the broadcast format needs: the game date falls back `UTCDate` →
`Date`, non-numeric Elos (`"N/A"`, `""`) normalize to the `"?"` NULL marker,
and `clean/1` strips backslashes (a raw `\` before a tab breaks COPY's text
format).

## Consequences

- **Code and local corpus done; prod reload blocked on storage.** The new
  pipeline extracted 1,169,353 games / 94.3M occurrences / 72.4M positions and
  the local corpus is fully rebuilt and verified (start position e4 = 569 149
  games; Ruy tabiya 3 736 games). The prod Postgres reload, however, hit the
  documented scale ceiling: the 94M-row `corpus_occurrences.key` index build
  OOM-crashed the shared-cpu machine repeatedly, and the COPY stage filled the
  volume into read-only mode (the volume was extended 10GB → 64GB and the
  machine scaled 1GB → 8GB just to run the load). The reload was abandoned and
  prod restored to the 100k corpus. **The machine was scaled back to
  shared-cpu-1x/1GB afterward** (the volume stays at 64GB — Fly volumes only
  grow).
- **The owner has chosen to pursue the packed binary index** (Spike 01's
  designated successor, and the corpus-scale-readiness trigger) rather than
  push PG further — if 1M is already this painful, 10M+ is untenable. The
  broadcast corpus is the intended first payload for that index.
- A **hot-key fan-out bug** the bigger corpus exposed was fixed as part of this
  work (and applies to the current 100k corpus too): the start position (now
  ~1.17M occurrences via ply-0) made the evidence pipeline materialize every
  occurrence and re-query per game. The next-move distribution and reference
  counts are now SQL-backed (reusing `Corpus.Book` and a new
  `Corpus.occurrence_counts`), the family clustering reads a bounded occurrence
  list (`occurrence_limit`, default 2000) via a single batched `moves_for`
  query. The start position completes instead of hanging; a normal tabiya's
  evidence dropped ~2s → ~0.9s.
- The ply-0 (initial-position) occurrences come along per game: each kept game
  emits its start position, so the standard start keeps its first-move stats.
- Nothing references corpus gids durably (verified: evidence results are
  per-session), so a future re-source/reindex is free.
