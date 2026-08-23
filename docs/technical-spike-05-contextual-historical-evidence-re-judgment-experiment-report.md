# Technical Spike 05 — Contextual Historical Evidence: Re-Judgment Experiment: Report

Status: **done** (experiment executed on the 100k tier; the Phoenix app
untouched, ADR-0001 intact). Spike brief:
[`technical-spike-05-contextual-historical-evidence-re-judgment-experiment.md`](technical-spike-05-contextual-historical-evidence-re-judgment-experiment.md).
Starting points: [Spike 02b report](technical-spike-02b-relevance-analysis-report.md),
[Spike 04 report](technical-spike-04-historical-continuation-and-plan-patterns-report.md).
Code: `spike/position_retrieval/lib/sim/rejudge.ex` (card builder),
`rejudge_sheet.ex` (A/B sheet renderer), `mix spike.sim.rejudge`; 7 new
tests (73 total green in the spike project). Artifacts:
`data/sim-rejudge-100000.json` (structured cards) and
`data/sim-rejudge-sheet-100000.html` (the A/B sheet, 13 units × 2
presentations).

> **TL;DR** — Yes, contextual evidence produces qualitatively better
> judgments, and the experiment says *which* evidence. Four of thirteen
> judgments changed (two up, one down, one reframed), all four for
> structural reasons the card made visible; the nine unchanged judgments
> became *easier and better-grounded* rather than different. The surprise
> signal is the **route comparison** ("the games shared 16 plies, then
> white played `Qc2` instead of `Ne1`"; "white also played `e3`") — it
> turns the tempo/move-order story from manual reconstruction into one
> printed line, and it carries or corrects four cards. The known failure
> is also newly precise: continuation-family membership is **tautological
> for singleton families** (B2/B3/B4 "join" a family that contains only
> their own game one ply earlier — visible only because the card prints
> `1 occ / 1 game`), and the tempo twin B1 still cannot *join* its plan
> family mechanically (the per-side decomposition, not the family, carries
> it). The simpler continuation representation is **not** clearly
> insufficient: exactly one documented gap (tempo-flip family-joining) is
> missing, which scopes Spike 06's plan-skeleton test tightly. No
> relevance score was built; none is missed.

---

## 0. Methodology and honesty notes (brief §7)

* **Candidates** (brief §4): the six grounded units of the earlier
  qualitative evaluation — F1-B1…B4, F1-F4, A2-B4 — plus seven from the
  Spike 04 dataset to cover the cases B1–F4 do not represent: the F1
  **exact-match quartet** A1–A4 (identical position, four different
  continuations — positional similarity fully silent) and the remaining
  F1 same-opening-line candidates F1–F3 (near-identical similarity,
  different directions). 13 units, 2 reference positions (F1: KID
  Classical tabiya, 28 occurrences; A2: Ruy López tabiya, 71).
* **The evaluator was the agent**, not the owner. The owner's formal 0–3
  scores do not exist (the Spike 02 judgments TSV is blank by design); the
  "before" column for the six grounded units is the owner's documented
  qualitative reading (02b §2/§3) mapped onto 0–3, marked *reconstructed*.
  For the seven new units there was no prior reading, so the agent judged
  the original-presentation card first, then the contextual card — a
  genuine two-pass A/B for those units.
* **Not blind.** The agent knew the prior readings for the six grounded
  units (they are in the docs). Mitigation: every unit was re-analyzed
  from the card content and the underlying game data (all card facts were
  mechanically verified against the corpus artifacts, including cluster
  signatures cross-checked against Spike 04's published artifact), and
  disagreement with the prior reading was allowed and happened (B3). This
  is a continuation of the qualitative expert analysis, not a human study;
  the HTML sheet is the instrument for an owner re-run.
* **Presentations.** Original = the Spike 02 card verbatim (board, why,
  game line, dims, prev/next, links). Contextual = the same card plus,
  per brief §5: (A) the original dims retained; (B) typed differences with
  square detail; (C) continuation windows 4/6/8 next to the reference's
  own continuation, with multiset/per-side/sequence similarity; (D)
  continuation-family membership against the reference position's decision
  menu (single-linkage clusters over the exact occurrences at the settings
  Spike 04 validated: F1 multiset@0.5/w4, A2 LCS@0.6/w4), with family
  sizes, game counts and the reference game's own family marked; (E)
  per-side continuation split with per-color similarity; (F) occurrence
  counts, ratings, result — plus **route/move-order information**: the
  shared opening prefix, the divergence ply and move, and the per-side
  move-set difference between divergence and the matched position (the
  mechanical tempo attribution).

## 1. Experimental setup (deliverable §13.1)

`mix spike.sim.rejudge --games 100000` loads the Spike 02 index, query set
and candidate set, then per selected unit computes the card (above) and
writes the JSON + HTML artifacts. Clustering re-uses
`Spike.Sim.Continuation` similarity with a small union-find; the
recomputed menus reproduce Spike 04's published artifact exactly (F1:
8 clusters, 13/8/2/1/1/1/1/1 occurrences, the reference game in the
13-game kingside family; A2: 8 clusters, 36/19/4/4/3/2/2/1, the reference
game in the 36-game Closed family). The menu tables, as displayed on the
sheet:

```text
F1 — next move across 28 games: Ne1 14× · b4 9× · a3 2× · Bd2 1× · Nd2 1× · Qc2 1×
  #1 13 occ/13 games ★ref: Ne1 Ne8 Be3 f5 (5×) · Ne1 Ne8 Nd3 f5 (3×) · Ne1 Ne8 f3 f5 (2×) · …
  #2  8 occ/ 8 games: b4 a5 bxa5 c5 (2×) · b4 Nd7 Qc2 a5 · b4 a5 Ba3 Nd7 · …
  #3  2 occ/ 2 games: a3 Nd7 b4 f5 · a3 Ne8 b4 f5
  #4–#8 singletons: Bd2 Nd7 Qc1 f5 · Nd2 a5 a3 Nd7 · Ne1 h5 Nd3 Nh7 · Qc2 c5 dxc6 bxc6 · b4 Nh5 g3 f5

A2 — next move across 71 games: O-O 43× · d6 28×
  #1 36 occ/36 games ★ref: O-O c3 d6 h3 (9×) · d6 c3 O-O h3 (9×) · d6 c3 O-O d4 (5×) · …   ← Closed
  #2 19 occ/19 games: O-O c3 d5 exd5 (17×) · O-O c3 d5 d3 (2×)                                ← Marshall
  #3–#8 small: anti-Marshall-ish (a3/d4 without c3), a4/Bb7, d3-lines, early d4, d6/Na5, d6/d4/Bg4
```

## 2. Before/after judgments (deliverable §13.2)

Scale: 0 = not useful … 3 = highly useful for understanding the reference
position. "Before" for B1–B4/F1-F4/A2-B4 is the owner's reconstructed
reading; for the rest, the agent's first pass on the original card.

| unit | candidate (game) | before | after | changed? | information responsible (brief §6.4) |
|---|---|---|---|---|---|
| F1-A1 | Shuvalov–Alisa88 (2403/2339) 1-0 | 2 | **2** | slightly (confidence) | continuation family (member #1, the reference's own family) |
| F1-A2 | Rbecker–ACFKC (2311/2354) 0-1 | 2 | **3** | significantly | continuation family (#2, 8 games) + next-move menu: the other main branch |
| F1-A3 | altair17–keres123 (2057/2140) 0-1 | 2 | **1** | significantly | continuation family: singleton `Qc2 c5…` (1 game) — a one-off, not a direction |
| F1-A4 | Bijiwilton–marsya_marraf (1882/1950) 0-1 | 1 | **2** | slightly | family #3 (2 games, cross-game) + per-side black 0.50 (…f5 unimpeded) |
| F1-B1 | BOXPA–cancerpop (1809/1892) 0-1 | 3* | **3** | slightly (effort) | typed difference + route ("white also played `e3`") + per-side 0.50/0.00 |
| F1-B2 | Genik2016–alexraf1972 (1700/1703) 1-0 | 1* | **1** | slightly | continuation (liquidation); family membership exposed as self-only |
| F1-B3 | altair17–keres123 (2057/2140) 0-1 | 1* | **2** | significantly | route (16 shared plies, then `Qc2` vs `Ne1`) + menu singleton: a named side branch |
| F1-B4 | resb–lugoking (2257/2148) 0-1 | 3* | **3** | slightly (effort) | typed difference + route (`Nd2` one-move divergence) + w8 window (`b4` arrives) |
| F1-F1 | yanev76–BUCKAKING (1911/1957) 0-1 | 1 | **1** | no | typed difference (`bN e7→c5`) + route (7.d5/…Nbd7 line) confirm a different line |
| F1-F2 | CRUZATAM21–Alliced (2234/2314) 1-0 | 2 | **2** | slightly | king_position + route (`Be3` in, `O-O` out) + family #3 |
| F1-F3 | mikelol–red1728A (1804/1754) 0-1 | 1 | **1** | slightly (negative check) | route *corrects* the king_position label: both sides diverged, a different line |
| F1-F4 | tato158–bbhitalo123 (1519/1355) 0-1 | 2* | **3** | significantly | route (`h3` in, `O-O` out, same ply) + family #1 membership (return to the plan) |
| A2-B4 | lukcza–ENERGIE73 (2251/2284) 0-1 | 3* | **3** | slightly (effort) | family #2 (Marshall, 19g) vs ★#1 (Closed, 36g) + identical 13-ply route, candidate 1 ply earlier |

Four changed scores (A2 up, A3 down, B3 up/reframed, F4 up); nine
unchanged, of which all nine report the judgment became *cheaper to reach
and easier to defend* — the brief's core question answered affirmatively
even where scores stand still.

## 3. Changed judgments (deliverable §13.3)

**F1-A2 (2→3).** Original card: an exact match whose continuation `b4 a5
bxa5 c5` looks like "some queenside line". Contextual card: the position's
decision menu in one line (`Ne1 14× · b4 9× · …`), membership in family
#2 (8 games), the reference game marked in #1. The candidate stops being
"a game" and becomes "the other main branch of this position's decision,
taken in ~30% of the corpus". That is close to the most useful thing a
historical candidate can be for this position.

**F1-A3 (2→1).** The reverse direction, equally valuable: the `Qc2 c5!?
dxc6 bxc6` continuation looks thematic on the original card (the KID
pawn-sac break), but the family table shows it is a **singleton** — one
blitz game in 28, nobody else chose this direction. The idea stays
interesting; the *historical evidence* is n=1. Context lowers the
judgment, which the experiment explicitly wants to catch.

**F1-B3 (1→2, reframed).** The owner's reading was "interesting game,
wrong question" (a query-relevance failure). The contextual card reframes
it: the route shows the games were **identical for 16 plies** and diverge
exactly at the reference position, where white chose `Qc2` instead of
`Ne1` — and `Qc2` is itself on the position's menu (a 1-game branch). So
B3 is not an off-topic lookalike; it is *a documented side branch of the
reference position's own decision menu*, with black's sharp `…c5!?`
answer attached. Under the brief's question ("useful for understanding the
reference position"), that is a 2. The §8-B3 test — "does continuation
context make it easier to *reject* a structurally similar but conceptually
different candidate?" — answers **yes, but by reframing rather than
rejecting**: acceptance/rejection becomes a deliberate choice about which
menu branch is being investigated, not a similarity artifact. (Note:
F1-A3 and F1-B3 are the same game one ply apart; the cards make that
obvious via identical routes and game lines — a dedup pairing the original
presentation hid.)

**F1-F4 (2→3).** The original card shows an offbeat deviation by weak
players (`h3`, uncastled king). The contextual card makes its exact shape
unmistakable: route = "shared 10 plies, diverge at ply 11: reference
`Be2`, candidate `h3`; white also played `h3`, white did not play `O-O`,
both reached the position at the same ply" — a one-tempo deviation with a
clean transposition back — and the continuation `O-O Ne8 Ne1 f5` **joins
family #1** (13 games, the reference game's own family) at 0.6. So the
candidate is mechanically "the main plan survives the h3 tempo and a late
castle" — the owner's interesting question ("is castling actually
necessary / what does h3 cost?") now has the plan-robustness evidence
attached, and the weak-player caveat stays visible in the history section.

## 4. Unchanged judgments (deliverable §13.4)

**F1-B1 (3→3), the §8-B1 test: does the card make the tempo relationship
visible without manual reconstruction? Yes, completely.** The tempo_twin
label, the route line ("shared 6 plies, diverge at ply 7: `e4` vs `e3`;
white also played `e3`; candidate reached the position 1 ply later") and
the per-side split (black's plan preserved 0.50 — `Ne8 h6 f5` vs `Ne8 f5
Kh8`, with `…Ne8` played immediately; white diverged 0.00 — reactive
`Bg5/Be3/Qc1`) are the owner's entire 02b reading, printed. The one gap:
B1 **joins no family** (nearest #1 at 0.33) — the tempo flip defeats the
multiset matcher at the joining step, exactly the Spike 04 failure; the
per-side decomposition, not the family, carries the case. Score unchanged
because the reading was already right; effort and confidence changed.

**F1-B2 (1→1), the §8-B2 test: can context distinguish B1 from B2? Yes,
by comparison, as Spike 04 predicted.** Per-side black: B1 0.50 vs B2
0.20; route: B1's extra move is `e3` (a pure tempo) while B2's is `Bd2`
(a setup choice); continuation content: immediate `…Ne8/…f5` vs
`…Nd7/…fxe4` liquidation. All relative, no absolute threshold — the
weakest kind of evidence, but it points the right way. **New finding:**
B2's "membership" in family #4 is tautological — #4 (`Bd2 Nd7 Qc1 f5`,
1 occ/1 game) is *B2's own game at ply 16*. Only the printed `1 occ / 1
game` count keeps the card honest (§6 below).

**F1-B4 (3→3), the §8-B4 test: exposed as interesting alternative without
a correctness claim? Yes.** The card shows the one-move divergence
(`Nd2` vs `Ne1` after 16 identical plies), the alternative plan's
mechanics in the w8 window (`a3`, `Rb1`, `b4` arrives at move 14), and
its rarity (singleton family). No claim that `Nd2` is good; the evidence
of *what it is* and *how it went* is all there.

**A2-B4 (3→3).** The maximally clean card: routes identical for 13 plies,
candidate one ply earlier (white has not spent `Re1`), then the games
diverge exactly at the decision: reference `7…d6` (→ ★family #1, Closed,
36 games), candidate `7…O-O` followed by `8.c3 d5` (→ family #2,
Marshall, 19 games) — with the menu counts `O-O 43× · d6 28×` above it.
The owner's 02b reading ("the tempo twin chose the other branch of the
decision menu") is fully mechanical.

**F1-A1 (2→2), F1-A4 (1→2), F1-F1 (1→1), F1-F2 (2→2), F1-F3 (1→1).**
A1's score stands, but the reason sharpens from "an exact match" to "a
representative of the modal family (13/28 games, the reference's own)".
A4 rises slightly: family #3 is real (2 games, cross-game clean) and the
per-side split shows black's `…f5` unimpeded by the `a3+b4` hybrid.
F1's `piece_setup` label (`bN e7→c5`) plus the route (7.d5/…Nbd7/…Nc5)
confirm a different line — no change. F2 stays 2 with a sharpened story
(uncastled king + immediate `b4` + family #3). F3 is the quiet negative
case: the bare `king_position` label oversells it as "the tabiya,
uncastled"; the route shows **both** sides diverged (7.d5 `Nbd7` 8.`Be3`
`Ng4`) — a different line entirely. Label + route together are the
correct unit; the label alone would have misled.

## 5. Most useful contextual signals (deliverable §13.5)

Ranked by how often they carried or changed a judgment:

1. **Route divergence + per-side extra/missing moves** (the move-order
   information). Carried B1 (`e3`), F4 (`h3`/`O-O`), B3/B4 (one-move
   divergence), F2/F3 (which moves *each side* spent differently), A2-B4
   (identical 13 plies, one ply earlier). It converts "reached the same
   position differently" from manual reconstruction into one printed
   line, and it is pure list arithmetic on data already extracted.
2. **Typed differences with square detail.** The anchor for every
   near-twin (unchanged from Spike 04, confirmed under re-judgment) —
   but see §6.2: insufficient alone.
3. **Continuation family *with sizes, game counts and the reference-game
   marker*.** Splits the exact quartet (#1/#2/#7/#3 with the reference in
   #1), quantifies modal-vs-one-off (A2's upgrade, A3's downgrade), and
   frames F4's return-to-plan. The counts are load-bearing; bare
   membership misleads (§6.1).
4. **Per-side continuation split.** Decisive exactly where Spike 04 said
   it would be (B1: black executes/white reacts) and quietly useful
   elsewhere (A4's black 0.50; F4's black 0.50).
5. **Next-move distribution.** The decision menu in one line; cheapest
   signal on the card; anchors every "which branch" reading.

## 6. Unhelpful or confusing signals (deliverable §13.6)

1. **Singleton self-membership (B2, B3, B4).** A near-twin one ply after
   the reference position "joins" the family containing its own game at
   the reference ply — membership is tautological. The card's `1 occ / 1
   game` count is the only thing exposing it. A future UI should flag or
   suppress "family contains only this game" (a one-line check on the
   game's id). Without that, family membership oversells exactly the
   near-twin candidates it should describe.
2. **A bare typed label without the route (F1-F3).** `king_position`
   says "kings on different squares, castling differs" — true, and
   compatible with both "the tabiya, uncastled" (F4) and "a different
   line where neither side matched the route" (F3). The route section
   disambiguates; the label alone overclaims. Difference and route are
   one signal, not two.
3. **Raw continuation similarity numbers in isolation.** The
   multiset/per-side/sequence table helped only in the B1-vs-B2 contrast
   set; on a single card, 0.09 vs 0.20 says nothing (Spike 04 §5.4's
   B2-vs-B4 warning confirmed under re-judgment: identical numbers,
   opposite usefulness). Keep the numbers for comparison views, not as
   per-candidate decoration.
4. **The three-window spread** (w4/w6/w8) makes Spike 04's window
   dilution visible (F4's same_plan signal lives at w4), which is honest
   but three numbers per metric is mild overload; a future UI should show
   one window with the sweep on demand.

## 7. Implications for the search engine (deliverable §13.7)

A candidate result should expose — as evidence, never fused:

* the **typed difference(s) with square detail** and the **one-line route
  divergence** with per-side extra/missing moves (together one unit);
* the reference position's **decision menu**: next-move counts and the
  family list with occurrence/game counts and the reference game's own
  family marked;
* the candidate's **family membership**, the family's game count, and a
  **"same game" / singleton flag** (§6.1);
* the **per-side continuation split** whenever the side to move differs;
* **historical context**: occurrence counts (candidate key, reference
  key), ratings, result.

Do not ship the per-window similarity table as a default card element;
keep it for a compare affordance. No relevance score anywhere (brief §3,
unchanged — this spike's singleton and label-without-route failures are
exactly what a fused number would hide).

## 8. Recommendation for Spike 06 (deliverable §13.8)

The simpler continuation representation is **not** clearly insufficient
(brief §12's gate for plan-skeleton tokenization): it carried 12 of 13
units. What is missing is precisely documented: **a tempo-flipped
continuation cannot join its plan family** (B1: nearest #1 at 0.33 while
black's plan executed on schedule). Spike 06, smallest sharp form: test
the *plan-skeleton tokenization* (Spike 04's deferred upgrade — per-color
multiset of pawn breaks + minor-piece destinations, e.g. black `{N→e8,
P→f5}`) **only against that failure**, on these same 13 units.
Falsifiable: B1 joins the kingside family (black's `{N→e8, P→f5}`
executes early) **and** the separations this spike relied on survive —
F1's `Be3`/`Nd3`/`f3` support-move variants stay apart, A2's Marshall
(`{P→d5}`) and Closed (`{P→d6}`) stay apart, F1's kingside and queenside
families do not blob. If the skeleton passes, it becomes the family-joining
representation for stm-flipped candidates; if it over-merges, the
per-side decomposition stays the tempo-twin answer and the failure is
accepted as documented. Secondary candidate if a second experiment is
wanted: rerun this sheet's format on 3 fresh references (e.g. C1, D1, E1)
to check the card generalizes beyond F1/A2.

## 9. The central question (brief §14)

> **Does contextual historical evidence make it easier for a human to
> identify why a candidate is useful or irrelevant?**

**Yes.** Four judgments changed for structural reasons (both directions —
context upgraded A2/B3/F4 and downgraded A3), and the nine unchanged
judgments became cheaper to reach and better grounded. And:

> **Which contextual signals actually help?**

Route/move-order comparison and typed differences (as one unit);
continuation families *with their counts and the reference marker*;
per-side continuation for tempo-flipped candidates; the next-move menu.
Raw continuation similarity numbers help only in contrast sets, and bare
labels/family memberships without their guards (route, game counts) can
mislead — the two documented failure modes are the singleton
self-membership and the label that oversells.

---

## Appendix: reproduction

```sh
cd spike/position_retrieval
mix test                                  # 73 tests (7 new)
mix spike.sim.rejudge --games 100000      # index load ~3 min, then <1 s
# artifacts: data/sim-rejudge-100000.json, data/sim-rejudge-sheet-100000.html
```

Cluster signatures cross-validated against `data/sim-continuation-100000.json`
(F1 multiset@0.5/w4 → 13/8/2/1/1/1/1/1 with the reference in the 13-cluster;
A2 LCS@0.6/w4 → 36/19/4/4/3/2/2/1 with the reference in the 36-cluster).
Singleton-family sources verified against `sim-keys-100000.tsv` +
`sim-moves-100000.tsv` (family #4 = F1-B2's own game gid 89889 at ply 16;
#5 = F1-B4's gid 46130; #7 = F1-A3/B3's gid 83740).
