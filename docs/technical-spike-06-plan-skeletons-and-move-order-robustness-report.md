# Technical Spike 06 — Plan Skeletons and Move-Order Robustness: Report

Status: **done** (experiments executed on the 100k tier; the Phoenix app
untouched, ADR-0001 intact). Spike brief:
[`technical-spike-06-plan-skeletons-and-move-order-robustness.md`](technical-spike-06-plan-skeletons-and-move-order-robustness.md).
Starting points: [Spike 04 report](technical-spike-04-historical-continuation-and-plan-patterns-report.md),
[Spike 05 report](technical-spike-05-contextual-historical-evidence-re-judgment-experiment-report.md).
Code: `spike/position_retrieval/lib/sim/skeleton.ex` (tokenization +
representations), `skeleton_lab.ex` (experiment driver),
`mix spike.sim.skeletons`; 16 new tests (89 total green in the spike
project). Artifact: `data/sim-skeleton-100000.json` (full census, menu
sweeps, per-side memberships, variation tables).

> **TL;DR** — Yes, conditionally, and the condition is narrower than the
> brief hoped: the plan skeleton works as a **per-side membership layer on
> top of the existing (Spike 04) families**, not as a replacement
> clustering representation. The one documented gap closes: **B1 joins
> the kingside family on black's side with similarity 1.0** (its black
> actions `{N→e8, Pf→f5, Ph→h6}` are exactly the `g4 h6` variant member's
> black actions) — "same broad continuation family, black executing the
> plan, white a tempo behind" is now a mechanical family join, at window
> 6. The per-side view also produces sharper readings elsewhere: B4 and
> F2 come out as *hybrids* ("white queenside family, black kingside
> family"), and A2-B4 is "Marshall on black's side exactly, white's
> unspent Re1 tempo visible as the non-joining side". But when the
> skeleton is used to **cluster** the decision menu itself, the very
> property that fixes B1 — the mean per-color Jaccard rewarding one
> side's full match — chains plans together: F1's two plans blob at
> threshold 0.5 (26/28 games) though skeleton@0.6 reproduces the
> validated menu *exactly* (13/8/2/1×5), and A2's Marshall/Closed
> branches chain at **every** threshold (69/71 at 0.6), because the
> Marshall-without-exd5 variant shares white's `{Pc→c3, Pd→d3}` with the
> Closed-d3 variant verbatim. Negative tests hold in the membership view:
> B3 and F3 join nothing, the kingside/queenside and Marshall/Closed
> separations survive, the Be3/Nd3/f3 support-move variants remain
> distinct action sets inside one family, and family/variation structure
> is exactly the brief's §12 desired output shape. Recommendation: adopt
> `:skeleton` (per-color action multisets) as the membership/annotation
> representation, keep Spike 04's validated metrics for clustering, drop
> `:skeleton_phase`, keep `:skeleton_seq` where within-side order matters
> — then build the vertical slice.

---

## 1. Representation (deliverable §17.1)

A **plan skeleton** abstracts a continuation window into per-color
*actions*. Tokenization (`Spike.Sim.Skeleton.action/1`, one regex — no
chess rules beyond SAN grammar):

```text
"Ne1"  → "N→e1"     piece destination (disambiguation/capture dropped)
"f5"   → "Pf→f5"    the f-pawn reaches f5 (pawn moves keep their file)
"fxe4" → "Pf→e4"    the f-pawn captures on e4
"e8=Q" → "Pe→e8=Q"  promotions kept
"O-O"  → "O-O"      castling is its own action
```

Three representations on top (brief §10's A/B/C), all color-aligned via
the side to move, so a tempo flip cannot mis-bucket a move:

| repr | definition | similarity | brief |
|---|---|---|---|
| `:seq` | the raw SAN sequence (Spike 04 baseline A) | normalized LCS | A |
| `:multiset` / `:side_multiset` | Spike 04 baselines | multiset Jaccard / per-color mean | A/B |
| `:skeleton` | per-color **multiset** of action tokens (representation B) | mean per-color multiset Jaccard | B |
| `:skeleton_seq` | per-color **sequence** of action tokens — order kept within each side, ignored across sides | mean per-color LCS | C |
| `:skeleton_phase` | per-color × half-window ("early"/"later") multisets (representation C's grouped form) | mean bucket Jaccard | C |

The key design decision is `side_scores/3`: every skeleton similarity is
exposed **per color** (`%{w:, b:, mean:}`) rather than fused. The tempo
flip disturbs only the *interleaving* across colors, so dropping exactly
that interleaving (and nothing else) is the minimal order-preservation
that survives it — `:skeleton_seq` answers the brief's §6 requirement
("preserve which action happened first") at the level where it carries
chess meaning: within each side's own move order.

## 2. Test cases (deliverable §17.2)

Same units as Spike 05 (the brief's §11). Reference positions:

* **F1** — King's Indian Classical tabiya after 8…Ne7,
  `r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - -`
  (white to move, 28 occurrences). Reference continuation:
  `Ne1 Ne8 Nd3 f5 Bd2 Kh8 …`
* **A2** — Ruy López tabiya after 7.Re1,
  `r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq -`
  (black to move, 71 occurrences). Reference continuation:
  `d6 c3 O-O d4 Bg4 h3 …`

The tempo-flip pair at the center of the spike (brief §7):

```text
F1   (w to move): Ne1 Ne8 Nd3 f5 Bd2 Kh8     white: Ne1 Nd3 Bd2   black: Ne8 f5 Kh8
F1-B1 (b to move): Ne8 Bg5 h6 Be3 f5 Qc1     white: Bg5 Be3 Qc1   black: Ne8 h6 f5
```

and the move-order pair from brief §6:

```text
… Be3 f5 …   vs   … f5 Be3 …      (same actions, different order — the skeleton's home turf)
```

## 3. Grouping results (deliverable §17.3)

### 3.1 Census — the abstraction level is right

Distinct groups over each reference's occurrences (window 4; the pattern
is the same at 6/8):

| ref | occ | seq | multiset | side_multiset | piece_dest | **skeleton** | **skeleton_seq** | piece |
|---|---|---|---|---|---|---|---|---|
| F1 | 28 | 20 | 20 | 20 | 20 | **20** | **20** | 11 |
| A2 | 71 | 27 | 21 | 21 | 21 | **21** | **27** | 8 |
| C1 | 399 | 216 | 185 | 185 | 183 | **184** | **216** | 23 |
| C2 | 400 | 286 | 255 | 255 | 255 | **255** | **286** | 39 |

The skeleton's *identity* grouping collapses the same amount as the SAN
multiset (±1 group — disambiguation/capture-spelling coincidences) — no
variation-level information is lost (the Be3/Nd3/f3 variants stay
distinct action sets), while the color-blind `piece` abstraction (Spike
04's over-merger) is confirmed too coarse (F1: 11).
`:skeleton_seq` groups identically to `:seq` — it is order-sensitive by
design and earns its keep only as a similarity.

### 3.2 Menus — clustering reproduces F1 exactly (at 0.6) and chains A2

F1, window 4, cluster signatures across the sweep (baseline = Spike 04's
validated multiset@0.5):

```text
baseline multiset@0.5 : 13/13* 8/8 2/2 1/1 1/1 1/1 1/1 1/1     ← the published menu
skeleton      @0.4–0.5: 26/26* 1/1 1/1                          ← BLOB (both plans chained)
skeleton      @0.6     : 13/13* 8/8 2/2 1/1 1/1 1/1 1/1 1/1     ← EXACT reproduction
skeleton      @0.75    : 5/5 3/3 2/2 2/2 1/1×15                  ← over-split (variants separate)
skeleton_seq  @0.6     : 13/13* 7/7 2/2 1/1×6                    ← near-exact
```

A2, window 4:

```text
baseline LCS@0.6   : 36/36* 19/19 4/4 4/4 3/3 2/2 2/2 1/1       ← the published menu
skeleton @0.4–0.6  : 69/69* 2/2 (… 68/68 at 0.6)                 ← BLOB at every workable threshold
skeleton @0.75     : 20/20 17/17 9/9 …                            ← over-split (both branches shatter)
```

The per-color mean scores systematically lower than color-blind Jaccard
(no cross-color coincidences), so F1's operating threshold shifts
0.5 → 0.6; at 0.6 the skeleton's menu is *identical* to the validated
baseline. A2 never separates (§6.2 below). **Consequence: the skeleton
does not replace the clustering representation.**

### 3.3 Memberships — the per-side layer (the actual win)

Every unit scored against the **baseline** menus (families fixed at
Spike 04's validated settings; the skeleton only changes the scoring),
per side, at threshold 0.5. Family ids are per-menu; singleton families
carry their 1-game counts:

| unit | cand window | baseline | white joins | black joins |
|---|---|---|---|---|
| F1-A1 | `Ne1 Ne8 f3 f5 g4 h6` | #1 (1.0) | **#1 (1.0)** | **#1 (1.0)** |
| F1-A2 | `b4 a5 bxa5 c5 Nd2 Rxa5` | #2 (1.0) | **#2 (1.0)** | **#2 (1.0)** |
| F1-A3 | `Qc2 c5 dxc6 bxc6 b4 Be6` | #6 (1.0) | #6 (1.0)† | #6 (1.0)† |
| F1-A4 | `a3 Ne8 b4 f5 exf5 gxf5` | #7 (1.0) | #7 (1.0)† | #7 (1.0)† |
| **F1-B1** | `Ne8 Bg5 h6 Be3 f5 Qc1` | none (0.33) | #4 (0.5, 1-game family) | **#1 (1.0)** |
| F1-B2 | `Nd7 Qc1 f5 Bg5 fxe4 Nxe4` | #4 (0.71) | #4 (0.5, own singleton) | #4 (1.0, own singleton) |
| F1-B3 | `c5 dxc6 bxc6 b4 Be6 a4` | #6 (0.71) | **#2 (0.5)** | #6 (1.0, own singleton) |
| F1-B4 | `a5 a3 Nd7 Rb1 f5 f3` | #2 (0.71) | **#2 (0.5)** | **#1 (1.0)** |
| F1-F1 | `Qc2 a5 a3 a4 Be3 Nfd7` | none (0.2) | none (0.2) | **#1 (0.5)** |
| F1-F2 | `Nd2 Nd7 b4 f5 f3 f4` | #1 (0.5) | **#2 (0.5)** | **#1 (1.0)** |
| F1-F3 | `O-O Nxe3 fxe3 a5 a4 Nc5` | none (0.2) | none (0.2) | none (0.2) |
| F1-F4 | `O-O Ne8 Ne1 f5 f3 f4` | #1 (0.71) | **#1 (0.5)** | **#1 (1.0)** |
| F1-E1 | `Nd2 Rxa5 Nb3 Ra6 a4 Nd7` | none (0.2) | none (0.2) | #2 (0.5) |
| F1-E2 | `c5 Nd2 Rxa5 Nb3 Ra6 a4` | none (0.33) | none (0.2) | #2 (0.5) |
| F1-E3 | `Ba3 a5 bxa5 Rxa5 Bb4 Ra8` | #2 (0.5) | #2 (0.5) | **#2 (1.0)** |
| F1-E4 | `Be3 cxd5 exd5 Bf5 Re1 Rc8` | none (0.09) | none (0.2) | none (0.0) |
| A2-B4 | `Re1 O-O c3 d5` *(w4)* | #2 (0.75) | none (0.33) | **#2 (1.0)** |

All windows are 6 except A2-B4 (window 4 — A2's w6 baseline menu is
itself chained, 57/71, and renumbers; §3.2). † own-game singleton
family (the Spike 05 same-game flag; the w6 exchange moves — `exf5
gxf5` — pull A4's black actions off family #1 into its own singleton,
while at w4 A4's black `{N→e8, Pf→f5}` joins #1 exactly, at 1.0).

Readings this table produces that the baseline could not:

* **B4 = a hybrid game**: black's actions `{Pa→a5, N→d7, Pf→f5}` are
  *exactly* the `Ne1 a5 Be3 Nd7 f3 f5` member's black actions (1.0,
  both windows), while white's `{Pa→a3, R→b1, Pf→f3}` join the
  **queenside** family #2 (0.5). White plays the queenside preparation,
  black plays the kingside plan — mechanically printed, and a fair
  description of the game (3…resb–lugoking: a3/Rb1/b4 versus …f5).
* **B2's two windows tell its whole story**: at w4 black's
  `{N→d7, Pf→f5}` matches the Nd7-route members of family #1 *exactly*
  (1.0) — black did open with the plan's knight route and break —
  while at w6 the liquidation token `Pf→e4` (`fxe4`) drops the
  black-side score to 0.5 against every member. "Black executed the
  kingside actions, then liquidated" is precisely the spike-05 reading,
  split across two windows.
* **F2 = the same hybrid**: white queenside (0.5), black kingside (1.0).
* **F4's return-to-plan is stronger than the baseline's**: black 1.0,
  white 0.5, mean 0.75 (baseline 0.71) — the h3 deviation and late
  castle are confined to white's side; black's plan execution is
  untouched.
* **A2-B4's "other branch" reading is now per-side**: black
  `{O-O, Pd→d5}` matches the Marshall family's black exactly (1.0);
  white's `{R→e1, Pc→c3}` matches nothing (0.33) — the unspent Re1
  tempo is the visible non-joining residue. Spike 04's "the tempo twin
  chose the other branch" (a whole-window 0.60 nearest) becomes an
  exact statement about *which side* carries the branch choice.

### 3.4 Variations — family vs variation (brief §9, §12)

Within family #1 (the kingside family, 13 games), the skeleton's
distinct action sets — the brief's §12 output shape, achieved:

```text
Continuation family #1 — 13 occurrences / 13 games (★ contains the reference game)
    w{N→e1 B→e3}   | b{N→e8 Pf→f5}   5 games   Ne1 Ne8 Be3 f5
    w{N→e1 N→d3}   | b{N→e8 Pf→f5}   3 games   Ne1 Ne8 Nd3 f5
    w{N→e1 Pf→f3}  | b{N→e8 Pf→f5}   2 games   Ne1 Ne8 f3 f5
    w{N→e1 B→e3}   | b{N→d7 Pf→f5}   1 game    Ne1 Nd7 Be3 f5
    w{N→e1 N→d3}   | b{N→d7 Pf→f5}   1 game    Ne1 Nd7 Nd3 f5
    w{N→e1 B→e3}   | b{N→d7 Pa→a5}   1 game    Ne1 a5 Be3 Nd7
```

Family-level similarity ("these games pursue related continuations") and
variation-level identity ("this game uses Be3, that one Nd3") are the
same data at two thresholds — 0.6 groups, 1.0 distinguishes. The Be3 vs
Nd3 variants score 2/3 pairwise: related, never interchangeable. A2's
Closed family decomposes the same way (white `{Pc→c3, Ph→h3}` 20 games
/ `{Pc→c3, Pd→d4}` 8 / `{Pc→c3, Pd→d3}` 2 …, black `{O-O, Pd→d6}`
constant).

## 4. B1 analysis (deliverable §17.4)

**Yes — the tempo-shifted continuation is recognized as related, as a
family join on the executing side.** At window 6, against the baseline
menu:

```text
B1 black actions: {N→e8, Ph→h6, Pf→f5}
family #1 member "Ne1 Ne8 f3 f5 g4 h6", black: {N→e8, Pf→f5, Ph→h6}
→ black-side Jaccard 1.0   (exact action-set identity, order-free)
```

All three skeleton representations agree: `:skeleton` b=1.0,
`:skeleton_seq` b=0.667 (the Ne8-before-f5 order also matches),
`:skeleton_phase` b=0.5. The desired outcome — *same broad continuation
family, one side executing on schedule, the other a tempo behind* — is
now two printed numbers: **black #1 at 1.0, white no family (best 0.5
against a 1-game family)**. Note the white side is genuinely
informative: B1's white played `Bg5/Be3/Qc1` — the Korchnoi-attack
pattern — which scores 0.5 against family #4, *B2's own game's singleton
family* (a cross-game join, but to a 1-game family; the singleton guard
from Spike 05 applies). The card this produces: "black executed the
kingside plan exactly (as in the g4/h6 variant); white went Korchnoi
instead of the Ne1 reroute" — which is the game.

Two qualifications, both consistent with Spike 04's findings:

1. **Window sensitivity persists.** At window 4, B1's black set is
   `{N→e8, Ph→h6}` (f5 hasn't happened yet) and nothing joins (0.33).
   The join exists at window 6+, where black's `…f5` lands. The brief's
   §6 examples (`… Be3 f5 …` vs `… f5 Be3 …`) fare the same: order-free
   identity merges them at any window; the join to the family depends on
   the window containing the plan's actions.
2. **The mean view joins at exactly 0.5** (the same member's 1.0 black +
   0.0 white) — brittle. The per-side view is the robust signal; the
   mean should be shown for comparison only, consistent with the
   no-fusion principle.

No B1-specific logic exists anywhere: the same membership rule produces
A2-B4's Marshall join, B4's hybrid, and F4's return-to-plan.

## 5. Negative tests (deliverable §17.5)

* **B3 (the different plan) joins nothing of the kingside family** —
  black `{Pc→c5, Pb→c6, B→e6}` and white `{Pd→c6, Pb→b4, Pa→a4}` share
  zero actions with family #1 on either side (0.0). Its white side
  joins the queenside family #2 at 0.5 (b4/a4) — correct: white *did*
  play the queenside break in that game; black's `…c5/…bxc6` exchange
  is its own 1-game family #6. Divergence and partial convergence are
  both exposed, neither overstated.
* **F3 (both sides diverged) joins nothing anywhere** (0.2/0.2) — the
  "different line entirely" case stays clean.
* **Kingside vs queenside stay apart** (F1): the baseline menu
  separates them (13 vs 8); the skeleton's per-side view keeps them
  apart (no unit joins both #1 and #2 on the *same* side); the only
  representation that merges them — skeleton *clustering* below 0.6 —
  is rejected in §8.
* **Marshall vs Closed stay apart** (A2): black-side `{O-O, Pd→d5}` vs
  `{O-O, Pd→d6}` = 1/3; A2-B4 joins Marshall on black, never Closed.
  The separation survives the skeleton everywhere except clustering
  (§6.2).
* **E4 (cross-structure, kingside-ish moves `Be3 cxd5 exd5 Bf5`) joins
  nothing** — 0.0–0.2 on every side, every representation, every
  window. The strongest "confident garbage" candidate stays sunk.
* **The support-move trio stays variationally distinct** (§3.4): Be3 /
  Nd3 / f3 score 2/3 pairwise and remain distinct action sets — the
  skeleton does not erase the distinction the user may specifically
  care about.

## 6. Failure cases (deliverable §17.6)

### 6.1 Skeleton clustering chains plans at low thresholds (F1)

At 0.4–0.5 the per-color mean blobs F1's two plans (26/28 games). The
bridge is the genuinely hybrid family #3, `a3 Nd7 b4 f5`: its black
`{N→d7, Pf→f5}` matches family #1's black exactly (1.0) while its white
`{Pa→a3, Pb→b4}` matches family #2's white at 1/3 — mean 0.5, chain
closed. This is not a bug but the B1 property itself: *one side fully
executing a plan is enough to reach the mean threshold*. Membership
scoring wants exactly that; single-linkage clustering cannot afford it.

### 6.2 Skeleton clustering never separates A2's branches

Marshall and Closed chain at every threshold (69/71 at 0.6; both
shatter at 0.75). The precise mechanism: the Marshall variant
`O-O c3 d5 d3` (white `{Pc→c3, Pd→d3}`) and the Closed variant
`d6 c3 O-O d3` (white `{Pc→c3, Pd→d3}`) have **identical white
skeletons**; only black's `d5`-vs-`d6` token distinguishes them (1/3),
giving mean 0.667 ≥ 0.6. A2's menu distinguishes its branches almost
entirely on *one pawn token on one side*, and the mean dilutes a
full-side match (1.0) plus that token (1/3) past every workable
threshold. General rule found by this spike: **per-color mean separates
plans when the distinction is expressed on both sides (F1: white's
Ne1-vs-b4 *and* black's Ne8/f5-vs-a5/c5); it chains when the
distinction rides on one token of one side while the other side's
content overlaps across branches (A2).** F1's exact reproduction at 0.6
is therefore a property of the position, not a guarantee.

### 6.3 Singleton self-membership persists (unchanged from Spike 05)

B2's and B3's "joins" at w6 are against their own games' singleton
families (`1 occ / 1 game` — family #4 *is* B2's game). The counts stay
printed on every row; the future UI's "family contains only this game"
flag is still required. B1's white-side join (#4 at 0.5) is cross-game
but still to a 1-game family — the same guard should mark it.

### 6.4 Plan membership is not position comparability (E1/E2/E3)

Three of the four F1-E cross-structure candidates join a family on one
side (E3 on both) — their games genuinely contain the queenside plan's
*actions*, even though their positions differ structurally (pawn
mismatch 2–5). Family membership annotates what the game did; the
positional tier (exact / same skeleton / other) says whether the
position makes it comparable. Shown together they are informative
("structurally different position, same queenside actions"); fused or
shown alone, family membership would *re-introduce* the confident-
garbage failure Spike 04 fixed. E4 demonstrates the same point from the
other side: similar-looking moves, no join, correctly sunk.

## 7. Complexity (deliverable §17.7)

* **Compute.** All experiments, all 12 references (census, both menu
  sweeps × 3 representations × 4 thresholds, 17 unit cards × 2 windows ×
  3 representations, variation tables): **414 ms** after the shared
  index load (unchanged ~3 min / 5.7 GB at 100k; Spike 02's loader).
  The membership scoring itself is O(units × families × members) token
  Jaccards — microseconds per card.
* **Storage.** Nothing new is indexed: skeletons are derived on read
  from the per-game SAN lists Spike 02 already stores. A precomputed
  shape (per distinct key with ≥2 occurrences: the family table + per-
  family action-set variants, a few hundred bytes) fits comfortably in
  Spike 03's derived-index budgets; the token lists themselves are
  ~2–6 short strings per occurrence window.
* **Indexing.** No new structures. The per-color attribution needs only
  the side to move, already in the key.
* **Scale.** Same flat-in-corpus-size property as Spike 04 (the 400-
  occurrence sampling cap); the 1M-tier rerun changes which references
  hit the cap, not the per-reference cost.

## 8. Recommendation (deliverable §17.8)

> **Should a plan-skeleton / action-based representation become part of
> the historical search engine?**

**Yes — as the per-side membership and variation layer on top of the
existing continuation families; no — not as the clustering
representation.**

1. **Keep Spike 04's validated metrics for family construction**
   (multiset@0.5/w4 for F1-like menus, LCS@0.6/w4 for A2-like menus;
   threshold sweep on display, never one number). The skeleton's
   clustering over-merges by construction (§6.1–6.2).
2. **Add `:skeleton` per-side membership to every candidate card**:
   each side's best family, its similarity, the family's occurrence and
   independent-game counts, and the singleton/same-game flags. This is
   the fix for the tempo-flip gap: B1 joins its plan family on the
   executing side at 1.0, and hybrids (B4, F2) get their correct
   two-sided reading. It costs one tokenizer regex and a Jaccard.
3. **Show family → variations with counts** (§3.4's table) — the §12
   output shape, for free from the same data.
4. **Carry `:skeleton_seq` forward for order-sensitive comparisons**
   (it preserved B1's black join at 0.667 and F4's at 1.0 while keeping
   within-side order meaningful); **drop `:skeleton_phase`** — it
   diluted every case it touched (B1 b=0.5 vs 1.0/0.667 for the other
   two) and bought nothing.
5. **Never fuse the per-side numbers into one score** — the mean's
   brittleness at exactly 0.5 (§4.2) and the E-candidates' plan-vs-
   position orthogonality (§6.4) are the two newest reasons in a
   growing list.

Against the brief's failure criteria (§16): no hand-written chess rules
beyond SAN grammar (one regex); no merged fundamental plans in the
shipped configuration (only in the rejected clustering variant);
temporal information retained within sides (`:skeleton_seq`); clear
improvement over strict matching (B1, B4, F2, A2-B4); and the whole
mechanism remains explainable in one sentence: *"which side played
which actions, and whose action set does that match."*

## 9. The proposed first vertical slice (brief §18)

The positive result does not go straight to a production engine. The
slice — **given one FEN, show the historical evidence**, end to end:

```text
Reference position (FEN)
        ↓  Spike 01 packed index: key → occurrences (exact)
Candidate generation
        ↓  Spike 02 strategies (exact + pawn-skeleton bucket), capped
Position comparison
        ↓  Spike 02 features: piece overlap, pawn/king/material distance
Route / difference analysis
        ↓  Spike 04/05: typed differences + route divergence with per-side extra moves
Continuation analysis
        ↓  Spike 04: decision menu (next-move counts; families at the validated
           metric per menu), occurrences + independent games everywhere
Continuation / plan families
        ↓  THIS SPIKE: per-side skeleton membership on every candidate,
           family → variation tables, singleton/same-game flags
Historical evidence
        ↓  card: tier + diffs + route + families (per-side) + counts
Human-readable presentation
```

Deliberately small: a fixed small corpus (the existing 100k tier is
fine), one reference position at a time, no relevance ranking, no new
storage — every layer is already measured in a spike artifact. The one
new engineering decision the slice forces is the UI unit: **the card**
(typed difference + route + per-side families with counts), which is
exactly what Spikes 05 and 06 have been converging on.

---

## Appendix: reproduction

```sh
cd spike/position_retrieval
mix test                                    # 89 tests (16 new)
mix spike.sim.skeletons --games 100000      # index load ~3 min, experiments <1 s
# artifact: data/sim-skeleton-100000.json
```

The B1 member-level trace and the A2 bridging-pair analysis (§4, §6.2)
are one-off probes over the same artifacts, kept with the spike code
(`tmp/skeleton_probe.exs`, `tmp/a2_probe.exs`, untracked per the spike
convention; ~4 min each including the index load).
