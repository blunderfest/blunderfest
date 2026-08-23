# Technical Spike 04 — Historical Continuation & Plan Patterns: Report

Status: **done** (experiments A–D executed on the 100k tier; the Phoenix app
untouched, ADR-0001 intact). Spike brief:
[`technical-spike-04-historical-continuation-and-plan-patterns.md`](technical-spike-04-historical-continuation-and-plan-patterns.md).
Starting points: [Spike 02 report](technical-spike-02-similarity-and-relevance-report.md),
[Spike 02b report](technical-spike-02b-relevance-analysis-report.md).
Code: `spike/position_retrieval/lib/sim/continuation.ex` (representations +
similarity), `difference.ex` (typed differences), `continuation_lab.ex`
(experiment driver), `mix spike.sim.continuations`; 29 new tests (66 total
green in the spike project). Artifact: `data/sim-continuation-100000.json`
(2.2 MB, full per-reference digests).

> **TL;DR** — Yes, with two qualifications. Continuation content cleanly
> does the one thing position similarity provably cannot: separate
> same-plan from different-plan candidates at *identical* positions (F1's
> exact matches split 2-vs-2 with zero positional signal to separate them;
> continuation side-similarity splits them 0.35/0.25 vs 0.00/0.00).
> Threshold-clustered continuations reproduce both known decision menus
> from the corpus — A2's Marshall/Closed split and F1's
> kingside/queenside split, including the exact `Ne1 Ne8 {Be3,Nd3,f3} f5`
> trio from the brief — as single-linkage clusters, cross-game clean.
> Qualification one: **tempo twins defeat content-level continuation
> similarity** (B1 scores 0.14–0.25, below every merge threshold — the
> flipped side-to-move shifts the interleaving), so the typed-difference
> label must carry those cases; continuation similarity ranks them
> correctly only *relative* to the other near-twins (B1 > B2 ≈ B4 > B3 is
> exactly the corpus order 0.20 > 0.09 = 0.09 > 0.00). Qualification two:
> single linkage **chains** at low thresholds/long windows (F1's kingside
> and queenside families merge into one 24-game blob at side@0.4/w6), and
> window size trades plan-resumption against dilution (F1-F4's "return to
> the standard plan" is a window-4 signal, 0.67, diluted to 0.35 at
> window 6). Recommendation: continuation patterns become a first-class
> *annotation and clustering* dimension — never a fused score — and the
> next experiment is the focused re-judgment sheet (02b's E4) with the
> annotations from this spike on every card.

---

## 1. Experimental setup

### Data and candidate sets

* Corpus: the Spike 01/02 artifacts, unchanged — Lichess 2017-05,
  **100k games, 6,714,883 plies, 5,833,793 distinct position keys**,
  per-game mainline SAN lists (`sim-moves-100000.tsv`), game metadata
  (`sim-games-100000.tsv`).
* Reference positions: the Spike 02 query set (12 references, A1–F2),
  loaded from `sim-queryset-100000.json`.
* Qualitative units: the Spike 02 candidate set
  (`sim-candidates-100000.json`), which contains the grounded units from
  the owner's manual evaluation — F1-B1…B4 and F1-F4 (all candidates of
  reference F1, the King's Indian Classical tabiya) and A2-B4 (the
  unspent-tempo twin of reference A2, the Ruy López tabiya).
* Occurrence sets: for each reference, all exact occurrences
  (`key → [(gid, ply)]` via the Spike 01 packed index), corpus-order
  sampled to ≤ 400 (binds only C1/C2, 1711/2448 occurrences).

### Continuation windows and representations

Windows of **4 / 6 / 8 / 10 half-moves** after each position (brief §5),
SANs normalized (check/mate/annotation suffixes stripped). Five
representations (`Spike.Sim.Continuation`), most literal first:

| representation | definition | similarity |
|---|---|---|
| `seq` | the move sequence itself | normalized LCS, `2·|LCS|/(|a|+|b|)` |
| `multiset` | unordered move multiset | multiset Jaccard (multiplicity-aware) |
| `side_multiset` | per-color multisets, color-aligned | mean of per-color Jaccards |
| `piece_dest` | multiset of piece→destination tokens (`N→e1`, `P→f5`, `O-O`) | multiset Jaccard |
| `piece` | multiset of moving piece types | multiset Jaccard |

