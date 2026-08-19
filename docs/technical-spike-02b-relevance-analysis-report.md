# Technical Spike 02b — From Similarity to Relevance: Report

Status: **done** (conceptual model + corpus probes; no production code touched).
Spike brief: [`technical-spike-02b-relevance-analysis.md`](technical-spike-02b-relevance-analysis.md).
Phase 1 report: [`technical-spike-02-similarity-and-relevance-report.md`](technical-spike-02-similarity-and-relevance-report.md).
All measurements run on the existing 100k-tier artifacts in
`spike/position_retrieval/data/` (Lichess 2017-05, 100k games, 6.71M plies,
5.83M distinct keys — Spike 02's extraction, unchanged).

> **TL;DR** — The qualitative evaluation says the useful candidates are useful
> *because of a typed difference from the reference, plus what happened next*,
> not because of raw similarity. The two strongest patterns (a tempo twin with
> identical placement but the other side to move; an exact-match set whose
> continuations split into named strategic branches) are both **mechanically
> derivable from data we already have** — proven by three one-off probes
> (§4.2/§4.3/§5.3): same-placement/both-stm positions exist in the hot head
> (7,970 placements, 3.1% of all plies), move-order routes to a position can be
> diffed to find where the tempo went, and continuation clustering over exact
> matches reproduces A2's Marshall-vs-Closed decision menu almost verbatim.
> Similarity, informational value, and query relevance are three different
> signals and should stay separate annotations, never a fused score. Next:
> two small candidate-generation experiments (continuation clusters, tempo
> twins) and a ~30-unit focused re-judgment — not a relevance algorithm.

## 1. Evidence base

Three sources, with different epistemic weight:

1. **The owner's qualitative observations** (brief §3, labels B1–B4, F1-F4,
   A1 vs B1-E1). The formal 0–3 scoring in `sim-judgments-100000.tsv` is still
   blank (tally: 0/144 judged) — this phase deliberately treats the
   observations as an expert exercise, not a dataset.
