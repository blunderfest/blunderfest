# Blunderfest — Project Overview & Roadmap

Collaborative chess analysis: import games, analyze solo or with other people in real
time, and search a growing corpus of positions (exact and *similar*).

This document is the roadmap and entry point. Deep-dives live in [`docs/`](docs/README.md):
[architecture](docs/architecture.md), [operations](docs/operations.md), and the
[ADR set](docs/decisions/README.md) record the *why* behind every significant decision.
Future sessions: read this file, then `docs/architecture.md`, keep both current.
The feature inventory lives in [`FEATURES.md`](FEATURES.md).

## Hard constraints

- Backend: **Elixir + Phoenix**, real-time via **Phoenix Channels**, plain **JSON API**.
- **The backend contains no UI** — JSON API + sockets only; the compiled React bundle
  is served by a catch-all route (ADR-0002).
- Frontend: **React 19** (Vite build, bundled by Phoenix for a single-app deploy).
- **No database** — in-memory GenServer state rebuilt on boot (ADR-0001). Reintroducing
  one needs explicit approval.
- No hard release deadline; hobby project, but built **as if it will be shipped** —
  releasable at every milestone.

## Core principles

1. **Anonymous-first, no stored PII.** Full access without an account; profiles are a
   server-generated fun name + device secret, only salted hashes stored (ADR-0004).
2. **Open collaboration.** Anyone with a room link joins; roles (owner/collaborator/
   viewer) gate editing.
3. **Analysis is unstructured.** The board is a canvas: moves, variations, arrows,
   comments. Hand-rolled board component — no board library.
4. **Search is a marquee feature.** Same *and* similar positions with
   **user-configurable similarity weights** from day one (ADR-0010).
5. **Correctness first.** Similarity ships with golden-fixture tests.

## Product model

- **Games** — imported PGNs (paste, or Lichess link). Any game can be analyzed by anyone.
- **Rooms** — a shared analysis session per 5-char code, created explicitly via
  `POST /api/rooms` (ADR-0006); join by code or `#/r/<code>` deep link.
- **Profiles** — automatic anonymous identity (fun name + device secret, ADR-0004).
  Signing in (magic links / external providers, keyed hashes only) is a future bridge
  to cross-device identity.
- **Game library** — per-profile collection of owned/claimed games; a first-class
  early feature (the reason to make an account at all).

## Key decisions (summary)

| Decision | ADR |
|---|---|
| No database; state rebuilt on boot | [ADR-0001](docs/decisions/adr-0001-no-database-in-memory-state.md) |
| Backend = JSON API + SPA bundle, no server UI | [ADR-0002](docs/decisions/adr-0002-backend-serves-api-and-spa-no-ui.md) |
| Structured error codes; client owns copy | [ADR-0003](docs/decisions/adr-0003-structured-error-codes-client-owns-copy.md) |
| Anonymous-first profiles | [ADR-0004](docs/decisions/adr-0004-anonymous-first-profiles.md) |
| Rooms sync via op log, replay on join | [ADR-0005](docs/decisions/adr-0005-op-log-room-synchronization.md) |
| Rooms created explicitly; joins never create | [ADR-0006](docs/decisions/adr-0006-explicit-room-creation-and-join-gating.md) |
| 5-char unambiguous room codes | [ADR-0007](docs/decisions/adr-0007-room-code-format.md) |
| `main` active, `main_backup` archive | [ADR-0008](docs/decisions/adr-0008-branch-structure-main-and-backup.md) |
| Engine: browser WASM + server UCI pool | [ADR-0009](docs/decisions/adr-0009-engine-strategy.md) |
| Weight-agnostic search index | [ADR-0010](docs/decisions/adr-0010-weight-agnostic-search-index.md) |
| External identity accounts (Lichess OAuth) | [ADR-0022](docs/decisions/adr-0022-external-identity-accounts.md) |
| Chat needs edit rights; owner deletes via op | [ADR-0023](docs/decisions/adr-0023-chat-permissions-and-moderation.md) |
| Reference data in Moves' opening-book block; search is a `#/search` destination | [ADR-0024](docs/decisions/adr-0024-reference-tab-and-search-destination.md) |
| Room-first; library supports, never the home | [ADR-0025](docs/decisions/adr-0025-room-first-surface-model.md) |
| Games rail as chrome; the Study Hall redesign IA | [ADR-0032](docs/decisions/adr-0032-games-rail-as-chrome.md) |

For how it all fits together (state model, channel protocol, data flow, testing), see
[`docs/architecture.md`](docs/architecture.md).

## Roadmap

Each milestone ends releasable; deploy is a manual `flyctl deploy` on `main`
(see [`docs/operations.md`](docs/operations.md)).

### Where we are (2026-08-13)

Milestones 1–6 done. Recently landed: one process per room (ADR-0012),
Horde clustering across `ams`/`ord` (ADR-0013), the read-only demo room at
`#/r/chess` (seeded on demand, ADR-0014), idle-room eviction (ADR-0016),
and the second code review's findings — all fixed (the Analysis split into
cursor/editor/keyboard hooks among them). Earlier: the design-system port
(`design/DESIGN-SYSTEM.md` is the UI spec), the in-browser engine,
free-form position setup (ADR-0011), comment popup (`c` key), secrets in
`fly secrets`, and a Playwright MCP for browser checks (`setup-mcp.sh`).
Next candidates: milestone 7 (server engine pool) or 8 (search), or 💡
ideas in FEATURES.md. Both reviews are fully closed (eviction + rate limit,
ADR-0016/0017).

**Spike 01 (position retrieval) is done** — standalone sub-project in
`spike/position_retrieval/` (the app itself is untouched; ADR-0001 intact):
canonical position key incl. the capturable-only en-passant convention,
corpus extraction (Lichess 2017-05), and store benchmarks (PostgreSQL /
SQLite / DuckDB / ETS / purpose-built flatfile) at 100k / 1M / 10M games.
Findings + recommendation:
[`docs/technical-spike-01-position-retrieval-report.md`](docs/technical-spike-01-position-retrieval-report.md).
The durable-storage decision it feeds is deliberately unmade.