`side_multiset` is the representation invented for this spike, to survive
a tempo flip: when the candidate has the other side to move, each side's
moves still land in the same color bucket.

### Clustering (experiment B)

Distinct sequences per (reference, window), weighted by occurrence count;
pairwise similarity under each metric; **single-linkage connected
components** at thresholds 0.3 / 0.4 / 0.5 / 0.6 / 0.75. Every group and
cluster reports `occurrences` and `games` (distinct game ids) so the
brief-§9 same-game trap stays visible.

### Typed differences (experiment C)

`Spike.Sim.Difference` enumerates the positional types from 02b §5.7 —
`:tempo_twin` (identical placement, other side to move), `:near_twin`
(same skeleton+material, other side to move, exactly one piece relocated,
with square detail), `:piece_setup` (same, side to move equal),
`:king_position`, `:material`, `:structure` — plus three continuation
types: `:same_plan` (multiset Jaccard ≥ 0.5), `:timing_shift` (same moves,
different order: multiset ≥ 0.5 and LCS < 0.75), `:plan_divergence`
(near-identical position, Jaccard < 0.2). Every diff carries a
human-readable detail line ("wR e1→f1, white to move").

### Ordering comparison (experiment D)

Per reference, three orderings of the Spike 02 candidate pool — **M1**
position dims only (Spike 02's bucket rank), **M2** structural tier
(exact / same skeleton / other) then continuation similarity within tier,
**M3** = M2 annotated with typed differences. No fused score anywhere.

## 2. Results

### 2.1 Experiment A — the pattern census

Group counts per (reference, window, representation); each cell is
distinct groups over the sampled occurrences:

| ref | occ | w4: seq → ms → side → pd → pc | w10: seq → pc |
|---|---|---|---|
| A2 | 71 | 27 → 21 → 21 → 21 → **8** | 61 → 32 |
| F1 | 28 | 20 → 20 → 20 → 20 → **11** | 27 → 20 |
| C1 | 1711 | 216 → 185 → 185 → 183 → **23** | 395 → 110 |
| C2 | 2448 | 286 → 255 → 255 → 255 → **39** | 399 → 184 |
| E1 | 3 | 3 → 3 → 3 → 3 → **1** | 3 → 1 |

Three facts:

1. **Multiset identity merges only true transpositions, and they exist.**
   A2 at window 4: 27 sequences → 21 multisets — e.g. `d6 c3 O-O h3` and
   `O-O c3 d6 h3` collapse. F1: 20 → 20, nothing merges (02b confirmed:
   F1's variety is *content* — Be3 vs Nd3 vs f3 — not order).
2. **Piece-level abstraction collapses an order of magnitude more** —
   C2: 286 → 39 at window 4. That is too aggressive as an identity key
   (it would merge the Marshall with the Chigorin), but see E1 below for
   where it shines.
3. **E1's endgame anecdote survives abstraction exactly as hoped.** E1's
   three occurrences have three different sequences (`Qa6+ Kb3 Qb5+ Ka3…`
   variants) that are **one group at piece level** (Q-checks + king moves)
   at every window — Spike 02's "transformation repeating while static
   positions differ" (H8) is a piece-level continuation pattern.

### 2.2 Experiment B — plan-pattern clustering reproduces the decision menus

**F1, window 4, multiset Jaccard, threshold 0.5 — 8 clusters:**

```text
13 occ / 13 games   Ne1 Ne8 Be3 f5 (5×) · Ne1 Ne8 Nd3 f5 (3×) · Ne1 Ne8 f3 f5 (2×) · …
 8 occ /  8 games   b4 a5 bxa5 c5 (2×)  · b4 Nd7 Qc2 a5 · b4 a5 Ba3 Nd7 · …
 2 occ /  2 games   a3 Nd7 b4 f5 · a3 Ne8 b4 f5
 1 occ /  1 games   Bd2 Nd7 Qc1 f5
 1 occ /  1 games   Nd2 a5 a3 Nd7        ← the F1-B4 game's own occurrence
 …
```

The brief's exact question — are `Ne1 Ne8 Be3 f5`, `Ne1 Ne8 Nd3 f5` and
`Ne1 Ne8 f3 f5` recognized as related despite the differing support move?
— is answered **yes**: all three land in one cluster (pairwise Jaccard
0.6 ≥ 0.5), together covering 13 of 28 occurrences across 13 distinct
games. The cluster next to it is the *other* plan of the position (the
queenside `b4` expansion). The position's two plans, separated; the plan
variants, merged.

**A2, window 4, LCS, threshold 0.6 — 8 clusters:**

```text
36 occ / 36 games   O-O c3 d6 h3 (9×) · d6 c3 O-O h3 (9×) · d6 c3 O-O d4 (5×) · …   ← Closed
19 occ / 19 games   O-O c3 d5 exd5 (17×) · O-O c3 d5 d3 (2×)                          ← Marshall
 4 occ /  4 games   O-O a3 d6 c3 · O-O d4 d6 c3 · O-O d4 d6 c4                         ← anti-Marshall-ish
 4 occ /  4 games   O-O a4 Bb7 c3 · O-O a4 Bb7 d3 · O-O a4 Rb8 c3
 …
```

The Marshall/Closed decision menu of 02b (next-move counts 43× O-O vs
28× d6) reproduced by clustering: transpositions merge *within* each
branch (`O-O c3 d6 h3` + `d6 c3 O-O h3`, 18 occurrences in one family)
while the branches stay apart. Note the metric matters here: LCS@0.6
separates the branches; multiset@0.4–0.6 chains them together (§5.1).

**The A2-B4 twin lands in the other branch.** The twin's continuation
`Re1 O-O c3 d5 …` (the unspent Re1 tempo, then the Marshall) scored
against A2's 27 distinct window-4 sequences: its nearest family is the
Marshall cluster `O-O c3 d5 exd5` at Jaccard 0.60 (the only differences:
the Re1 prefix and `exd5` at the window edge); the reference game's own
continuation `d6 c3 O-O d4` sits in the Closed cluster at 1.00. So "the
tempo twin chose the other branch of the decision menu" — the owner's
02b observation — is mechanically visible as *cluster membership*.

### 2.3 Experiment C — typed differences on the grounded units

Every qualitative unit's typed differences, detected automatically
(golden-tested against the corpus keys):

| unit | positional diffs (auto) | continuation (w6) | human's 02b description |
|---|---|---|---|
| F1-B1 | `tempo_twin` — identical placement, black to move | — | "different move order / tempo loss" |
| F1-B2 | `near_twin` — wB c1→d2, black to move | `plan_divergence` (0.09) | "similar, continuation less informative" |
| F1-B3 | `near_twin` — wQ d1→c2, black to move | `plan_divergence` (0.00) | "similar position, different plan" |
| F1-B4 | `near_twin` — wN f3→d2, black to move | `plan_divergence` (0.09) | "different plan, useful follow-ups" |
| F1-F4 | `king_position` (wK g1→e1, castling `-` vs `KQ`) + `structure` (h-pawn) | `same_plan` + `timing_shift` **at w4** | "h3 deviation, then returned to plan" |
| A2-B4 | `near_twin` — wR e1→f1, white to move | — (0.20) | "unspent tempo; the Marshall branch" |

All six human-described differences are exposed with the right type and
the right squares. The two mechanics the taxonomy cannot tell apart are
named honestly: `near_twin` covers both "unspent tempo" (A2-B4's Re1)
and "alternative setup with a tempo flip" (F1-B4's Nd2) — the square
detail is the story, and distinguishing those two is semantic, not
mechanical.

### 2.4 Experiment D — continuation changes the candidate order

F1, M1 (position-only) → M2 (tier, then continuation similarity):

```text
M1 #6-9:  F1-E4, F1-E3, F1-E2, F1-E1   (14/14 pieces, pawn mismatch 2-5)
M2 #17-20: the same four               (continuations share 0.00 with the reference)
```

Piece-placement matching with a different pawn skeleton produced
confident-looking candidates whose games go *nowhere near* the reference
plan; continuation similarity sinks all four to the bottom. Within the
exact tier (zero positional signal to separate them), continuation splits
the same-plan games (A1 `Ne1 Ne8 f3 f5…` 0.35; A4 `a3 Ne8 b4 f5…` 0.25)
from the different-plan games (A2 `b4 a5 bxa5…`, A3 `Qc2 c5 dxc6…`: both
0.00). In the near-twin tier the corpus order is B1 (0.25) > B2 ≈ B4
(0.09) > B3 (0.00) — the same order as the owner's usefulness ranking,
with B3's "different plan" flagged as a clean zero at *every* window and
representation.

## 3. Comparison: position-only vs position + continuation

Answer to brief §8's question — does continuation information produce
more useful candidates than positional similarity alone? On the
qualitative set, yes, in three distinct ways:

* **It ranks where position is silent.** Exact matches are positionally
  identical; continuation is the *only* signal that separates F1-A1/A4
  (kingside plan) from F1-A2/A3 (queenside plans). Same for A2's exact
  matches (0.50–0.60 for Closed-family continuations).
* **It filters where position is fooled.** The four F1-E cross-structure
  candidates (14/14 pieces!) all score 0.00 continuation similarity and
  drop 8–14 ranks. Spike 02's "confident garbage" failure mode gets a
  measurable antidote.
* **It confirms the negative.** B3's 0.00 at every window is the
  mechanical version of "interesting game, wrong question" — a
  query-relevance failure the system can now *show* instead of silently
  ranking B3 above B4 on piece matches (M1 does: #11 vs #12; M2 fixes
  it: #10 vs #7).

What it does **not** do: rank B4 above B2 (both 0.09 — B4's value is its
typed difference, the alternative Nd2 setup), or rescue B1 to a
high-similarity candidate (§4.1). Continuation similarity is a
*discriminator between comparable candidates*, not a relevance score.

## 4. Qualitative validation (B1–B4, F1-F4)

### 4.1 B1 — the tempo twin

*Can the continuation distinguish this from a merely similar position?*
Mostly **no, and that is itself the finding.** B1's continuation
`Ne8 Bg5 h6 Be3 f5 Qc1` shares only {Ne8, f5} with the reference's
`Ne1 Ne8 Nd3 f5 Bd2 Kh8` (w6 multiset 0.20): the flipped side-to-move
shifts the interleaving, and white's three moves in the window (Bg5, Be3,
Qc1) are reactive, not the reference's Ne1/Nd3/Bd2 build-up. Content-level
similarity can never score this high. What *is* mechanically visible:
(a) the `tempo_twin` positional label; (b) the color-aligned decomposition
— black's plan content is preserved (ref black {Ne8, f5, Kh8} vs B1 black
{Ne8, h6, f5}: Jaccard 0.50) while white's is not (0.00) — i.e. *"black
executes the plan, white is a tempo behind"*; (c) B1's first move **is**
the reference plan's first black move (…Ne8 immediately — the freed tempo
spent on the plan's key move, exactly the owner's reading). Still, among
the four near-twins B1 scores highest on every continuation metric —
continuation similarity ranks the twins correctly even though its absolute
value stays low.

### 4.2 B2 — the uninformative one

*Can continuation explain why B2 is less interesting than B1?* **Yes, by
comparison.** B2 `Nd7 Qc1 f5 Bg5 fxe4 Nxe4` starts a different knight
route and liquidates; w6 multiset 0.09 vs B1's 0.20, and B2 is flagged
`plan_divergence` while B1 is flagged with nothing (0.20 sits above the
0.2 divergence threshold). The margin is thin — this is the weakest of
the six validations, and it relies on the relative ordering, not an
absolute threshold.

### 4.3 B3 — the different plan

*Can continuation patterns reveal the difference?* **Yes, cleanly.** `c5
dxc6 bxc6 b4 Be6 a4` scores 0.00 on every metric at every window — the
queenside strike shares not a single move with the kingside plan. The
`plan_divergence` flag fires with the maximum contrast. This is the
strongest validation in the set.

### 4.4 B4 — the alternative plan

*Alternative plan rather than noise?* **Via the typed difference, not the
continuation.** B4's continuation (`a5 a3 Nd7 Rb1 f5 f3`) scores 0.09 —
indistinguishable from B2's. But its positional diff is `near_twin: wN
f3→d2`, and the F1 occurrence clustering (§2.2) shows B4's own game
belongs to the small `Nd2 a5 a3 Nd7` family — a real, repeated
alternative setup, not noise. The system exposes "one relocated piece +
an actual alternative continuation family"; whether that is *interesting*
remains the human's call — which is the spike's guiding principle.

### 4.5 F1-F4 — the h3 deviation that returns to the plan

*Interesting alternative vs irrelevant deviation?* **Yes — at window 4.**
F1-F4's continuation `O-O Ne8 Ne1 f5 f3 f4` scores 0.67 side / 0.60
multiset at w4 — **as high as the best same-plan exact match (F1-A1:
0.67/0.60)** — and is flagged `same_plan` + `timing_shift` (same moves,
different order). Its typed differences (`king_position`: uncastled,
rights intact; `structure`: the h-pawn) name the deviation. So both
halves of the owner's reading are mechanical: *what* the deviation was
(h3, king still on e1) and *that* the game then returned to the standard
plan. Caveat: at window 6 the signal dilutes to 0.35/0.33 and the flags
stop firing — window choice matters (§5.2).

### 4.6 Verdict

The six grounded units: 2 clean yes (B3, F1-F4), 1 yes-by-comparison
(B2), 1 yes-via-typed-difference (B4), 1 split (B1: ranked correctly,
labeled correctly, but absolute continuation similarity low), 0 wrong.
No unit contradicts the human reading; two units (B1, B4) demonstrate
that continuation similarity and typed differences **need each other** —
neither alone covers all six.

## 5. Failure cases

### 5.1 Single-linkage chaining at low thresholds

F1, window 6, side-multiset @ 0.4: the kingside family (`Ne1 Ne8 Be3 f5
f3 f4`) and the *queenside* family (`b4 a5 bxa5 c5 Nd2 Rxa5`) merge into
one **24-game blob** — the two plans the 0.5-threshold/window-4 setting
separates perfectly. Single linkage merges on any bridging pair; longer
windows and per-side averaging raise the chance of intermediate sequences
bridging two plans. A2 shows the same at multiset@0.4–0.6/w4 (Marshall
chained to Closed, 69-game blob). **Consequence: never ship one
threshold.** Report the cluster structure across the threshold sweep (a
cheap dendrogram), or use complete linkage; the sweep costs nothing —
edges are computed once.

### 5.2 Window-size sensitivity

F1-F4's return-to-plan is visible only at window 4 (0.67 → 0.35 → 0.33 at
w4/w6/w8): the deviation consumed one ply of the window, and moves 5–6 of
the two games diverge legitimately. Conversely B1 vs B2 separates only
from window 6 up (B1's …f5 lands at offset 4). No single window size
carries both; the artifact computes all four precisely so that consumers
never have to choose blind.

### 5.3 Tempo twins defeat content similarity

§4.1. Any continuation-similarity ranking applied to other-stm candidates
will systematically underrate exactly the candidates 02b found most
interesting. Mitigation: color-aligned per-side decomposition (rescues
the plan-execution side) + typed-difference labels (carry the tempo
story) — both implemented; but a fused "continuation similarity" number
would hide the failure. Another reason for annotations over scores.

### 5.4 Continuation similarity ≠ informational value

B2 vs B4 (§4.4): identical scores, opposite usefulness. And the endgame
extreme: E1's three occurrences have *identical* piece-level continuations
— a real repeated pattern (the checking maneuver), but "the same thing
happened again" is only weakly informative on its own. Continuation
patterns find *what happened next*; whether that illuminates the
reference stays a separate question (02b's similarity / informational
value / query relevance split survives this spike intact).

### 5.5 Latent corpus-segmentation bug found (engineering note)

`Spike.Corpus.stream_games/1` silently drops a final game that lacks a
trailing blank line: the `:eof` clause matches a state atom
(`:in_game`) the segmenter never uses (`:in_movetext`). Harmless for the
published artifacts (the Lichess export ends with a blank line; all
counts were cross-validated in Spikes 01/02), and this spike deliberately
did **not** change it — a fix alters extraction output by one game and
would desync fresh extractions from the published TSVs. Flagged for the
owner; test fixtures now carry the trailing blank line explicitly.

## 6. Complexity

* **Compute.** All experiments for all 12 references: **11.3 s** total
  (after the shared index load — unchanged Spike 02 loader, ~3 min /
  5.7 GB at 100k). Per reference: ≤ 59 ms, except the two 400-occurrence
  opening hotspots C1/C2 at 5.1/5.9 s — dominated by the pairwise
  similarity matrix over ~300–400 distinct sequences (O(n²) × 5 metrics ×
  2 cluster windows). With the 400-occurrence cap, that cost is *flat in
  corpus size*: the 1M tier changes which references hit the cap, not the
  per-reference cost. If hotspot clustering ever hurts, cluster the
  distinct *multisets* first (identical multisets need no pairwise work)
  and only threshold-cluster the representatives.
* **Storage.** Nothing new is indexed. Continuations are slices of the
  per-game SAN lists Spike 02 already stores (`sim-moves`, ~100k rows /
  a few MB); occurrences come from the Spike 01 packed index;
  representations and clusters are computed on read. The full 12-ref
  artifact is 2.2 MB of JSON. A production shape would precompute, per
  distinct position key with ≥ 2 occurrences: next-move distribution +
  top multiset clusters (a few hundred bytes each) — comfortably inside
  the derived-index budgets Spike 03 measured.
* **Indexing.** No new index structures needed beyond Spike 02's
  (distinct-key features, pawn buckets, occurrence lists, SAN lists).
  Typed differences are pure feature arithmetic on the candidate pair.
* **Feasibility.** Technically plausible at the discussed scale; the
  open scale question is unchanged from Spike 02 (cold positions at 100k
  — B1/B2/D1/D2/E1/E2 have 1–3 occurrences, so their "clusters" are
  degenerate and no continuation analysis adds anything — the 1M-tier
  rerun remains the answer to that).

## 7. Recommendation

> **Yes — continuation patterns should become a first-class dimension of
> the historical search engine**, as *annotations and a clustering
> device*, not as a score:

1. **Cluster the exact-occurrence continuations** (the decision menu) and
   show cluster membership on every exact-match candidate ("this game
   belongs to the 17-game Marshall branch; the reference game is in the
   36-game Closed branch"). Cost: trivial; demonstrated end-to-end.
2. **Annotate every structural candidate with its typed differences and
   per-side continuation similarity.** The six grounded units show the
   pair (label + continuation numbers) reproduces the human reading where
   either signal alone fails (B1, B4).
3. **Never fuse into a relevance score** (consistent with 02b; this
   spike's chaining and tempo-twin failures are exactly the kind of
   structure a fused number would hide).
4. **Keep the threshold sweep, don't pick a winner.** The useful
   threshold is representation- and position-dependent (F1 merges at
   multiset@0.5/w4; A2 separates at LCS@0.6/w4); show the hierarchy.

**Next experiment:** the focused re-judgment sheet (02b's E4, ~30 units)
with decision-menu cluster membership, typed differences, and per-side
continuation similarities printed on every card — the falsifiable test of
whether these annotations change the owner's judgments in the predicted
directions. Alongside it, one representation upgrade worth testing on the
same units: a *plan-skeleton* tokenization (per-color multiset of pawn
breaks + minor-piece destinations, e.g. black `{P→f5}`, white `{N→e1,
B→e3}`) — one abstraction step above raw SAN that should merge the KID
trio *and* catch the tempo-shifted B1 case (black's `{Ne8, f5}` executes
early) without reaching piece-level's over-merging. If a third experiment
is wanted: complete-linkage clustering to kill the chaining failure
mechanically.

## 8. The central question

> **Can we use what happened after a historical position to distinguish
> "similar position" from "similar chess idea" without explicitly
> understanding the chess idea?**

**Yes, conditionally.** The conditions found by this spike:

* *Where the positions are identical or near-identical, continuation
  content is a reliable plan proxy*: same-plan and different-plan games
  separate at 0.5-vs-0.0 contrast, and continuation clusters reproduce
  human-named plan families (Marshall/Closed; KID kingside/queenside)
  with transpositions merged — no chess understanding required, only
  move counting.
* *Where the difference is a tempo flip, raw continuation content fails
  mechanically* and the answer must come from the typed difference plus
  color-aligned decomposition — still no semantics, but no longer one
  similarity number.
* *"Different" is as valuable as "same"*: the decision menu's other
  branch (A2-B4's Marshall), the clean 0.00 of B3, and the
  `plan_divergence` flag are all *divergence* signals, and they are
  exactly as actionable as the same-plan matches.

That is the bridge Spike 02 hoped existed: position similarity generates
candidates, continuation patterns and typed differences tell the strong
spectator *which kind of historical evidence each candidate is*.

---

## Appendix: reproduction

```sh
cd spike/position_retrieval
mix test                                        # 66 tests (29 new)
mix spike.sim.continuations --games 100000      # index load ~3 min, experiments ~11 s
# artifact: data/sim-continuation-100000.json
```

The A2-B4/Marshall membership check (§2.2) is a ~30-line Python probe over
`sim-keys-100000.tsv` + `sim-moves-100000.tsv` (kept out of the repo, per
the spike-02b probe convention; described in §2.2 verbatim).
