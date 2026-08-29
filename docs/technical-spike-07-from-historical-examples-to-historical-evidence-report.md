# Technical Spike 07 — From Historical Examples to Historical Evidence: Report

Status: **done** (observational spike; no product code changed). Spike brief:
[`technical-spike-07-from-historical-examples-to-historical-evidence.md`](technical-spike-07-from-historical-examples-to-historical-evidence.md).
Method: required reading (functional-design v0.3, Spikes 02/02b/04/05/06, the
vertical-slice spec), a code inventory of the pipeline and the dialog, **live
use of the real UI** against the 100k corpus (six positions, every card of
every carousel walked), and read-only pipeline probes (throwaway scripts in
`/tmp/opencode`, not committed).

> **TL;DR — Mostly no.** The individual-example card is a good *terminal*
> unit but the wrong *primary* unit for three independent, measured reasons:
> (1) the carousel **repeats** — F1's 19 cards are 11 distinct games, D1's 4
> cards are one game at four plies, and no headline tells you two cards are
> the same game; (2) the slice-wide family setting **chains** hot menus into
> one blob (A2: 68/71 games; Najdorf: 445/477), so the one aggregate line the
> card *does* show — "followed the most common continuation" — is true of
> literally every card and carries zero information; (3) the position's
> **decision menu** (the data the backend already returns: F1's
> `Ne1 14× · b4 9× · …`, A2's `O-O 43× · d6 28×`, Najdorf's
> `Bg5 120 · Be3 81 · Bc4 59 · …`) is nowhere in the UI, and it is precisely
> the thing that answers the user's first questions. The fix is not a
> redesign: put the already-returned menu in front of the carousel, and
> ground the per-card counts in the family the card belongs to. Everything
> needed is in the existing response.

---

## 1. Executive conclusion

> **Is the current individual-example card the correct primary UI unit?**

**Mostly no.**

The card itself is good — as the place where one concrete historical game is
inspected, compared, and picked. Spike 05's signals are all there and they
work: typed differences with square detail, the one-line route divergence,
per-side continuations, honest counts. Keep it.

But as the *primary* unit — the thing the user is handed first, one at a
time, 19 in a row — it fails the brief's product test (§16) on every hot
position I tried: after paging the carousel I did **not** understand the
historical landscape better; I understood *one game* better, 19 times, with
the structure connecting them invisible. Three structural defects, each
measured below:

1. **Repetition without identity.** The backend returns ~22 candidates per
   hot position; the same game appears on up to 5 cards (Rbecker–ACFKC on F1)
   at different plies, and near-twins of the same game appear ±1 ply. The
   carousel never says so. The user reads "1 of 19" as "19 examples"; there
   are 11.
2. **A chained menu makes the one aggregate verdict vacuous.** Family
   clustering uses one slice-wide setting (window 6, multiset Jaccard, 0.5).
   On A2 and the Najdorf this chains the decision menu into a single family
   (68/71 and 445/477 games). The card's verdict gates on `family_id === 1`,
   so *every* card reads "followed the most common continuation" — including
   a Marshall gambit and a Closed Chigorin, which are different answers to
   the position's central question. On A2 I paged 21 cards; the verdict
   never changed once.
3. **The landscape is computed and not shown.** `reference.families` comes
   back in every response and the dialog uses only the top member of each
   family (for the details-disclosure action tokens). The next-move
   distribution — Spike 02b/04's "decision menu", the cheapest and most
   landscape-forming fact about a position — is derivable from the response
   in one line of grouping and is absent. (The i18n strings
   `evidence.menu` / `evidence.menuNone` exist, unused — a menu section was
   planned and never landed.)

The evidence-first hypothesis (brief §5) is therefore **supported for hot
positions**, where a landscape exists and is currently hidden. For cold
positions the problem is different (§5.4): there is no landscape to show,
and the card carousel degenerates into same-game noise or silence. Neither
regime is served by "one card, next card, next card".

---

## 2. Current implementation

End-to-end, as built (details in `docs/historical-evidence-api.md`,
`docs/architecture.md` §"Historical evidence"):

**Backend** (`lib/blunderfest/corpus/`, behind the `Blunderfest.Corpus`
facade, Postgrex on four UNLOGGED tables — 100k games, 6.71M occurrences):

