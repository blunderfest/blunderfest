# Product Experiment 01 — Historical Decision Menu

**Status:** Implemented (2026-08-29). Spike 07's smallest-experiment recommendation,
shipped behind the existing vertical slice.
**Brief:** `docs/product-experiment01-historical-decision-menu.md`.

---

## Implementation

The Historical Examples dialog now shows the **next-move distribution with
independent-game counts** between its header and the example carousel.

### What changed

**Backend (additive; families untouched, brief §13):**

- `lib/blunderfest/corpus/analysis/decision_menu.ex` — new module with two
  entry points:
  - `build/1` — from `{gid, ply, sans}` occurrence triples;
  - `from_occurrences/2` — from the pipeline's `{gid, ply}` occurrence list and
    a move-fetch function (`Corpus.moves/1`), with the pipeline's
    duplicate/unfetchable guards.
  - Each produces ordered `%{move, games}` rows (count desc, tie by name).
- `lib/blunderfest/corpus/search/pipeline.ex` — the reference block gains
  `next_moves: [...]` alongside the (untouched) `families: [...]`.
- `lib/blunderfest/historical_evidence.ex` — the DTO carries `next_moves`
  through to the wire; nothing else changed.

The continuation-family clustering (`Families`) was **not modified**; the new
module computes the distribution *before* the family builder ever sees the
entries.
The ★ref family marker, representative-game selection, and count-wording
remain out of scope exactly as the brief demanded (§13/14/15).

**Frontend:**

- `src/features/historicalEvidence/DecisionMenu.tsx` — renders
  `reference.next_moves` (missing → nothing; oldest-first; collapses past 6
  behind a "Show N more" toggle; heading derives the side from `fen`),
  purely informational per brief §11 (no click) and §18 (no eval-like
  markers).
- `src/features/historicalEvidence/types.ts` — `NextMoveRow` type;
  `reference.next_moves`.
- `src/features/historicalEvidence/HistoricalEvidenceDialog.tsx` — the
  component is placed between the header and the carousel.
- `src/i18n/locales/en.json` — `menuWhat` / `menuSide` / `menuGame` / `menuGames`
  / `menuShowMore`. (The preexisting `evidence.menu` / `evidence.menuNone`
  strings exist and remain unused.)

**Tests:**

- Backend: 5 `DecisionMenuTest` cases (distribution, double-count guard,
  ordering, empty-continuation skip, `from_occurrences` guards) + 3
  pipeline-level assertions on the research fixture (F1 counts
  `Ne1 3/Bd2 4/Qc2/Nd2/Rb1 1`, sum-of-pairs 10 guarded by `gid 12`/`gid 13`
  repeated-position semantics, wire shape, A2 `O-O 2 / d6 2`).
- Frontend: 6 `DecisionMenuTest` (F1 counts, A2 kept apart, side-to-move from
  FEN, empty → null, collapse/expand) + 2 dialog-level (menu present before
  the carousel, absent when `next_moves` empty).

---

## Data semantics

The menu is computed from the raw `{gid, ply}` occurrence list — *before*
clustering, which is exactly where the gid information is available, and
which the family pipeline deliberately drops.

For each distinct development:

1. Take the occurrence's first move (`Enum.drop(sans, ply) |> hd`).
2. Accumulate its gid into the move's `MapSet`.
3. Emit rows sorted by `MapSet.size` descending, ties by move name.

So:

- **Each row's count is "independent games", never raw occurrences.** A game
  reaching the same position at two plies and plating the same first move
  both times contributes its gid once.
- **A repeated occurrence within one game with a different next move
  contributes to that move too** (one gid per move — the point of the
  MapSet). The backend test pins this:
  - gid 12 reaches the tabiya at plies 16 ("Ne1") and 20 ("Bd2");
  - gid 13 reaches it at plies 16/20 ("Rb1") and 24 ("Bd2");
  - so `Ne1 3, Bd2 4, Qc2 1, Nd2 1, Rb1 1` (per the fixture) and
  `sum of games == 10` guarded as a pipeline invariant.

This handling satisfies the brief's §17 data-quality check in the only way
that is correct, and it matches the behavior expected from the strong
spectator: a game *really did* choose two different moves here; both
choices are part of the landscape.

---

## Limitations

(as the brief's §22 requires)

- **Continuation-family chaining remains.** The menu is a deliberately raw
  distribution; the family builder is untouched. Where `Families` blobs
  together what should be separate directions (Spike 07: A2 68/71,
  Najdorf 445/477), the new row corrects it at the overview level, but the
  per-card verdict gate (`followedMostCommon` on `family_id == 1`) can still
  misword underneath — deliberately not fixed here.
- **Duplicate-game cards remain.** The carousel still shows repeated games
  at different plies; representative-game selection is unsolved.
- **Empty-state semantics remain provisional.** The menu renders nothing when
  `next_moves` contains no rows (e.g. terminal positions, or zero
  occurrences) and the carousel's "No historical examples found" message
  still handles zero-inspectable cases neutrally. Cold-position cards with
  one or zero independent games show no menu — honest but unguided.
- **The A2/Najdorf menu exercises only the two most common **2 moves**
  because F1 only ever had 6 total moves; the capacity to collapse is
  demonstrated on the Najdorf test (21 rows → 6 + "Show 15 more").
- **The ★ref marker is still missing** — menu says *what* was played, not
  *what the analyzed game did*. Product evaluation may decide whether the
  marker belongs on the menu row; it is a one-gid lookup, but deliberately
  not added now.
- **Session-cache stale-shape tolerance.** `DecisionMenu` treats
  `nextMoves == null` as empty, so older cached responses render the menu
  empty rather than crash (fields are additive; cache key unchanged). No
  cache migration performed.

---

## Evaluation questions

(recorded verbatim, not answered here)

1. Do I look at the move distribution before inspecting a game?
2. Does it help me understand what kind of position this is?
3. Does it reveal alternatives I want to investigate?
4. Do I naturally want to click a move?
5. Once I choose a direction mentally, can I find a useful game in the
   existing carousel?
6. Does the menu become noise in positions with many moves?
7. Is it useful in positions with little historical evidence?

These are for the product evaluation.

---

## Verification

- **API regression:** the F1 menu (14/9/2/1/1/1, side w) and the A2 menu
  (O-O 43, d6 28, side b) verified against the running dev server on the
  100k corpus.
- **Live UI:** both render exactly those numbers on `http://localhost:5173`.
- **Suites:** `mix test` passes (backend incl. corpus), frontend
  `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run --pool=forks` —
  green, including the A2 anti-chaining regression case.