2. **Grounding**: every observation label maps to a concrete judgment unit in
   the existing sheet/candidates JSON. The B1–B4 labels match reference F1's
   B-strategy candidates (reconstructed from the sheet data; descriptions fit
   each unit's FEN, dimension line, and move context — §2).
3. **Corpus probes** (this spike): three one-off measurements over the
   existing TSV artifacts that test whether the *detectability* claims are
   actually true at corpus scale (§4.2, §4.3, §5.3).

## 2. The observations, grounded

Reference F1 (KID Classical tabiya, `r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/
2N2N2/PP2BPPP/R1BQ1RK1 w - -`, 28 occurrences, white to move). Its four
B-strategy candidates are the brief's B1–B4; all four share the pawn skeleton
(13–14/14 piece matches), and all four have the **side to move
flipped** — the same "who has the tempo?" difference, with four different
outcomes:

| label | unit | game (Elo) | difference from ref | continuation | why useful / not |
|---|---|---|---|---|---|
| B1 | F1-B1 | BOXPA–cancerpop (1809/1892) | **placement identical** (14/14); only stm differs | `Ne8 Bg5 h6 Be3 f5` | black's extra tempo becomes ...Ne8 immediately; the tempo question gets a concrete answer |
| B2 | F1-B2 | Genik2016–alexraf1972 (1700/1703) | Bc1→d2, stm flipped | `Nd7 Qc1 f5 Bg5 fxe4 Nxe4` | same tempo difference, but the game liquidates; consequence unclear |
| B3 | F1-B3 | altair17–keres123 (2057/2140) | Bc1 home + Qc2, stm flipped | `c5 dxc6 bxc6 b4 Be6 a4` | black strikes queenside (...c5), a *different strategic question* than the reference's kingside plan |
| B4 | F1-B4 | resb–lugoking (2257/2148) | Nf3→d2 setup, stm flipped | `a5 a3 Nd7 Rb1 f5 f3` | an alternative white setup; raises "when does Nd2 work?" without answering it |

Two more units complete the set:

* **F1-F4** (tato158–bbhitalo123, 1519/1355): white played `h3` and is *not*
  castled (Ke1, rights KQ) where the reference has O-O — king_distance 2,
  13/14 pieces. Continuation `O-O Ne8 Ne1 f5 f3 f4` (castles next move anyway).
  Weak players; still interesting: it poses "is castling actually necessary /
  what does h3 cost?" — evidence that **player strength is not a relevance
  filter**.
* **A1 vs B1-E1**: A1 is a Ruy López opening tabiya; B1-E1 is a rook endgame
  (Vinvin–Goalchessrobot123, 2185/2310). Both would score "active pieces" on a
  generic activity feature; in one it means development and centre control, in
  the other king activation and passed-pawn support. Strategy E retrieved it
  (piece-placement matching, 12 pawn mismatches) — confident-garbage territory,
  and the clearest possible argument that **abstract features are
  phase-conditioned**.

Reasoning chains (brief §6), condensed to the pattern that repeats across all
six: *same structure → one typed difference (tempo / piece / king) → what the
game did with it → useful iff the continuation engages the difference → the
question it answers or raises*. The value lives in the **difference and the
consequence**, not in the similarity score — similarity only made the
candidate findable.

## 3. Three concepts, separated (brief §8)

* **Similarity** — how much the candidate position resembles the reference.
  Measured, cheap, exists in `Spike.Sim.Features`. Generates candidates;
  demonstrably does not rank them (B3 is *more* similar than B4 and less
  useful; A1's most-similar E-candidates are garbage).
* **Informational value** — does the game tell us something about the
  reference? A property of the *(candidate game, reference)* pair: the tempo
  story (B1 yes, B2 not visibly), the plan contrast (B4), the decision branch
  (A2-B4, below). Partially derivable (§4); consequence *significance* is not,
  without engine evals.
* **Query relevance** — is that information what the investigator wants? A
  property of the *(candidate, question)* pair. B3 fails here with high
  similarity; "interesting game, wrong question" is a pure query-relevance
  failure. Needs user context (what board are they looking at, what line are
  they exploring); this is a product surface (Reference tab, search) before it
  is an algorithm.

Operational rule: every candidate carries all three as **separate
annotations** — dims (have), continuation cluster (§5.3, cheap), typed
difference (§5.7, cheap), informational flags (later) — and ranking composes
them only after each is individually validated.

## 4. Relevance dimensions & detectability (brief §5, §9.4)

### 4.1 Summary table

| dimension | relevant? | detectability | evidence |
|---|---|---|---|
| 5.1 position similarity | candidate generation only | **direct** (features.ex) | phase 1; B3 vs B4 here |
| 5.2 move-order relationship | **yes — strongest finding** | **derivable** | probes 1 & 3 (§4.2, §4.3) |
| 5.3 continuation | **yes — second strongest** | **derivable** (cluster level) | probe 2 (§5.3) |
| 5.4 preceding context | yes, as *route* comparison | **derivable** | probe 3 (§4.3) |
| 5.5 game phase | yes, as a conditioning filter | **direct** (piece count) | A1 vs B1-E1 |
| 5.6 plan / strategic function | partially — "what", not "why" | **difficult** | probe 2 limits |
| 5.7 interesting differences | **yes — retrieval principle** | **derivable** (typed diffs) | B1–B4, F1-F4 |
| 5.8 historical evidence | modifier, not filter | **direct** (Elo, occ, freq, result) | F1-F4 vs F1-B2 |

### 4.2 Move-order relationship — derivable, and bigger than expected

**Same placement, other side to move ("tempo twins"):** grouping all 6.71M
plies by piece placement:

* 7,970 placements (0.14% of 5.83M distinct) occur with **both** sides to
  move — rare among distinct placements, but they cover **209,617 plies
  (3.12% of the corpus)**: tempo twins live in the hot head.
* 925 of them have ≥10 occurrences, 159 have ≥100.
* The minority-stm split is not degenerate: median share 0.50; histogram
  {<0.1: 668, 0.1–0.25: 818, 0.25–0.4: 2,183, 0.4–0.5: 4,301}.
* F1's placement: 28× white-to-move, **2× black-to-move** — F1-B1 is one of
  the two. Strategy B found it by ranking; a placement-grouped index would
  find it *directly*.

**Near twins (one unspent tempo):** A2's placement occurs 71×, all
black-to-move — its tempo twin (A2-B4, lukcza–ENERGIE73 2251/2284) is the
reference position **one quiet move earlier**: white has not played Re1
(rook f1 vs e1, 13/14 pieces, stm flipped). Same pawn skeleton + piece
overlap + stm-flip detects this family (existing dims, no new machinery).

Two families, both cheap, both directly implementing "a player spent a tempo
before reaching the same position".

### 4.3 Preceding context is route comparison, not last-move diversity

Phase 1 measured prev-move diversity as 1–2 distinct moves and called H6 weak.
Probe 3 reframes it: reconstruct the **per-ply key sequence** of each game
(all in `sim-keys-100000.tsv`) and diff the routes.

Reference game (gid 1770, oldmisio 2329–Terpsicore 2308, E98):
`d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7` → F1 at ply 16,
white to move.
Tempo-twin game (gid 87136, BOXPA–cancerpop, E61):
`d4 Nf6 c4 g6 Nc3 Bg7 e3 O-O Nf3 d6 Be2 Nc6 O-O e5 d5 Ne7 e4` → same
placement at ply 17, **black** to move.

The routes are identical for 6 plies, diverge at ply 7 (`e4` vs `e3`), and
reconverge on the same placement — with the tempo difference mechanically
attributable: the e-pawn took two moves (e3 then e4) where the reference
spent one. The twin's continuation `Ne8 Bg5 h6` shows what the freed tempo
bought black. Divergence ply + tempo attribution are pure list arithmetic on
existing data.

**Bonus finding:** the A2-B4 twin's game continued `7.Re1 O-O 8.c3 d5!` —
the Marshall Attack (ECO C89) — while A2's own reference game played
`7...d6 8.c3 O-O 9.d4 Bg4` (C91, Closed). The candidate is the *other branch
of the reference position's decision menu* (probe 2: 43× O-O vs 28× d6).
That is exactly the "concrete historical comparison of consequences" the
brief's B1 observation describes, and it fell out of the data.

## 5. Continuation: the decision menu is derivable (5.3, 5.6)

### 5.3 Probe 2 — clustering next moves over exact occurrences

Over each exact occurrence of a reference key, take the next 4–6 SANs
(normalized: strip `+ # ? !`), cluster by exact sequence vs by **multiset**
(move-order-insensitive):

* **A2 (71 occ)** — next move: `O-O` 43×, `d6` 28× — the position's strategic
  decision in one line. Multisets at n=4: **26 sequences → 20 clusters**
  (e.g. `{O-O, c3, d6, h3}` 20× merges three orderings of the Closed setup).
  At n=6: 43 → 38, with recognizable named families: Marshall accepted
  `{c3 d5 exd5 Nxd5 Nxe5 O-O}` 10×; Marshall-with-d4 4×; Closed Chigorin
  `{Bc2 Na5 O-O c3 d6 h3}` 11×; early-...Na5 3×; d4-Closed 3×.
* **F1 (28 occ)** — next move: `Ne1` 14×, `b4` 9×, `a3` 2×, `Nd2` 1×,
  `Qc2` 1× — kingside preparation vs queenside expansion, in the raw counts.
  Multisets merge little here (20→20 at n=4): the variety is *content*
  (Be3 vs Nd3 vs f3 as the supporting move), not order.

**Interpretation (refines phase 1's H7):** move-order-insensitive comparison
merges true transpositions when they exist (A2), and correctly *refuses* to
merge plan variants that differ in content (F1's Be3/Nd3/f3 support moves).
Multisets are the right first representation; the next abstraction — plan
signatures (pawn-break set, which minor pieces went where) — is the
"difficult" part of 5.6 and is *not* needed for the first product cut:
**next-move distribution + top clusters over exact matches already render a
position's decision menu** ("what do players actually do here, and how does
each branch continue?").

### 5.7 Interesting differences are enumerable types

The useful candidates differed from their reference by *exactly one typed
difference*: stm flip (F1-B1), one unspent tempo (A2-B4), alternative piece
setup (F1-B4's Nd2), uncastled king (F1-F4, king_distance 2), one relocated
bishop
(F1-B2/B3). Every type is a check on existing dims (pawn_mismatches,
piece_overlap, king_distance, stm) — except "which pawn moved", which needs
pawn-symdiff *localization* (bit-level, trivial). Retrieval principle: list
candidates *because of* their typed difference, and label them with it
("tempo twin", "uncastled variant", "alternative-setup") — a difference is a
searchable feature, not noise.

### 5.8 Historical evidence: modifier, not filter

Directly available: Elo, result, event, date, ECO/opening, occurrence
counts, next-move frequency. The qualitative evidence warns against using
strength as a *filter*: the interesting F1-F4 (h3 vs castling) is the weakest
player pair on the sheet (1519/1355), while the uninformative F1-B2 is
1700+. Occurrence count and move frequency are better used as *context*
("this is the position's 3rd-most-popular branch, taken in 43 of 71 games")
than as ranking weights.

## 6. Failure modes (brief §7)

Where retrieval was technically reasonable but the result useless:

1. **Tempo-blindness** (new): exact matching with strict stm hides the
   B1-type twins entirely — currently only strategy B's ranking surfaces
   them, by accident.
2. **Similar-but-wrong-question** (B3): high structural similarity, plan
   contrast makes the game interesting but irrelevant to the reference's
   question. Query-relevance failure; no similarity threshold fixes it.
3. **Uninformative continuation** (B2): the right difference, nothing done
   with it. Informational-value failure; needs continuation content, not
   more similarity dimensions.
4. **Cross-phase abstract matches** (A1 vs B1-E1): piece-placement matching
   with 12 pawn mismatches bridges opening and endgame where "activity" means
   opposite things. Phase conditioning (piece count) is a mandatory filter.
5. Phase 1's measured failures remain: **same-game bucket contamination**
   for cold positions, **contextual degeneration** at shallow plies, and
   **confident garbage** from piece-placement-only ranking at the tail.

Pattern: failure modes 2–4 are all *silent* — the system returns a plausible
candidate with no signal that the interesting dimension (query fit,
continuation, phase) failed. The annotations of §3 are how the eventual UI
makes the failure visible instead of silently ranking.

## 7. Proposed next experiments (small, falsifiable)

1. **E1 — Continuation-cluster annotation.** Extend candidate generation to
   attach, per exact-match set: next-move distribution + top multiset
   clusters (n=4 and n=6). Owner judges 3–5 references (A2, F1, C1, D1, B2).
   *Falsifiable:* clusters either correspond to human-recognizable branches
   (A2 Marshall/Closed, F1 kingside/queenside) or they don't. Cost: ~1 day;
   probes already prototyped the computation.
2. **E2 — Tempo-twin retrieval (strategy H).** Two sub-strategies: (a)
   placement-exact, any stm; (b) skeleton-exact + 13/14 pieces + stm flip
   ("one unspent tempo"). Attach the typed label and the route-diff tempo
   attribution (§4.3). *Falsifiable:* on fresh references, do tempo twins
   raise tempo questions for the evaluator? Two known positives (F1-B1,
   A2-B4); pool sizes corpus-wide already measured (§4.2).
3. **E3 — Consequence proxy.** Per candidate, compute material-signature
   change / checks / captures within 6 plies after the match (per-ply keys +
   SANs — no engine). Hypothesis: B1-type candidates score high, B2-type low.
   *Falsifiable against the six grounded units of §2, then fresh ones.*
4. **E4 — Focused re-judgment.** A new ~30-unit sheet built from
   E1+E2 candidates for 3 references, with the three annotations (similarity
   dims, typed difference, continuation cluster) on every card. Success
   criterion: the owner's reasoning references the annotations, and 0–3
   scores *disagree* with similarity order in predictable, explicable ways.

Deferred (explicitly): plan-signature labeling (5.6's "why"), engine-based
consequence significance, query-relevance modeling. Each needs E1–E4's
results first.

## 8. Recommendation

**Build E1 and E2 next.** They are the two smallest experiments that directly
target the two strongest findings — the decision menu (A2's 43/28 split, its
cluster families) and the typed difference (tempo twins, proven to exist in
the corpus's hot head). Both are candidate-generation features; neither
touches ranking. Then run E4's focused sheet before any scoring work.

Do **not** build a relevance score, fused or weighted. The qualitative
evidence consistently shows the three concepts of §3 dissociate (B3: high
similarity, decent informational value, zero query relevance; F1-F4: modest
similarity, weak players, high informational value); a single number would
hide exactly the distinctions that made the useful candidates useful.

## 9. Assumption challenges (brief's closing instruction)

1. **Phase 1's "sequence comparison must be move-order-insensitive"** — only
   half right. Multisets merge transpositions when order is the only
   difference (A2: 26→20) and correctly keep content variants apart (F1:
   20→20). The remaining gap is plan *signatures*, not better sequence
   metrics — and it is not on the critical path.
2. **Phase 1's H6 "preceding context is weak"** — an artifact of the
   *prev-move* statistic. At the route level, preceding context carries the
   entire tempo story (§4.3). The dimension is strong; the measurement was
   wrong.
3. **"Do not assume stronger players = more relevant"** (brief §5.8) —
   confirmed, and stronger: on this sheet the *most* interesting weak-player
   candidate (F1-F4) and the *least* informative strong-ish one (F1-B2) both
   exist. Strength is context, not signal.
4. **"Position similarity is candidate generation, not relevance"** (brief
   §2) — supported, and sharpenable further: the most useful candidates found
   so far were useful *because of* one typed difference. Retrieval should
   enumerate typed differences as first-class queries, not only rank
   similarity.

## Appendix: probe methods & reproduction

All probes are single passes over existing artifacts (no new extraction; app
untouched):

```sh
cd spike/position_retrieval/data
# probe 1/1b: group sim-keys-100000.tsv by placement field; count stm
#   variants per placement (tempo-twin prevalence; §4.2)
# probe 2: for each occurrence of a reference key (grep sim-keys), take
#   next-4/6 SANs from sim-moves-100000.tsv, strip [+#?!], cluster by
#   sequence vs sorted multiset (§5.3)
# probe 3: filter sim-keys by gid {1770, 87136}, diff per-ply placement
#   sequences; SANs from sim-moves for narrative (§4.3)
```

Scripts were one-off (kept out of the repo); each is ~30 lines of Python
stdlib, reproducible from the descriptions above. Corpus facts they rely on:
6,714,883 key rows; 5,833,793 distinct keys; 5,825,574 distinct placements
(placement-stripped keys — a new fact, consistent with the key count: only
8,193 placements carry more than one (stm, castling, ep) variant).