**Spike 02 (similarity & relevance)** — candidate generation is built and
measured in `spike/position_retrieval/lib/sim/`
(12 reference positions × 7 retrieval strategies → 144 judgment units,
per-dimension annotations, self-contained eval sheet at
`spike/position_retrieval/data/sim-eval-sheet-100000.html` + judgments TSV
+ `mix spike.sim.tally` loop; the 0–3 TSV itself is still blank — only the
owner's qualitative observations exist). Corpus evidence so far: exact retrieval is
a shallow-position luxury (97.9% of distinct keys occur once); pawn-skeleton
buckets are rich for repeated structures but degenerate to same-game
siblings for cold positions; following-move plan patterns exist but need
move-order-insensitive comparison. Report:
[`docs/technical-spike-02-similarity-and-relevance-report.md`](docs/technical-spike-02-similarity-and-relevance-report.md).

**Spike 02b (from similarity to relevance) is done** — the owner's
qualitative evaluation (brief §3) was grounded in concrete judgment units
(the B1–B4 observations map to reference F1's tempo-twin candidates) and
turned into a testable model: similarity / informational value / query
relevance are separate annotations, never a fused score. Three corpus probes
over the existing 100k artifacts proved the key dimensions derivable:
same-placement/other-stm "tempo twins" (7,970 placements, 3.1% of plies),
move-order route diffs (divergence ply + tempo attribution), and
continuation clustering (A2's exact matches split into Marshall-vs-Closed
families, 43× O-O / 28× d6). Next experiments proposed: continuation-cluster
annotation + tempo-twin retrieval (strategy H), then a focused ~30-unit
re-judgment — not a relevance algorithm. Report:
[`docs/technical-spike-02b-relevance-analysis-report.md`](docs/technical-spike-02b-relevance-analysis-report.md).

**Spike 04 (historical continuation & plan patterns) is done** —
following-move context as a first-class retrieval dimension, measured in
`spike/position_retrieval/lib/sim/continuation*.ex` + `difference.ex`
(29 new tests; `mix spike.sim.continuations` writes
`data/sim-continuation-100000.json`). Answer to the central question:
**yes, conditionally** — continuation content separates same-plan from
different-plan candidates where position similarity is silent (F1's exact
matches split 0.35/0.25 vs 0.00/0.00; the E-strategy cross-structure
candidates all sink 8–14 ranks), and threshold clustering reproduces both
known decision menus cross-game clean (A2's Marshall/Closed at LCS@0.6;
F1's kingside `Ne1 Ne8 {Be3,Nd3,f3} f5` trio merged at multiset@0.5, with
the queenside `b4` family as the next cluster). Two qualifications:
tempo twins defeat content-level similarity (B1 ranks right but scores
low — the typed-difference label carries it), and single linkage chains
at low thresholds/long windows (F1's two plans blob together at
side@0.4/w6). All six qualitative units (F1-B1…B4, F1-F4, A2-B4) get the
right typed difference with the right squares. Recommendation:
annotations + clustering, never a fused score; next is the focused
re-judgment sheet (02b's E4) with these annotations on every card.
Report:
[`docs/technical-spike-04-historical-continuation-and-plan-patterns-report.md`](docs/technical-spike-04-historical-continuation-and-plan-patterns-report.md).

**Spike 05 (contextual-evidence re-judgment) is done** — the E4
re-judgment experiment, built as `Spike.Sim.Rejudge` +
`mix spike.sim.rejudge` in the spike sub-project (7 new tests, 73 green;
`data/sim-rejudge-100000.json` + a self-contained A/B sheet
`data/sim-rejudge-sheet-100000.html`: 13 units × original-vs-contextual
presentation, with typed differences, w4/6/8 continuations, decision-menu
family membership, per-side splits, route diffs and historical context on
every card; cluster signatures cross-validated against Spike 04's
artifact). Answer to the central question: **yes** — 4 of 13 judgments
changed, in both directions, all for structural reasons (A2 up: the other
menu branch; A3 down: singleton one-off; B3 up/reframed: a named side
branch, not "wrong question"; F4 up: h3-deviation mechanically shown to
return to the main family). The load-bearing signals: route/move-order
diffs ("white also played `e3`") + typed differences as one unit, family
membership *with counts and the reference-game marker*, per-side splits
for tempo twins. Documented failures: singleton self-membership (B2/B3/B4
"join" a family containing only their own game) and bare labels without
the route (F3). Spike 06 recommended: plan-skeleton tokenization tested
only against the one documented gap (tempo-flipped continuations can't
join their plan family — B1). Report:
[`docs/technical-spike-05-contextual-historical-evidence-re-judgment-experiment-report.md`](docs/technical-spike-05-contextual-historical-evidence-re-judgment-experiment-report.md).

**Spike 06 (plan skeletons & move-order robustness) is done** — the
Spike 05 gap closed, tested in `spike/position_retrieval/lib/sim/
skeleton.ex` + `skeleton_lab.ex` (16 new tests, 89 green;
`mix spike.sim.skeletons` writes `data/sim-skeleton-100000.json`, 414 ms
of experiments after the shared index load). Answer: **yes, as a per-side
membership layer, not as a clustering representation.** The plan skeleton
(per-color multiset of action tokens — `N→e1`, `Pf→f5`, `O-O`) with
per-color scoring makes **B1 join the kingside family on black's side at
similarity 1.0** (its `{N→e8, Pf→f5, Ph→h6}` exactly equals the `g4 h6`
variant member's black actions; at window 6), and produces sharper
readings elsewhere (B4/F2 as white-queenside + black-kingside hybrids;
A2-B4 = Marshall on black exactly, white's unspent Re1 the non-joining
side). But skeleton *clustering* over-merges — F1's plans blob at 0.5
(exact menu reproduction at 0.6), A2's Marshall/Closed chain at every
threshold (the distinction rides on one pawn token of one side) — so
Spike 04's validated metrics keep building the families and the skeleton
scores membership into them. Negative tests hold (B3/F3/E4 join nothing;
Be3/Nd3/f3 variants stay distinct action sets); singleton
self-membership persists (flag needed); family membership shown without
the positional tier would re-create the confident-garbage failure
(E1-E3). Report:
[`docs/technical-spike-06-plan-skeletons-and-move-order-robustness-report.md`](docs/technical-spike-06-plan-skeletons-and-move-order-robustness-report.md).
Next: the first vertical slice (one FEN → candidates → diffs → route →
families with per-side membership → card), architecture in the report
§9.

**Spike 03 (persistence architecture) is done** — one PostgreSQL
(Fly Postgres, Ecto) for **application data** (profiles, accounts,
library) and the **canonical corpus** (games as validated PGN, sha256
-deduped); position occurrences are *derived/indexed* data, rebuildable
by extraction behind a `Blunderfest.Corpus` module boundary (no corpus
SQL in app code); rooms/ops/presence stay in-memory (ADR-0005
unchanged). SQLite is the designated corpus-side fallback (Spike 01
numbers), the packed binary index the designated successor for
occurrences if the corpus outgrows PG. Notable findings: the current
in-memory Profiles/Library have a latent two-region split-brain
(`ams`+`ord` hold divergent state — durable storage fixes a real bug,
not just durability); positions are *not* first-class entities (the
key is virtual identity, the occurrence row is the stored fact).
Next step: make profiles durable first (smallest entity set, unblocks
the library's cross-device half, exercises the whole Ecto/Fly-Postgres
path before the big corpus data touches it). Report:
[`docs/technical-spike-03-persistence-report.md`](docs/technical-spike-03-persistence-report.md).

**Carried forward: room persistence across deploys — DONE (the
foundation).** ADR-0028 implemented: `Blunderfest.RoomLog` (the
Postgrex boundary on the existing Fly Postgres, two tables) mirrors
every non-cursor op as the room appends it (with an `author_name`
snapshot), persists roles on change, and a room process starting for a
known slug loads its log, roles, and activity time back; the join gate
admits persisted rooms so a join revives them. Eviction purges the
rows; the sweeper's backstop removes rows idle past 1h with no live
process cluster-wide. Replayed chat resolves names from the snapshots.
Verified live: SIGKILL the dev server, restart, rejoin — game and chat
survive. Graceful handoff remains optional polish. 399 backend + 629
frontend tests green.

**Later — durable application data (ADR-0029), the next candidate
taken.** Ecto arrived, scoped to one `Blunderfest.Repo` (ADR-0029
accepted): `profiles` (fun name, salted secret hashes, created_at),
`accounts` (lichess links), `library_entries` (saved game trees) —
boot-time advisory-locked migrations, dev/test point at the docker
Postgres, prod self-migrates from `DATABASE_URL`. `Profiles` and
`Library` are now plain Repo-backed modules with unchanged APIs; the
GenServers are gone. This kills the two-region profile split-brain and
makes the library cross-device. Verified live: create a profile + save
a library entry, SIGKILL the server, restart — the profile
authenticates and the entry lists. ADR-0001/0004/0020/0026 amended.
Open: orphaned-profile pruning; the durable canonical-corpus half of
Spike 03. Also closed: **graceful room handoff** — evaluated and left
out (rooms are `:temporary` and revive via load-on-join, so a handover
protocol would only shave a reconnect the client socket makes anyway;
no observable gain, see ADR-0028's consequences). Search (milestone 8)
is the next spike-gated candidate, awaiting the owner.

### Session handoff (2026-08-28 — redesign direction decided, ADR-0032)

**The room redesign went through an external design loop** — a v0 wireframe
against a prompt kept in `design/DESIGN-PROMPT.md` (hard requirements:
`#c9a227`, mobile+desktop, light+dark, **games are chrome not a tab**).
The frozen spec is `design/DESIGN.md`; the local-only v0 source sits under
`design/v0/extracted/` (gitignored). Critique cycles settled: games rail as
chrome + fixed header with Add-game, header region chip
(`● AMS↔CHI 96ms` incl. tooltip), **Room tab deleted** — the app bar's
mono code chip copies the code, the demo badge rides it, leaving is the
logo, and the dock is Moves · Review · Chat; engine box pinned in Moves,
compact text rows (no miniboards), timeline sparkline.
**ADR-0032 records the decision**; it supersedes the region-structure of
ADR-0031 (presence-as-chrome, the timeline strip, anti-clutter docking,
designed mobile survive). DESIGN-SYSTEM.md §5.2/§5.3/§8 rewritten on the
three-region frame (rail + board column + dock). **Implemented** in
`assets/` — `GameRail` (desktop rail + mobile strip), `RoomCodeChip` +
`RegionChip` in the app bar, Room tab deleted, Reference folded into Moves;
the named acceptance test (rail scrollability at 32 games) passes in the
browser. 642 frontend + 396 backend tests green.

### Session handoff (2026-08-27, evening — the one-sidebar redesign, ADR-0031)

**The room screen was restructured** after a design review (the rail had
accreted four panels, the board column six stacked regions, and the band
amendment had broken the spec's no-page-scroll invariant; mobile was the
desktop DOM in document order). The visual language is unchanged — this
was an information-architecture fix, specced in ADR-0031 and the rewritten
`design/DESIGN-SYSTEM.md` §5.2/§5.3/§8. What shipped:

- **One tabbed sidebar** (Moves · Review · Reference · Chat · Room):
  Review absorbs the old viz box (Moments/Report) + Game info as nested
  tabs; Chat is a tab with an unread badge (the count/read-marker lives in
  RoomView, which also owns the active tab so it survives game switches);
  Room holds the games list + import/new + code/copy/leave + region/lag.
  The left rail is deleted. Empty rooms keep a slim Chat/Room sidebar next
  to the CTA. Tab contents stay mounted (hidden) — analyses and chat
  scrollbacks survive switches.
- **Presence is chrome**: members are an avatar strip in the app bar
  (portaled from RoomView into a header slot; popover = follow/presenter/
  roles), plus a gold **Share** button that copies the room link. The tour
  re-points at the new landmarks (it only targets always-visible chrome —
  hidden tab panels measure 0).
- **Board chrome consolidated**: one toolbar under the board (nav +
  flip/comment icons + a ⋯ overflow with edit position, drawing colors,
  clear drawings); the keyboard-hint row is gone (shortcuts dialog/tour
  cover it). Board width formula no longer subtracts the dead rail.
- **Timeline band is a strip**: collapsed to one sparkline-height
  scrubbable layer by default (first enabled layer with data), toggles in
  a Layers popover, expand chevron for the full stack; layer choice and
  expanded state persist (`blunderfest.timelineLayers` / `…Expanded`).
  Analyze game lives in the strip header, reachable in both states.
- **Mobile is designed, not stacked**: header → one-line title → board →
  toolbar → strip → the sidebar as a fixed-height tabbed panel; board
  never scrolls far away; 635 frontend + 396 backend tests green.

**Follow-up round the same evening (owner-driven, all landed):** the ⋯
overflow menu is gone from the board toolbar (its backdrop swallowed the
next board gesture) — flip/comment/find-examples/edit/draw-colors/clear
are direct icons again, and "Find examples" moved out of the title row
(it's a per-position action, not a game-level one). The collapsed timeline
strip now shows a fixed-order dot per layer (radio group, persisted
spotlight) instead of a jumping text caption; picking a dot enables +
charts that layer, and a dataless layer explains itself in place. The
examples dialog's slide area has a fixed height (cards no longer resize
the modal between candidates). The board is viewport-HEIGHT-driven at xl
(a shared `--board-size` var in app.css; the sidebar height derives from
it) instead of the 34rem cap, and the sidebar widens to 420px at 2xl.
Empty rooms prefigure the real layout (CTA where the board will be,
sidebar in place). Bug fixes: the long-game move list now scrolls inside
the sidebar (a stretched-only flex item was content-growing the board
row — the sidebar has an explicit xl height again), and the demo room is
read-only by slug at init (ADR-0014) — the live #/r/chess had been claimed
and edited via a registry-race restart path; prod rows purged and the
process re-seeded.

**Two pre-existing bugs found and fixed along the way** (both user-reported
symptoms), plus one UI bug: (0) the engine-lines `<select>` popup rendered
white in dark mode (the UA options list doesn't follow the page
color-scheme reliably) — `option` now carries the theme colors in
`app.css`'s base layer. (1) a mid-session device re-heal (401 → new profile minted)
never updated the app's profile state, so a room created in that window
was owned by the new device while the app kept acting as the old one — the
creator landed as a viewer in their own room. `rehealDevice` now dispatches
`DEVICE_REHEALED_EVENT`; `useProfile` re-bootstraps on it (regression test
in App.test.tsx). (2) `Presence.fetch` stripped metas to `:name`, dropping
`phx_ref` — phoenix.js matches metas by ref, so any tab closing evicted
the whole member. The client now syncs presence through phoenix's own
`Presence` helper into a wholesale `syncMembers` replace, and the server
keeps `:phx_ref` in metas (regression tests: shared-key tab close keeps
the member).

### Session handoff (2026-08-24, third session — visualization milestones A/B/C)

**`docs/visualization_ideas.md` partially implemented, three commits**
(band usability round below).
Feasibility was inventoried first: ideas 1–5, 11 are partially/fully
done already; the growth home was decided per ADR-0024's named escape
hatch (a third desktop column was considered and rejected — reasoning
in the ADR amendment). Shipped:

- **Eval-chart enrichment** (`gamePhases.ts`): opening/endgame phase
  shading (endgame = no queens, or both sides ≤ 13 pawns of non-pawn
  material, stable to the tip), dashed endgame boundary named in the
  hover readout, capture markers at the chart's top edge (victim image
  at its ply, Q/R larger, exchange captures ringed and labelled;
  `capturesOf` in MaterialFlow).
- **The timeline band** (`TimelineBand.tsx`): the whole-game charts
  (Eval | Material | Activity | Clocks) moved out of the sidebar viz
  box into stacked, toggleable layers on one shared move axis under
  the board (full row width at xl, directly under the board below —
  `display:contents` row + order utilities). New `spanPly` +
  `heightClass` props on the three charts; layer visibility persists
  in `localStorage` (`blunderfest.timelineLayers`); ADR-0024 amended.
  The viz box keeps the list views (Moments | Report), always present.
  Browser-verified: band spans the row exactly at 1500px, mobile
  order board→band→sidebar, scrub navigates, no horizontal overflow.
- **Move-time data + Clocks layer**: Lichess exports fetched with
  `clocks=true` (both import paths funnel through `export_pgn`), the
  parser extracts `[%clk]` into a first-class `node.clock` field
  (ops validation accepts the optional number; PGN export round-trips
  it), `moveTimes.ts` derives think time (clock drops + TimeControl
  increment), `ClocksFlow` charts log-scaled bars as a band layer.
  Clocked moves no longer wear the "has a note" glyph.

558 frontend + 248 backend tests green (`mix precommit`, `pnpm lint`/
`typecheck`/vitest). Deferred next: pawn-structure/king-safety/
center-control as drop-in band layers, board overlays (heatmaps,
trajectories) via Board props + BoardControls toggles, motif
detection, Report radar, true best-vs-played delta (engine protocol),
corpus-gated opening stats. Note: `mix phx.server` serves the stale
`priv/static` build on :4000 — verify UI against the Vite dev server
on :5173 (API proxied).

**Later the same session — usability round after owner review (four
more commits, 564 tests green).** (1) Games-panel Import/New buttons
moved into the panel header as icon buttons (the game header's
export/bookmark pattern) — the old bottom row wrapped at the rail
width. (2) **Black think-times bug**: moveTimes compared each move
to the previous node's clock — the *opponent's*; black's time went
negative (bar silently dropped) whenever black was ahead on the
clock. Per-side chains now (first move of a side vs the initial
TimeControl clock, later vs its own previous clock); bars are
side-colored (white near-white, black silver) with the side named in
the tooltip and a W/B legend on the layer caption. (3) Timeline-band
legibility: persistent caption per layer (hue dot + label), per-chart
hues (eval near-white, material silver, activity blue — de-twinned),
chips wear the same dots, and the whole-game **Analyze action moved
to the band header** — it used to live in the eval layer's
placeholder, so toggling that chip off removed the only path to an
analysis (Moments/Report dead ends). (4) Position-editor palette
drags place **once, on release** (sweep-painting stays a
board-pressed gesture) — dragging from the palette used to paint
every square the ghost crossed.

### Session handoff (2026-08-27 — private examples browsing, ADR-0030)

**The Examples tab became a private browsing dialog.** Owner decision
after living with the shared run for a while: sharing the whole
candidate list (via the transient `evidence_run` broadcast) was the
wrong unit — members care about the games someone picks, not what
someone is still browsing. Implemented:

- **`HistoricalEvidenceDialog`**: "Find examples" moved out of the
  sidebar (the Examples tab is gone — the sidebar is Moves | Game info
  | Openings again) into the board header next to Export PGN / Save to
  library, editors only. It opens a modal carousel over the candidates
  for the cursor's position: one slide per candidate with a static
  board at the candidate position (flipped to the side to move) plus
  the facts card. Prev/next (buttons, ←/→ keys), "i of n" counter,
  Esc/backdrop close; the query runs privately on open (frozen
  request, so a remote move can't change it under the dialog) and
  finished analyses stay in the session cache (`evidenceCache.ts`), so
  reopening the same position never re-runs the corpus query.
- **Only picks are shared**, as ordinary ops: "Add to room"
  (`set_game` + `evidence_gid` + `openAtPly` + fingerprint dedupe) and
  "Add as variation" — all the existing echo-proven button states
  ("Adding…" → "Added ✓", "Same game — already added") carry over.
- **No auto-advance on picks** (owner call: a candidate can be added
  as a game AND as a variation without navigating back and forth) —
  the button flips and the user browses on.
- **Removed the shared-run machinery**: `evidence_run` channel
  handler + validator, the channel listener/push, the Redux
  `evidenceRun` state, and the `sharedEvidenceRun`/`onEvidenceRun`
  prop threading through RoomView/Analysis/AnalysisSidebar. Viewers
  now see nothing in-place; picked games arrive to them as ops, same
  as any add.
- ADR-0030 records the decision; `architecture.md` updated. Follow-up
  noted: an in-game move browser inside the dialog (fetched PGN
  playback) is deferred. 622 frontend + 396 backend tests green.

### Session handoff (2026-08-26 — Analysis split + band owns the analyze job)

**Two design chats settled, both implemented.** (1) The ~1370-line
`Analysis.tsx` split into region components: `Analysis` is now the
~700-line orchestrator (all viewer state, derived data, handlers); the
three screen regions are pure presentation — `BoardColumn.tsx` (title
row, board, eval bar, palettes, nav, comments, board controls, plus the
moved `PaletteStrip`/eval-label helpers), `AnalysisSidebar.tsx` (the four
tabs + the viz box), and `VizBox.tsx` (Moments/Report tabs). No context
introduced (the regions share nearly all state; a provider would
re-render everything on every eval tick). DOM/testids unchanged, so the
existing test suite held as the integration net. (2) **The timeline band
header owns the whole-game analyze job's lifecycle** — "Analyze game"
before any evals, live progress while a job runs, "Re-analyze" when the
mainline outgrew the analysis — always reachable whatever layers are
toggled (the previous design hid it after the first run and resurfaced
Re-analyze in the engine box, two homes for one job). The engine box
keeps only line-scoped "Analyze line", and the eval chip wears a small
 gold needs-analysis marker until a job has run (it is the only layer
that depends on one). 598 frontend + 382 backend tests green.

**Later the same session — Examples-tab usability (five owner-reported
issues, all fixed).** (1) Tab switches emptied the Examples list:
`SidebarTabs` now keeps every tab's content mounted and hides inactive
panels (`hidden` attr + class) — results survive switches by contract
(tested with a counter). (2) "Add to room" opens the game at the
candidate's move: the adder records the ply in `openAtPly` (gameId →
ply), and `Analysis`/`useCursor` gained `initialNodeId` (init order:
`startAtRoot` → last played → initial node → tail). (3)+(4) Both card
actions now report and de-duplicate: "Add as variation" shows
"Adding…" until the echo lands, then "Added ✓" — the exists state is
derived from the tree (`variationState` in Analysis: the plan from
`planHistoricalVariation` checked against the child chain with the same
from/to/promotion descent `applyAddLine` uses, so it can never disagree
with the insertion; a 5s timeout covers rejected ops; non-playable lines
disable the button with a tooltip). "Add to room" flips to "Added ✓"
once fetched (session-scoped gid set). (5) "Add to room" no longer
steals the view: no `select_game` to the new game, no cursor switch —
the game lands in the Games panel for later; a presenting adder
  re-points the room with `select_game` back to the viewed game (the
  presenter's own `set_game` otherwise counts as focus and would drag the
  room along). 607 frontend + 382 backend tests green. Also reviewed: the
  single Redux slice is judged correct — see the session notes.

**Later the same session — per-game cursor memory.** Switching games
remounted Analysis, so each switch back reopened the game at the tail —
the user's place was lost. `RoomView` now keeps `cursorByGame` (game id →
last locally viewed node), fed by a new `onLocalCursor` signal from
`useCursor` (every local cursor change — navigation, init, follow-tail,
rollbacks — regardless of presenting; `onCursorChange` stays the
presenter-only broadcast). The stored node feeds `initialNodeId` (after
`openAtPly`), so each game reopens where it was left. Local state on
purpose: cursors are per-viewer, never broadcast or stored. RoomView
integration test covers the two-game switch-back loop. 608 frontend +
382 backend tests green.

**Later the same session — Examples follow-up (four owner-reported
issues).** (1) Switching games cleared the Examples list: finished
analyses are now remembered per request (position + route + ply) in a
small session cache, so a game switch — which unmounts the panel —
restores the results instantly; a re-run still re-fetches. (2) The card
headline no longer claims "same position" unless the placement AND the
side to move match: one piece moved plus a tempo flip means the
candidate is a half-move off, and the headline is route-aware — "One
move on — the candidate played Nge7" when the route names the extra
move, "One move before this position" on a negative ply gap, with a
plain "One piece differs · other side to move" fallback. (3)+(4) Add to
room de-duplicates: RoomView checks the fetched game's PGN fingerprint
against the room's games and skips the `set_game` when it is already
there (the analyzed game itself included), and tracks added corpus gids
in `evidenceGids` (fed back via `addedGids` through
Analysis/AnalysisSidebar), so "Added ✓" survives panel remounts — no
more duplicate adds after switching games and re-finding the examples.
  615 frontend + 382 backend tests green.

**Later the same session — Examples polish (three owner-reported
issues).** (1) The analyzed game itself no longer appears among its own
examples: the panel filters candidates whose meta (players + result)
matches the analyzed game's PGN headers — showing the game you are
looking at as "historical evidence" for itself is noise. A partial
header match keeps the candidate. (2) "Find examples" disables once the
results for the viewed position are shown (re-running would repeat the
same corpus query); it re-enables when the cursor moves (stale) or a
run fails. (3) The loading state now reads "Searching the game
corpus…" with the pulsing status dot instead of a bare "…". 619
frontend + 382 backend tests green.

**Later the same session — cursor yank, dot mystery, button visibility.**
(a)+(d) Root cause found for the disappearing examples / "position
changed" ghost: the follow-the-tail cursor effect treated the viewer's
OWN variation inserts (the `set_position` + `add_line` pair, or a
one-move line) as moves to follow, yanking the cursor off the analyzed
position — the panel then flagged its results stale, and the per-game
cursor memory remembered the new position, so the examples were gone
after a game switch. The store now tracks who played last
(`lastPlayedBy`), and follow-the-tail only reacts to OTHER members'
plays (`remoteLastPlayedId` through Analysis → useCursor); the initial
cursor on open still uses the unfiltered `lastPlayedId`. Reproduced the
user's exact flow in the browser against the local corpus
(voncul–kel2zad22 etc. — adding multiple games works as intended;
the add-game path itself never moved the cursor, so (a) is the stale
list after a variation add). (b) The green dot before the first engine
line is the engine's status dot (ready/thinking) — it now explains
itself in a tooltip ("Engine ready — lines shown are for the current
position"). (c) The card action buttons are `secondary` (raised)
instead of `quiet` (ghost) — noticeably present without shouting. 622
frontend + 382 backend tests green.

**Later the same session — the engine status dot moves to the box
header (owner-directed).** The dot was never a property of the first PV
line — one engine, one status — so it now lives in the "Engine · Depth
…" bar (green ready, pulsing gold thinking, red error, faint when the
engine is off, tooltip in every state); the PV lines render uniformly.
623 frontend + 382 backend tests green.

**Later the same session — UI stress test + the findings fixed.** A
two-user Playwright pass exercised every feature (imports incl.
multi-game PGN, moves/variations, engine controls, comments/NAGs,
position editor, drawings, chart scrub, band layers, whole-game
analysis via the server pool, reference tab, examples, export/library,
chat + moderation, roles/promotion, presence/following, tour,
shortcuts, keyboard nav, mobile layout — no horizontal overflow).
Findings fixed: (1) **Navigation slowed down after running examples**:
the deployed panel planned 20+ candidate variation lines (chess.js SAN
resolution) on EVERY cursor move — profiled at ~830ms per landing. The
button-state check is now gated on a current result, the deterministic
resolution is cached module-wide, and the cache is warmed while the
corpus query runs (the resolution hides under the "Searching…" note).
Measured after: ~35ms/move on the prod bundle, landings included. (2)
**Examples are now synchronized**: a run broadcasts a transient
`evidence_run` message (never an op — replays must not re-run corpus
queries); members whose cursor is on that position run the same query
automatically. (3) **Add-to-room state is now synchronized**: the
`set_game` op carries the corpus `evidence_gid`, and every client
derives "Added ✓" from the op log (fingerprint guard unchanged for
non-corpus duplicates; the clicking client still gets the local mark
on that path). (4) **Per-game cursor precedence**: switching back to a
game now restores the last VIEWED node even when moves were played
since (`initialNodeId` before `lastPlayedId`; a refresh still opens at
the last played move, since the memory is empty then). 628 frontend +
386 backend tests green.

**Later the same session — sync follow-ups + a real stress run (four
owner-reported issues).** (1) Examples sync still failed for the
second user: the shared-run auto-execution was gated on `canAnalyze` —
viewers (an anonymous second browser) could never see an editor's
shared results. The gate is gone (viewers still can't initiate a run;
seeing shared results is read-only). (2) The card buttons now render
with fixed label widths, so "Add to room" → "Same game — already
added" swaps never shift the sibling button. (3) The disabled
add-to-room button was the same corpus game at another position (the
list surfaces one game at several plies): the label now says exactly
that — "Same game — already added" — instead of an ambiguous "Added
✓". Verified by reproduction: 21 cards → 12 distinct games added;
different games between the same players (hout14–pilocl 1-0 vs 0-1)
both added fine. (4) Honest stress test at scale: a generated 100-game
PGN (33 KB, random legal games via chess.js) imported in one go, two
users, 30+ moves, comments/NAGs, 21 chat messages, 2 whole-game
analyses (99 evals), 74 cursor ops. Measured from the join payload
(the client's replay = its Redux room slice): **100 games, 256 ops,
4,924 nodes, 1.11 MB**; join+replay 3.2 s; cursor navigation 33
ms/move; game switch 43 ms. Headroom confirmed (5,000-op cap). 628
frontend + 386 backend tests green.

### Session handoff (2026-08-24, second session — continued after an engine switch)

**Spike 06 (plan skeletons & move-order robustness) done, spike-only
session.** Executed `docs/technical-spike-06-plan-skeletons-and-move-order-robustness.md`:
two new modules in the spike sub-project (`Spike.Sim.Skeleton` — the
action tokenizer (`N→e1`, `Pf→f5`, `O-O`) plus three color-aligned
representations (`:skeleton` per-color action multisets, `:skeleton_seq`
per-color ordered, `:skeleton_phase` half-window buckets) with per-color
similarity scores; `Spike.Sim.SkeletonLab` — the experiment driver:
representation census, decision-menu clustering sweeps against Spike 04's
validated baselines, per-side family membership for the 13 Spike 05 units
+ the F1-E negatives, and family→variation tables), the
`mix spike.sim.skeletons` task, 16 new tests (89 green), one full run at
the 100k tier writing `data/sim-skeleton-100000.json` (414 ms after the
shared ~3 min index load; a second run after a memory-kill succeeded).
The falsifiable test passed: B1 joins F1's kingside family **on black's
side at 1.0** (exact action-set match vs the `Ne1 Ne8 f3 f5 g4 h6`
member, window 6 — window 4 still misses, `…f5` not yet played), and the
separations survived (trio variants distinct; Marshall/Closed apart in
the membership view; B3/F3/E4 join nothing). Documented failures:
skeleton *clustering* chains (F1 blob at 0.5 despite exact reproduction
at 0.6; A2 never separates — the Marshall/Closed distinction rides on
one pawn token of one side, and the mean per-color Jaccard rewards the
other side's full match), singleton self-membership persists, and
family membership without the positional tier re-creates the
confident-garbage failure (E1-E3). Recommendation: skeleton as per-side
membership/annotation layer on Spike 04 families; keep validated metrics
for clustering; drop `:skeleton_phase`; vertical slice next (report §9).
Member-level verification via two one-off probes (`tmp/skeleton_probe.exs`,
`tmp/a2_probe.exs`, untracked). Nothing in the app touched; the spike
sub-project code stays untracked (gitignored `spike/`), brief + report
committed.

### Session handoff (2026-08-23, second session)

**Spike 05 (contextual-evidence re-judgment) done, spike-only session.**
Executed `docs/technical-spike-05-contextual-historical-evidence-re-judgment-experiment.md`:
two new modules in the spike sub-project (`Spike.Sim.Rejudge` — the
13-unit card builder: typed differences, w4/6/8 continuation windows vs
the reference's own, decision-menu family membership (single-linkage over
the exact occurrences at Spike 04's validated settings), per-side
continuation splits, route/move-order diffs with per-side extra-moves
tempo attribution, occurrence counts; `Spike.Sim.RejudgeSheet` — the
self-contained A/B HTML sheet showing every unit in its original Spike 02
presentation next to the contextual one, with the brief's §6 questions
attached), the `mix spike.sim.rejudge` task, 7 new tests (73 green), one
full run at the 100k tier writing `data/sim-rejudge-100000.json` +
`data/sim-rejudge-sheet-100000.html` (<1 s of computation after the
shared ~3 min index load). Menus reproduced Spike 04's published cluster
signatures exactly (F1 13/8/2/1×5 multiset@0.5/w4, A2 36/19/4/4/3/2/2/1
LCS@0.6/w4). The agent acted as evaluator (non-blind; the six grounded
units' baselines are the owner's documented 02b readings, the seven new
units got a genuine two-pass A/B) — the sheet is the instrument for an
owner re-run. Deliverable — the 05 report (linked above): setup, the
before/after table (4 changed / 9 unchanged), changed and unchanged
judgments with reasons, the five useful signals and four unhelpful ones
(singleton self-membership is the new one — future UI needs a "family
contains only this game" flag), search-engine implications (evidence,
never a fused score), and the tightly-scoped Spike 06 recommendation
(plan-skeleton tokenization vs the tempo-flip family-joining gap only).
Nothing in the app touched; the spike sub-project code stays untracked
(gitignored `spike/`), brief + report committed.

### Session handoff (2026-08-23)

**Spike 04 (continuation & plan patterns) done, spike-only session.**
Executed `docs/technical-spike-04-historical-continuation-and-plan-patterns.md`:
three new modules in the spike sub-project (`Spike.Sim.Continuation` —
five continuation representations + LCS/multiset-Jaccard/per-color
similarity; `Spike.Sim.Difference` — the typed differences: tempo_twin,
near_twin, piece_setup, king_position, material, structure +
same_plan/timing_shift/plan_divergence; `Spike.Sim.ContinuationLab` —
the four-experiment driver behind `mix spike.sim.continuations`), 29 new
tests (66 green), one full run at the 100k tier writing
`data/sim-continuation-100000.json` (11 s of experiments after the shared
~3 min index load). Deliverable — the 04 report (linked above): setup,
the census/cluster/diff/ordering results with concrete sequences, the
position-only vs position+continuation comparison, the six-unit
qualitative validation, five failure cases (incl. single-linkage chaining
and a latent `Spike.Corpus` EOF bug that silently drops a final game
without a trailing blank line — deliberately **not** fixed: it would
desync fresh extractions from the published TSVs), complexity, and the
recommendation (continuation as annotation + clustering, E4 re-judgment
sheet next, plan-skeleton tokenization as the one representation upgrade
worth testing). Nothing in the app touched; the spike sub-project code
stays untracked (gitignored `spike/`), brief + report committed.

### Session handoff (2026-08-20)

**Spike 03 (persistence) done, docs-only session.** Executed
`docs/technical-spike-03-persistence.md`: a synthesis over Spike 01's
store benchmarks, Spikes 02/02b's search requirements,
`storage-options.md`, and the current code. Deliverable — the 03
report (above): data model (profiles/accounts/library + corpus_games;
occurrences derived), canonical-vs-derived-vs-indexed classification,
ten access patterns with measured numbers, PG evaluation with
alternatives rejected on stated grounds (SQLite kept as fallback),
one-server-two-schemas architecture diagram, the `Corpus` boundary
(one module tree + "app code never writes corpus SQL"), idempotent
sha256 import with per-batch transactions and dump-as-checkpoint
resume, truncate-and-rebuild index strategy (app schema + PGNs are
the backup set; occurrences excluded), six open questions, and the
next step (durable profiles, with a new ADR superseding ADR-0001 for
application data). Also committed: the owner's pending Spike 02b docs
(report/brief/lessons + PROJECT/docs index updates) and a `pgn.ex`
style fix. 242 backend tests green. Nothing else in the app touched —
the Ecto/Postgres introduction is the *next* session's milestone, and
needs the user's explicit go (it amends ADR-0001).

### Session handoff (2026-08-19)

**Spike 02b (relevance model) done, docs-only session.** Executed
`docs/technical-spike-02b-relevance-analysis.md`: grounded the owner's
qualitative observations in the actual judgment units (B1–B4 = reference
F1's tempo-twin candidates; F1-F4's h3-vs-castling and the A1-vs-B1-E1
phase clash confirmed from the candidates JSON), then ran three one-off
corpus probes over the existing 100k artifacts (no new extraction, app
untouched, scripts kept out of the repo): (1) same-placement/other-stm
"tempo twins" — 7,970 placements / 3.1% of plies, F1's own placement has
28× w + 2× b; (2) move-order route diffs — F1 vs its twin diverge at ply 7
(e4 vs e3), tempo mechanically attributable; (3) continuation clustering —
A2's 71 exact matches split into the Marshall/Closed decision menu (next
move O-O 43× vs d6 28×; multisets merge transpositions, correctly keep
plan variants apart). Deliverable — the 02b report (above) with
detectability per dimension, failure modes (incl. new tempo-blindness),
four small falsifiable experiments (E1 continuation clusters, E2 tempo-twin
retrieval, E3 consequence proxy, E4 focused ~30-unit re-judgment) and the
recommendation: build E1+E2, never a fused relevance score. The judgments
TSV remains blank by design — the formal 0–3 scoring waits for the focused
sheet. Nothing committed (spike docs are owner WIP per the conventions
below).

### Session handoff (2026-08-17)

**Chat permissions tightened (ADR-0023), shipped.** Viewers can no longer
post to room chat — owners and collaborators only (enforced in
`Room.submit_op` alongside the edit-op check; anonymous members can hold no
role, so they're excluded too). The owner can delete any message: a
`delete_chat` op naming the message's seq rides the op log like everything
else, and every client filters deleted seqs out of the visible history (the
original chat op stays in the log — append-only, ADR-0005). The UI: viewers
get a one-line "read along" hint instead of the input; the owner gets a ×
per message. 241 backend + 489 frontend tests green. The persistence
spike is done (Spike 03, 2026-08-20) — durable accounts / cross-device
library are now unblocked, waiting only on implementation.

**Later the same day:** the "learn from this game" report landed — a fifth
viz-box tab (Eval | Moments | Report | Material | Activity) with per-side
accuracy (lichess's per-move win-share-loss curve, a documented
approximation: no volatility weighting, no book exclusion), ??/?/?!
counts, a result + mainline-opening header, and every marked move with its
eval swing and the engine's best alternative, click to jump. Marks reuse
`moveMark` exactly, so report, move list and chart never disagree.
`winShare` moved from GameFlow to uci.ts. Two UI fixes rode along: the
room rail was capped at board height while the analysis sidebar gets board
+13rem — the squeeze gave Members a scrollbar with 2 members and pushed the
chat input over its panel's bottom border; the rail now matches the
sidebar's cap and ChatPanel is `shrink-0` (the squeeze lands on the
scrollable panels). And all five viz tabs are always present: Material and
Activity show a text placeholder until the game has moves (previously they
popped into existence on the first move). 502 frontend tests green.

**Layout direction decided (ADR-0024/0025), docs-only session.** The
growth question ("the screen has been growing since the start"; opening
book/tree, endgame table and extensive search are coming) was brainstormed
and settled: per-position reference docks in a new adaptive **Reference
tab**, whole-game views own the viz box exclusively, and search is a
**`#/search` destination** whose results enter rooms as a game or
variation. Endgame table deferred (a corpus can't provide tablebase
truth). The ChessBase alternative (database-first workspace home,
docked-pane room) was evaluated and rejected: room-first stays even with
a durable library ("a user lands in a room, backed by their library"),
and even ChessBase's own web apps dropped the MDI/ribbon model. All of it
is spike-gated — the corpus API unblocks Reference + search.

**Reference tab v0 shipped (corpus-free).** The ADR-0024 tab exists and
works without the spike: `continuationsFor` (openings.ts) computes the
named book continuations of the cursor position from the static
`openings.json` (3,809 positions); the panel descends locally (no ops),
re-anchors when the cursor moves, and editors insert the browsed path via
`add_line` — the engine-line gesture. ADR-0024 was amended at
implementation: the tab shows a text placeholder when off-book instead of
hiding (consistent with the viz tabs). **Revised the same day:** rows now
*play* the move (real broadcast op — the panel's re-anchor makes the
descent free) and preview it as a ghost arrow on hover; the local descent
+ insert machinery was deleted. Viewers preview only. Post-spike, the rows
gain corpus statistics; the tab itself doesn't change. Dev-ops note: `mix phx.server`
spawns Vite itself via the endpoint watcher — a manually started Vite on
5173 crashes it ("port in use"); just run `mix phx.server`.

**Analysis gaps closed (user-raised):** variations can now be analyzed
("Analyze line" in the engine box, evaluating the viewed line's segment
branch→tip) and a mainline that outgrew its analysis offers "Re-analyze".
The mechanism: `analyze_game` positions carry the clients' deterministic
node ids, so evals are node-keyed and `set_analysis` ops **merge per
node** (a re-run overrides its positions; a line analysis adds its
variation without clobbering the mainline's). Variation rows show marks
from their own line (the branch's eval bridges the junction); chart/
moments/report stay mainline-scoped by filtering to mainline node ids.
Two bugs found by browser verification: `linePath` returned a non-null
path with empty nodes for pending moves (crash in variationPositions —
now null), and a 1-position analysis never triggered staleness (the
chart's ≥2-point rule leaked into it).

**Blunder flags while dragging shipped** — the last open item from
milestone 4's engine scope. `useDragFlag` runs a *dedicated second*
engine instance (the main analysis keeps its worker): hover a drag
target, get a 100ms search on the candidate, and the loss against the
main analysis' baseline becomes a ??/?/?! badge on the hovered square —
`markForLoss` is the shared threshold helper now, so flags, move-list
marks, chart dots and the report can never disagree. Editors only,
nothing broadcast (the engine is per-viewer); the flag needs a ready
baseline (no guesses while the engine thinks). `Board` gained
`onDragHover` (drop-end/cancel reports null) and the `dragMark` badge.
Milestone 4's engine scope is now fully closed.

### Session handoff (2026-08-16)

Since 2026-08-13 the analysis UI went through a big usability-driven,
lichess-inspired evolution (all shipped and deployed; 185 backend + 422
frontend tests green). What landed:

- **Layout**: navigation controls under the board always; one combined
  analysis panel (engine box with on/off + hint arrows, MultiPV 1–5, move
  list); sidebar height capped to the board column at xl; Settings tab
  removed; the app bar is app-level only — room actions live in a Room
  panel atop the rail (code/copy/leave, read-only badge).
- **Viz box** (Eval | Moments | Material | Activity, uniform height):
  game-flow eval chart (cp/win% toggle, blunder dots, book-exit marker,
  real WDL via `UCI_ShowWDL`), critical moments as mini boards, material
  timeline, piece-activity (mobility) timeline — the last two are pure
  FEN data, no engine (template for `docs/visualization_ideas.md` items).
- **Collaboration**: presenter handoff — the owner passes the mic to any
  member (ADR-0021); connection telemetry in the Room panel (10s `ping`
  probe → lag; you-vs-room region split asked on the room's node).
- **Games**: bulk PGN import (multi-game split + preview, imports all);
  export/save as header icons; the bookmark is membership-aware via PGN
  fingerprint until games have real ids.
- **Fixes worth remembering**: terminal positions store the game result
  instead of a sign-breaking `mate 0` (the mate-as-blunder bug);
  `createRoom` sends device credentials (ownerless-room race); API 401s
  re-heal the profile and retry (`withDeviceRetry`); ImportDialog mobile
  overflow.

Design stance going forward (user, 2026-08-16): *be flexible in how the UI
evolves — usability beats the earlier no-shift/no-scrollbar dogma, but do
it wisely.*

**Next up (user-requested, in order):** all three landed 2026-08-16, plus
two mobile fixes reported the same day. Later on 2026-08-16: mixed
multi-source imports (line-wise split: `https://lichess.org` lines →
Lichess, rest → PGN; bare ids dropped), import copy pluralized, the
activity feed removed (product call), the multi-import presenter-focus
fix, two features (**engine line → variation** — atomic `add_line` op —
and **NAG glyphs**), nested variations as indented blocks with a
line-path breadcrumb, and the zoom-safe tour tooltip. A persistence
spike is in flight (user) — search/accounts/durability wait on it.

**Lichess OpenID (ADR-0022) — all three phases landed 2026-08-16,** with
the model the user designed: one "Sign in with Lichess" action — the
callback binds new accounts to the current profile and adopts the known
profile when bound (names follow the binding across browsers; fun names
are temporary by design), "Sign out" detaches and clears the mapping.
Scope is `study:read` only (games endpoints are public — there is no
`game:read` scope; learned live). Lichess needs no app registration
(unregistered public PKCE clients; client id is any unique string).
The lichess knight mark is inlined from lila (AGPLv3, compatible with
our GPLv3; attribution in the cburnett NOTICE.txt). Import dialog tabs:
Paste | My Lichess studies (every chapter imports) | My games
(multi-select recent games) | **Chess.com** — username-driven monthly
archive browsing with multi-select, strictly via the official public API
(their robots.txt/User Agreement forbid callback/service endpoints and
scraping; checked before building). **Room chat** rides the op log
(`chat` op; replay = history; any member can write). **Canonical URL is
`https://blunderfest.org`** — `blunderfest.fly.dev` is the raw Fly
domain and doesn't work properly (CORS etc.). The persistence spike
(Spike 03) is done — see the 2026-08-20 handoff; account durability
and the game library's cross-device half wait only on implementation.

1. **Room panel location display** — DONE: region/lag is one compact
   truncating line inside the box, under the code/copy/leave row.
2. **Guided tour** — DONE: hand-rolled spotlight (box-shadow dim +
   tooltip), `data-tour` landmarks, steps that don't resolve are skipped.
   Room-only, from the app-bar help menu (user review: the landing page
   needs none, no auto-start), which also revived the (previously
   unreachable) keyboard-shortcuts dialog.
3. **Bulk import** — DONE: `PGN.parse_many/1` is per-game now
   (`{:ok, trees, failures}`); the dialog lists skipped games with reasons
   and imports the rest. Reproduced with a real 5-game lichess export
   (Chess960/Antichess/Horde fail, standard games import).
4. **Mobile fixes** — DONE: the analysis wrapper shrink-wrapped to
   max-content and let the page pan sideways once PV lines rendered (now
   `w-full`/`max-w-full` down the chain; vw-fixed widths are min-content
   landmines — cap with max-w instead); the move list's `scrollIntoView`
   dragged the page — it scrolls only its own container now; `1-0` no
   longer wraps at the hyphen in the eval-bar label, title row, or engine
   badge. The eval bar also bled over the rail at md (768–900px): the
   board width formula ignored the rail — it subtracts it at md now, and
   the slot margin applies whenever the bar hangs out of flow. Viz box
   tabs carry one-line captions explaining each visualization.

**Session notes for the next session:**

- Checks: `mix precommit`; in `assets/`: `pnpm lint && pnpm typecheck &&
  pnpm exec vitest run --pool=forks`. Deploy: commit → push → `flyctl deploy`.
- Vite exits silently on closed stdin — start it as
  `(tail -f /dev/null | node node_modules/vite/bin/vite.js &)`. Kill dev
  servers with `fuser -k 4000/tcp 5173/tcp`.
- Engine-free local runs: `STOCKFISH_PATH=/tmp/opencode/fakefish.sh mix phx.server`.
- Two profiles in one browser context are impossible (shared localStorage =
  one identity). For a second profile: `POST /api/profiles` via fetch,
  `localStorage.setItem('blunderfest.device', …)`, reload **via about:blank**
  (same-URL navigation does not reload).
- Playwright screenshots land in the repo root — delete before committing.
- Never stage/commit the user's WIP: `spike/`, `screenshots/`,
  `docs/technical-spike-*.md`, `docs/evaluation.html`,
  `docs/visualization_ideas.md`, `docs/glossary.md`,
  `docs/functional-design.md`. Stage own files explicitly; zsh executes
  backticks inside commit messages.

1. **Boot** — DONE. Phoenix 1.8 / React 19 + Vite + TypeScript building into
   `priv/static`, `/api/healthz`, channel socket, i18n scaffold, Dockerized
   release, Fly config, in-memory state (ADR-0001).
2. **Anonymous profiles** — DONE. Fun name + device secret, salted hashes, zero
   stored PII, bearer auth (ADR-0004).
3. **Import** — DONE. PGN paste and Lichess URL import → variation tree, shared
   in rooms. (In-memory storage; "DB" only when a DB exists.)
4. **Solo board** — DONE. Hand-rolled board, navigation, arrows, highlights,
   comments, Stockfish WASM eval bar + best-move hints (ADR-0009), blunder
   flags while dragging.
5. **Rooms** — DONE. Channel per slug, op-log sync (ADR-0005), presence, roles,
   cursors, multiple games. Remaining: profile game library.
6. **Save/export** — DONE. Annotated PGN export (client-side serializer,
   setup analysis as extra games) and the per-profile game library
   (session-scoped, ADR-0020). The durable, account-bound half of claiming
   waits on the storage decision.
7. **Server engine pool** — DONE. UCI workers, whole-game reports, eval charts (ADR-0009).
8. **Search** — position extraction job, weighted similarity metric + decomposition,
   golden-fixture tests, bulk corpus import, configurable search UI (ADR-0010).

## Development conventions

- Keep this file current: roadmap statuses, and anything a fresh session needs.
- Record significant decisions as ADRs in `docs/decisions/` at decision time.
- Commit in small, milestone-scoped steps.