- `POST /api/historical-evidence` (`HistoricalEvidenceController#analyze`)
  → `Search.Pipeline.analyze/2`: candidate generation (exact, cap 12;
  pawn-skeleton bucket, cap 10, ranked by piece overlap) → the reference
  **decision menu** (`Analysis.Families.build` over *all* exact occurrences'
  continuations; window 6, multiset Jaccard, single-linkage @ 0.5 — one
  slice-wide setting) → per-candidate cards: position dims + typed
  differences, route comparison, continuation window (≤12), family
  membership + per-side skeleton membership, historical counts
  (occurrences / independent games / `same_game_only`), flags.
- Response = `{reference: {fen, occurrences, games, families}, candidates: [...], timings}`.
  The menu's families carry `id, occurrences, games, singleton, members`
  (each member: move window, occurrence count, per-side action tokens).
  Measured 16–102 ms per request on the tabiyas; ~813 ms on the Najdorf
  (menu clustering over 479 occurrences dominates).
- `GET /api/historical-evidence/games/:gid` → full mainline game tree
  (powers "Add to room").

**Frontend** (`assets/src/features/historicalEvidence/`): the
`HistoricalEvidenceDialog` — a private modal carousel over the candidates
for the cursor's position: one slide per candidate (static board at the
candidate position, flipped to the side to move) + the facts card; prev/next
+ ←/→; "i of n"; session-cached per request; the analyzed game itself is
filtered out by PGN-header match. Each card shows: game header, a
route-aware headline ("Same position", "Same position · other side to move",
"One move on — the candidate played Nc6", "One move before this position", …),
Position dims, Route, per-side Continuation with a verdict line, Historical
evidence count, "Add as variation" / "Add to room", and a "Comparison
details" disclosure (typed differences, per-side skeleton sim + plan action
tokens). No relevance score anywhere — as specified.

**What the response already contains vs. what the UI uses** (brief §13):

| data | in response? | used by UI? |
|---|---|---|
| result groups (relationship × family) | derivable | no |
| decision menu / next-move distribution | yes (`reference.families` member first moves) | **no** |
| continuation-family counts | yes (per family + per membership) | only via the verdict's `(9 games)` |
| independent-game counts | yes (everywhere) | yes |
| representative-game lists | no (games are per-candidate) | n/a |
| route/difference categories | yes (typed differences, dims) | yes (headline + sections) |
| reference-family marker (★ref) | **no** (docstring promises `contains_reference?`, never built) | no |
| membership runner-up (`next`) | internal only, stripped from DTO | no |

Nothing required for the proposed overview is missing from the response
except the ★ref marker and a per-family game list — both small.

---

## 3. User questions

Scored from actual use (§5). **Well** = the current UI answers it directly;
**partially** = answerable with effort across cards; **poorly** = the UI
hides or misstates the answer.

