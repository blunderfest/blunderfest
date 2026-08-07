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

### 2. The channel's op ingestion trusts the client

`RoomChannel.handle_in("op")` checks the edit role and then appends *whatever*
arrived: no payload shape validation, no size cap, no move-legality check —
despite a commit message claiming "server-validated legal moves" (that
validation only lives in the read-only `/api/games/moves` endpoint). The op
log is the source of truth and it's write-what-you-want: a bad actor (or a
buggy client) can inject huge payloads or malformed moves that get broadcast
to every client. `Blunderfest.Game.Moves` exists — validating `move_at_ply`
server-side is right there.

### 3. Unbounded in-memory growth

Rooms are never evicted; `ops ++ [op]` is O(n) per append, so a busy room
degrades quadratically; `POST /api/rooms` is unauthenticated with no rate
limit; profiles likewise. Scale-to-zero restarts mask all of this — but one
busy week or one bored attacker OOMs the 1 GB machine. Cheap fixes: store ops
prepended (O(1) append, reverse on read), cap ops per room, cap total rooms.

### 4. CI is disabled

"Checks and deploys are done locally" means nothing guards `main` except
discipline. Re-enabling is nearly free and catches the "works on my machine"
class (hit twice already: the pnpm-root-dir failure, the Vite-hash worker
issue).

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

### 6. Legal moves are a server round-trip per position

`fetchLegalMoves` fires on every cursor change when the user can edit —
latency on every click in solo play and pointless chatter. `chess.js` is
named in PROJECT.md but isn't in `package.json`. Suggestion: run chess.js (or
a small local validator) client-side for interactivity and keep the server as
the write-time authority.

### 7. One global GenServer for all rooms

Every op, join, and read across every room serializes through a single
process. Fine today; it's the known future bottleneck. One process per room
under a DynamicSupervisor is the natural evolution — and it pairs with
per-room eviction, which also addresses finding 3.

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

1. `fly secrets set SECRET_KEY_BASE` + rotate + remove from `fly.toml`.
2. Server-side op payload validation + size caps.
3. Re-enable CI.
4. Op storage prepend + room caps/eviction.
5. chess.js locally for solo play.
