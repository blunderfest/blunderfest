# Code Review — 2026-08-06

Full review of the codebase (backend domain modules, channel, controllers,
config, frontend store/features, tests, infra), done after the solo-board
milestone. Ordered by severity; follow-up discussion pending.

## Overall impression

The bones are genuinely good. The two big architectural bets — **op-log as
authoritative state** and **no-DB with in-memory rebuild** — are the right
calls for this product at this scale, and they're executed coherently. Test
culture is real (126 ExUnit + 212 vitest, axe scans, golden PGN fixtures),
modules are small and carry moduledocs that explain *why* (the Lichess
legacy-route rationale, the RAV disambiguation rule). Better than most hobby
codebases.

## Findings, by severity

### 1. ~~`SECRET_KEY_BASE` and `RELEASE_COOKIE` are committed in `fly.toml`~~ ✅ DONE (2026-08-07)

Rotated and moved to `fly secrets`; `fly.toml` no longer carries them. The
old values remain in git history but are invalid.

### 2. ~~The channel's op ingestion trusts the client~~ ✅ DONE (2026-08-10)

`Blunderfest.Ops.validate/1` now shape-checks every op type (squares, colors,
annotation caps, per-type payloads) and rejects anything over 256 KB
(`invalid_op` / `op_too_large` error codes). `RoomChannel.handle_in("op")`
runs validate → permission → append. Note: *move-legality* is enforced
client-side via chess.js (see #6), not re-checked server-side — a malicious
client can still push illegal moves, just well-formed ones.

### 3. Unbounded in-memory growth — ⚠️ PARTIAL (2026-08-10)

Hard caps landed: `@max_rooms 1_000` (create returns 429 `room_limit`) and
`@max_ops_per_room 5_000` (`op_limit`). Ops are now stored prepended with a
counter, so appends are O(1) (done with ADR-0012). Still open: rooms are
never evicted, and `POST /api/rooms` has no rate limit beyond the global cap.

### 4. CI is disabled — 🚫 WON'T FIX (2026-08-10)

Deliberate product decision: GitHub Actions' limits bit us before, so checks
run locally (`mix precommit`, `pnpm lint && pnpm typecheck && pnpm exec
vitest run --pool=forks && pnpm build`) and deploys are local via `flyctl
deploy`. A restored workflow landed and was removed again the same day.

### 5. The chess core rides on a 0.1 library with workarounds

`echecs ~> 0.1.4` needs a precompile hack
(`scripts/ensure_echecs_magic_cache.exs`), and the app already hand-rolls
around its gaps: a custom PGN parser (because `Echecs.PGN` only scans
pseudo-legal moves) and custom SAN generation (because Echecs can't produce
SAN). This is the highest *correctness* risk in the system — chess edge cases
(en passant pins, castling rights, SAN disambiguation) are brutal. Mitigated
by real tests, but golden fixtures specifically for SAN disambiguation and
castling would be worthwhile, and Echecs' maturity should be watched
(vendor/replace if it stalls).

### 6. ~~Legal moves are a server round-trip per position~~ ✅ DONE (2026-08-10)

`assets/src/features/analysis/legalMoves.ts` computes legal moves locally with
chess.js (`legalMovesFor(fen)` → from/to/promotion/san + resulting fen +
status via isCheckmate/isStalemate/isDraw). `Analysis.tsx` memoizes them per
position; `fetchLegalMoves` and its server round-trip are gone. (The
read-only `/api/games/moves` endpoint still exists server-side, unused.)

### 7. ~~One global GenServer for all rooms~~ ✅ DONE (2026-08-10)

Each room is now its own temporary `Blunderfest.Room` process behind the
unchanged `Rooms` facade (ADR-0012): registered by slug, started on demand,
ops stored prepended with a counter. On top of that the Fly machines form an
Erlang cluster and the registry/supervisor are Horde's (ADR-0013), so a room
is reachable from every region — which also fixes the latent split-brain
between `ams` and `ord`. Remaining caveat (documented in ADR-0013): during a
netsplit the same code can briefly exist on both nodes, and one side's ops
are discarded on heal.

## Smaller items

- `Analysis.tsx` is becoming a god-component again (~440 lines: cursor,
  pending-echo, engine, keyboard, comments). Works and tested, but the
  cursor/engine logic would extract cleanly into hooks before milestone 6
  adds more.
- The `pending` local-echo mechanism is a pragmatic second application path
  that slightly breaks the "single application path" purity. Well-contained;
  preferable would be an echo fast enough to not need it.
- The stockfish.js package's browser loading is janky (hit twice: hashed
  assets, then the same-stem fix). An alternative would be lichess's
  `stockfish-web` build. Working now in both browsers, with fake-engine tests.
- Housekeeping: `erl_crash.dump` (5 MB, gitignored) in the repo root; the
  `architecture` and dependabot branches lingering.

## What should not change

The op-log protocol (replay-on-join, server echo as single application path,
deterministic node ids), the no-DB stance, the error-codes i18n split, the
approval seam, and the test seams (FakeChannel, injectable engine/channel
factories). Good design.

## Suggested order of work

1. ~~`fly secrets set SECRET_KEY_BASE` + rotate + remove from `fly.toml`.~~ ✅
2. ~~Server-side op payload validation + size caps.~~ ✅
3. ~~Re-enable CI.~~ 🚫 won't fix — checks/deploys stay local by decision.
4. Room eviction (caps and O(1) storage landed; eviction remains).
5. ~~chess.js locally for solo play.~~ ✅
6. ~~One process per room under a DynamicSupervisor (finding 7).~~ ✅ (and clustered via Horde)