| question | verdict | why |
|---|---|---|
| What do players normally do here? | **poorly** | the menu (the answer) is not shown; inferring it from 19 continuations one card at a time is work the backend already did |
| Are there multiple historical directions? | **poorly** | F1: yes (kingside vs queenside) — visible only by collecting verdicts across cards; A2/Najdorf: the chained menu actively says "one direction" when there are two/seven |
| Is this continuation common or unusual? | **partially** | verdict works when the menu is clean (F1) and the family has ≥2 games; meaningless when the menu chains (A2: always "most common") or the family is a 2-game blob (F2: "most common" of 2) |
| Has somebody tried this alternative setup? | **well** | the near-twin cards with typed differences (F1's B4 Nd2, F4 h3) are exactly this — the strongest thing the card does |
| Does spending this tempo change the continuation? | **well** | tempo-twin / "one move on/before" cards + route lines (F1's B1, A2's GEM-592) — the other strongest thing |
| Do strong players treat this position differently? | **poorly** | Elos are not on the card at all (only in the details-free header? no — nowhere); no way to tell 2300 from 1500 without adding the game |
| Is this one unusual game, or a recurring historical pattern? | **partially** | singleton flags exist in the response and the count text is honest ("1 game"), but the headline and verdict don't warn; the user must read the small print on every card |
| Which historical game should I inspect to understand this direction? | **poorly** | no guidance: duplicates and near-duplicates of the same game/direction are interleaved with the novel ones; nothing says "this card is the modal branch" |

The two questions the card answers **well** are exactly the Spike-05-validated
"difference + route" readings. The questions it answers **poorly** are all
*landscape* questions — the ones that need the result set, not the result.

---

## 4. Example vs evidence

The brief's distinction is real and the current UI conflates the two levels
in one specific place: the **Historical evidence** section. On an exact-match
card it reads "28 games" (F1) — the count of the *reference position's*
occurrences, identical on all 11 exact cards — while the card shows one game.
On a near-twin card it reads "27 games" or "14 games" — the count of *that
card's own key*, which the user cannot interpret without knowing the key.
Nothing connects "this game" → "its continuation" → "the N games" → "the
other continuations" → "the reference game". The response has every link in
that chain (membership family, family counts, menu); the card renders only
the raw number.

The two-level model (evidence → direction → representative games → game) is
**not** an argument for burying the example. The F1 walk shows the example
remaining the payoff: once I knew (from the probe data) that fam#2 was the
queenside direction, the Rbecker–ACFKC cards were exactly what I wanted to
inspect — but I wanted *one* of them, not four, and I wanted to arrive at it
from the direction, not discover the direction by triangulating cards.

Advantages of the current flat model: nothing between the user and a
concrete game; no grouping decisions to get wrong; every card is actionable
(add as variation / to room). Disadvantages: repetition without identity;
no landscape; the verdict line oversells (chained menu) or undersells
(singleton family, no verdict at all) depending on invisible menu quality;
the count is ungrounded. On balance the flat model spends the user's
attention on the wrong thing first — but the grouped model would be wrong
*if it replaced* the cards rather than preceded them.

---

## 5. Real-position observations

Six positions exercised live in the UI (imported the corpus's own reference
games into a room, cursor on the documented ply, walked every card). Pipeline
probes (same inputs through `HistoricalEvidence.analyze/2` directly) supplied
the underlying data. The product test — *"after using Historical Examples, do
I understand the historical landscape better?"* — is answered per position.

### 5.1 F1 — KID Classical tabiya (8…Ne7, ply 16; 28 occ / 28 games)

*Trying to understand:* what does White do here, and are there distinct
directions? *UI showed:* 19 cards. 11 exact "Same position" games (verdicts
split "most common continuation" vs "same continuation (9 games)"), 2 tempo
twins (incl. BOXPA–cancerpop, the B1 game: white no verdict, black "most
common"), 6 near-twins ("one move on/before"). *What I wanted:* the first
screen — which I only got from the probe: **Ne1 14× · b4 9× · a3 2× · Nd2/Bd2/Qc2 1×**,
families 13/9/2/1×4, the reference game in the 13-game kingside family.
*Landscape understood?* Only after leaving the UI. Notably: Rbecker–ACFKC
appears on 4 cards (three games + one near-twin) — as a user I could not
tell whether that pair is significant or just active; MikeMcDonagh's
`Ne1 h5!?` (a 1-game family) shows **no verdict at all**, the only honest
moment in the carousel.

### 5.2 A2 — Ruy López tabiya (7.Re1, ply 13; 71 occ / 71 games)

*Trying to understand:* the canonical decision — Marshall vs Closed.
*UI showed:* 21 cards; **every** verdict "followed the most common
continuation" (fam#1, 68 games). The backend menu chained: 68/1/1/1 —
Spike 04's validated menu (36 Closed / 19 Marshall / smalls, LCS@0.6/w4)
destroyed by the slice-wide multiset@0.5/w6. The Marshall cards (chessAdd's
`O-O c3 d5 exd5`, lukcza's C89) and the Closed cards are indistinguishable.
GEM-592–shinji_no_baka ("one move before", route diverges ply 13 `Re1` vs
`c3`) is the A2-B4 unspent-tempo pattern — invisible as such, verdict
"most common" like everything else. *Landscape understood?* **No — actively
misled.** The one thing this position is *about* is its two branches; the UI
reports one.

### 5.3 Najdorf after 5…a6 (ply 10; 479 occ / 477 games)

Probe only (same pipeline the UI calls). Menu: **27 families, 445/477 in
fam#1**; next moves `Bg5 120 · Be3 81 · Bc4 59 · Be2 56 · f3 40 · Bd3 39 ·
a4 18 · h3 15 · …` — the Richter-Rauzer/English-attack/Sozin/Be2/f3/h3
system menu, all present in the data, all chained into one family. The 12
exact cards span B80–B98 (six ECO systems); every one would render "followed
the most common continuation". This is A2's failure at larger scale, and the
clearest case for the decision menu as the primary unit: the *position's
meaning* is its system choice, and only the next-move distribution says so.

### 5.4 B2 — unique middlegame (13…Bd6, ply 27; 1 occ / 1 game)

*UI showed:* **"0 examples — No historical examples found for this position
yet."** The pipeline returned 11 candidates — every one from the analyzed
game itself (its own later plies, degenerating to 0.0 similarity), so the
self-filter emptied the list. *Landscape understood?* There is none to
understand; the silence is honest. But "0 examples" undersells what the
system knows (it *has* the position's own continuation and its singleton
menu), and the same silence would appear for a genuinely unsupported
position and for this self-only case — two different situations, one message.

### 5.5 D1 — middlegame repetition position (24.Nc5, ply 47; 3 occ / 1 game)

*UI showed:* 4 cards — **all four the same game** (Waleed-Fathy–nachote) at
four plies: "2/14 match · different material · followed a different
continuation · 1 game", then worse (1/14). The reference's own exact
occurrences (the Nc5/Nd3 repetition) are self-filtered away. *Landscape
understood?* No — and the carousel is worse than silence here: it presents
one weak game four times as if it were four examples. The card-first model
has no way to say "we found almost nothing, and here is the little we found".

### 5.6 F2 — Stonewall tabiya (8…d5, ply 16; 2 occ / 2 games)

*UI showed:* 8 cards. Card 1 is the good one: the *other* cross-game
occurrence (lCnick–OEjarque 1-0, the analyzed game is their 0-1), "Same
position · most common continuation". But the verdict rides on a 2-game
family — "most common" of two is overconfident wording. The rest: the same
game at ±1–3 plies, wanmr–golelepi twice, timsonhutapea once. *Landscape
understood?* Partially — the useful content is "one other game reached this;
here is what it did", and card 1 delivers it. The other 7 cards are noise
around that fact.

### Cross-cutting observations

- **Repetition is the norm, not the exception.** Across all eight probed
  positions: F1 22 cards/12 games, A2 22/13, Najdorf 22/12, B2 11/1, D1
  13/2, D2 12/1, F2 12/4, E1 13/1. Every position shows the same game on
  multiple cards; cold positions show *only* that.
- **The verdict line has three silent failure modes**: chained menu (A2,
  Najdorf — always "most common"), 2-game family (F2 — "most common" of
  two), singleton family (F1 card 7 — no verdict; the user cannot
  distinguish "no family" from "family of one").
- **The self-filter can empty the dialog** (B2). Correct to hide the
  analyzed game; the *absence of anything else* is itself information the UI
  does not distinguish.
- **What I reached for, every time:** first "what are the moves here?" (the
  menu), then "which of these cards is *the* example of the main one?" —
  i.e. landscape first, representative second, individual game third. The UI
  serves them in exactly the reverse order.

---

## 6. Result-set structure

**Meaningful groups already exist in the returned data** — the response
groups cleanly on (relationship tier × family membership), no new
computation. From the probes:

- **F1** (22 candidates): exact×kingside-fam#1 (5), exact×queenside-fam#2
  (6, incl. Rbecker–ACFKC ×4), exact×singleton-fam#5 (1), near-twin×fam#1
  (6), near-twin×fam#2 (1), tempo-twin×no-family (2 — B1 and the A20 game),
  near-twin×no-family (1). That *is* the brief §5's hypothetical tree
  ("Same position → main/alternative/rare; tempo variants; alternative
  setup"), reconstructed from the existing response.
- **A2**: exact×fam#1 (11), near-twin×fam#1 (10), exact×singleton (1) —
  structurally present but useless while fam#1 is a chained blob; with a
  clean menu the same grouping becomes the Marshall/Closed landscape.
- **Cold positions** (B2/D1/D2/E1): the grouping collapses to
  "same-game×own-menu" + "no-family singletons" — i.e. the data itself says
  *there is no landscape*, which is a finding the UI could state instead of
  paging through.

Two data-quality notes for any grouping: (a) **menu quality is
position-dependent** — F1's menu is clean at the slice-wide setting, A2's
and the Najdorf's chain (Spike 04 documented exactly this metric
sensitivity: A2 needs LCS@0.6, F1 multiset@0.5; the slice deferred
per-reference tuning); (b) **the ★ref marker is missing** — `Families.build`'s
docstring promises `contains_reference?` but never builds it, so "the
reference game is in this family" (the Spike-05 load-bearing annotation) is
not currently renderable.

---

## 7. Decision-menu findings

The next-move distribution is the single most landscape-forming,
cheapest-to-show, currently-hidden element:

- **F1**: `Ne1 14 · b4 9 · a3 2 · Nd2 1 · Bd2 1 · Qc2 1` — the position's
  two plans and their weights in one line.
- **A2**: `O-O 43 · d6 28` — the decision itself.
- **Najdorf**: `Bg5 120 · Be3 81 · Bc4 59 · Be2 56 · f3 40 · Bd3 39 · a4 18 ·
  h3 15 · …` — the system menu; no card carousel of any length conveys this.
- **Cold positions**: the menu degenerates honestly (B2: `Ng4 1`; D1:
  `Nbd7 2, same game`) — i.e. it doubles as the "weak support" signal.

Grouping-key comparison (brief §9): **next move** is the right *overview*
key — cheap, complete (covers every occurrence, not just clustered ones),
and immediately chess-legible. **Continuation family** is the right *second*
key (what each branch grows into) — where the menu is clean; where it
chains, the family layer must either be repaired (per-position metric, the
deferred tuning) or the overview should lean on next-move + skeleton
variation tables (Spike 06's §3.4 shape, which survived every chaining
failure). **Relationship type / typed difference** is the right key for the
*structural* candidates (tempo twins, near-twins, alternative setups) — the
dimension along which the exact-match menu is silent. These are not
competitors: the data suggests **overview by next move, directions by
family, structural variants by typed difference** — three keys the response
already carries.

---

## 8. The representative-game problem

Once results group, some games must stand for each group. What the walks
showed about picking them:

- **Frequency picked my Rbecker–ACFKC problem**: the most *available* games
  are not the most instructive — that pair appears 4× on F1 because they
  played the position repeatedly, not because their games explain it.
  Representative selection must be **deduplicated by game first** (one card
  per game per group), then chosen within the group.
- **Player strength is display context, not a filter** (Spike 02b,
  confirmed here): F1-F4 (1519/1355) is the interesting h3-deviation game;
  the strongest F1 exact game (Shuvalov-era 2403s, in the corpus but not in
  the capped 12) never surfaced. Elos are in the response and not shown at
  all — showing them on the card is a precondition for any
  strength-informed selection later.
- **"Most representative continuation" is mechanical**: the family's modal
  member (already `members[0]`) with a game that plays it exactly.
- **What is needed before a responsible decision** (brief §10, answered):
  (1) dedupe by game; (2) the ★ref marker, so "the reference's own family"
  can prefer… the reference's own branch's modal game; (3) Elos on the card;
  (4) a per-family game list (the response has family *counts* but the games
  behind a family are only implicitly the candidates that joined it — a
  family→games index is one more projection of data the pipeline already
  touches). No ranking formula is needed for the experiment in §11; these
  four are facts, not scores.

---

## 9. Progressive-disclosure recommendation

- **Overview (new, first screen):** position identity + support ("28
  occurrences · 28 games"), the **decision menu** (next-move counts), the
  **direction list** (families with occurrence/game counts, singletons
  marked, ★ref where the reference game sits), and a **structural-variants
  summary** ("2 tempo twins · 8 near-position games"). For cold positions
  this same screen honestly says "1 occurrence, no recurring pattern — here
  is the one game" instead of the carousel's noise-or-silence.
- **Group/direction:** the family's variation table (Spike 06 §3.4 action
  sets with counts — `w{N→e1 B→e3} | b{N→e8 Pf→f5} · 5 games`), its
  representative games (deduped, Elos shown), the ★ref marker.
- **Individual example:** the current card, **unchanged except**: the
  Historical-evidence count grounded in the card's own family ("9 games
  follow this continuation") rather than the reference key's raw count; the
  verdict's three failure modes fixed (chained-menu guard, 2-game-family
  wording, singleton flag surfaced); Elos in the header.
- **Technical detail:** the existing Comparison-details disclosure, plus
  what it already has (sims, action tokens). Raw similarity stays here —
  Spike 05's finding stands.

---

## 10. What should remain unchanged

- **The card as the inspection unit** — headline logic, Position/Route/
  Continuation sections, per-side split, the details disclosure. Spike 05's
  signals work; the F1 tempo-twin and near-twin cards are the best moments
  of the current UI.
- **The route-aware headline** ("One move on — the candidate played Nc6") —
  the single best line in the feature.
- **The typed-difference + route pairing** — exactly as Spike 05 prescribed.
- **Add as variation / Add to room**, the echo/dedupe states, no
  auto-advance, the private-dialog model (ADR-0030), the session cache.
- **The honest count text** ("1 game · N occurrences from the same game") —
  the only guard against the singleton failure, keep and *extend* it.
- **No relevance score** — nothing in this spike weakens that principle;
  the chained-menu failure is one more argument for it.
- **The backend pipeline and response shape** — the overview needs nothing
  the response does not already contain (§12).

---

## 11. Smallest next product experiment

**Put the decision menu in front of the carousel.** Concretely: an overview
section at the top of the existing dialog — occurrence/game counts, the
next-move distribution, and the family list with counts and singleton marks
— rendered from `reference.families` (already in the response), with each
family row jumping to the first card that joined it. Keep the carousel
exactly as is, behind it.

This is deliberately **not** the full evidence-first redesign: no new
grouping UI, no representative-game selection, no family repair. It tests
the spike's central question at minimum cost: does showing the landscape
first change what users inspect? If the overview answers most questions and
the carousel becomes a drill-down, the hypothesis holds. If users skip the
overview and page cards anyway, the card-first model survives on evidence.

Success measures (observable in our own use): do we open cards from family
rows rather than paging; do we stop paging past duplicates; does the A2
position read as two branches again.

---

## 12. Implementation impact

For the §11 experiment:

- **Frontend only, almost entirely.** The overview renders
  `reference.families` + per-candidate `families.membership.member_of` —
  both in the existing response. The next-move distribution is a one-line
  group over member first moves. Estimated: one presentational component +
  wiring in `HistoricalEvidenceDialog`, no state changes (the unused
  `evidence.menu` i18n strings are already in place).
- **API changes: one additive field** — the ★ref marker
  (`contains_reference?` on each family; the pipeline knows the reference
  game and the docstring already promises it). No shape changes, no
  consumers broken.
- **Retrieval changes: none.**
- **New aggregation: none** (families are already aggregated; the menu is
  already built).
- **New persisted data: none.**

Out of scope for the experiment but documented for later: the A2/Najdorf
menu chaining (needs the deferred per-position family-metric tuning — a
retrieval-quality fix, not UI); representative-game selection (needs the
§8 facts first); grounding the per-card count in the card's family (frontend
once the overview exists).

---

## Appendix — evidence base

- Live UI walks (Playwright against `mix phx.server` + the docker 100k
  corpus): F1 (19 cards), A2 (21), B2 (0 shown / 11 returned), D1 (4), F2
  (8). Per-card notes: `/tmp/opencode/spike07/*.md` (throwaway, uncommitted).
- Pipeline probes (`mix run` against the same corpus): F1, A2, Najdorf, B2,
  D1, D2, F2, E1 — full JSON in `/tmp/opencode/probe_results.json` and
  `probe_deep_results.json`; grouping analysis `/tmp/opencode/group_structure.py`.
- Code inventory: `lib/blunderfest/corpus/search/pipeline.ex`,
  `analysis/families.ex`, `historical_evidence.ex` (DTO),
  `assets/src/features/historicalEvidence/` (dialog + card).
- Screenshot: `/tmp/opencode/spike07/spike07-f1-card1.png`.
