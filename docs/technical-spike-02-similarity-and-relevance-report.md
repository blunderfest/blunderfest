# Technical Spike 02 — Similarity & Relevance: Report

Status: **candidate sets generated and measured; human evaluation pending**
(artifacts and the evaluation loop are ready — see §4). Spike brief:
[`technical-spike-02-similarity-and-relevance.md`](technical-spike-02-similarity-and-relevance.md).
Spike 01 report:
[`technical-spike-01-position-retrieval-report.md`](technical-spike-01-position-retrieval-report.md).
Code: `spike/position_retrieval/lib/sim/` (same isolated sub-project; the
Phoenix app is untouched, ADR-0001 intact).

> **TL;DR** — The machinery works and every hypothesis now has
> corpus-measured evidence. Three findings stand out before any human
> judgment: **(1)** exact retrieval is a deep-position problem — 97.9% of
> distinct positions occur exactly once, and occurrence frequency collapses
> with depth (mean ply 4.6 for keys with 100+ occurrences vs 46.6 for
> unique keys), so exact-only retrieval covers openings and misses
> middlegames. **(2)** Pawn-skeleton buckets behave in two opposite regimes:
> for repeated structures they are rich, fully cross-game candidate sources
> (100–2000 keys, ~0% same-game contamination), but for cold positions the
> bucket degenerates to *siblings from the same game* (50–100% same-game
> keys, several references 100%) — structural retrieval for rare positions
> finds "the same game, a few plies away", which is no historical analogy
> at all. **(3)** Recurring following-move patterns demonstrably exist
> (H7), but raw n-gram identity undercounts them: the top recurring
> sequences of the King's-Indian reference are the *same plan* (`Ne1`,
> `…Ne8`, `…f5`) in permuted move orders — sequence comparison must be
> move-order-insensitive.

---

## 1. Experimental methodology

### Corpus and artifacts

Tier: **100k games** (brief §13; the methodology is portable to the 1M
tier). One additional extraction pass (`mix spike.sim.extract`, 63s)
re-streamed the Spike 01 corpus and wrote, per game/ply:

* `sim-keys-100000.tsv` — canonical key, gid, ply per ply (6,714,883 rows —
  matches Spike 01's ply count exactly, and re-derived hashes match
  `occ-100000.tsv` byte-for-byte);
* `sim-moves-100000.tsv` — mainline SAN list per game (for context
  windows);
* `sim-games-100000.tsv` — players, **Elo ratings**, event type, time
  control, ECO/opening, and the lichess game id (so every candidate links
  to its full game at the retrieved ply).

### Index (`Spike.Sim.Index`)

Everything in-memory at this tier: distinct key → features (5,833,793 keys
— matches Spike 01's 5.83M), pawn-skeleton hash → key list (**1,475,651
buckets — matches Spike 01's ~1.48M probe**), gid → game metadata, gid →
SAN list, plus the Spike 01 packed index for `key → [(gid, ply)]`. Load:
171s, 5.7GB BEAM memory. These are facts about the spike harness, not
about a production design.

### Query set (`data/sim-queryset-100000.json`)

12 reference positions, 2 per brief-§14 category, selected
**deterministically** (sort by {gid, ply}, take first two from distinct
games) from two unioned deterministic samples of the corpus:

* a distinct-key hash sample (~0.8%) — covers the cold tail;
* an occurrence-weighted hash sample (~1.5% of plies) — covers the hot
  head. *A uniform distinct-key sample almost never catches hot positions
  (they are a vanishing fraction of distinct keys): the first queryset run
  found zero category-A positions. Surprise #1.*

| id | category | occ | pieces | note |
|---|---|---|---|---|
| A1 | exact repetition | 31 | 32 | Ruy-Lopez tabiya-ish, ply 14 |
| A2 | exact repetition | 71 | 32 | Ruy-Lopez tabiya-ish, ply 13 |
| B1 | rare | 1 | 12 | unique, ply 79 |
| B2 | rare | 1 | 30 | unique middlegame, ply 27 |
| C1 | opening | 1711 | 32 | after 1.c4 e6 2.Nf3 d5, ply 4 |
| C2 | opening | 2448 | 32 | Bishop's-opening line, ply 3 |
| D1 | middlegame | 3 | 28 | ply 47 |
| D2 | middlegame | 3 | 22 | ply 50 |
| E1 | endgame | 3 | 9 | Q+pawns vs Q+pawns, ply 117 |
| E2 | endgame | 3 | 6 | K+PP vs K+p race, ply 126 |
| F1 | known structure | 28 | 32 | King's Indian Classical skeleton |
| F2 | known structure | 2 | 32 | Stonewall skeleton |

Category F was selected **empirically**: three classic skeletons
(Carlsbad, KID, Stonewall — golden-tested against real positions) were
matched against the corpus; the two with the most middlegame exemplars
contributed one reference each. (Category E excludes bare KQK/KPK
tablebase positions — poor evaluation material.)

### Retrieval strategies (brief §15/§19, one per hypothesis dimension)

| strategy | definition | hypothesis |
|---|---|---|
| A | exact position; 2 candidates from strong games (both ≥ 2200) + 2 uniform-random | H1, §17 |
| B | same pawn skeleton, ranked by piece overlap | H3 |
| C | same pawn skeleton + identical material | H3+H5 |
| D | same pawn skeleton + material distance 1–2 | H5 |
| E | piece placement, *any* structure: material distance ≤ 2, different skeleton, ranked by piece overlap (max 2 per game) | H4 vs H3 |
| F | contextual: games sharing the first min(10, ply) SANs, position at the same ply | H6 |
| G | color-reversed exact | H2 |

Per reference: ≤ 4 candidates per strategy. Candidates are deduplicated
into judgment units of **{position, game}** — exact-match candidates share
the reference key but differ by game, so they are judged separately; a
structural candidate surfaced by several strategies is judged once and
credited to all of them. Same-game candidates (the reference's own game)
are excluded everywhere. Exemplar occurrences are picked from the
strongest game among the first 200 occurrences. All sampling is
fixed-seed; re-running reproduces the sheet bit-for-bit.

## 2. Feature definitions (exact)

All features derive from the canonical key (`placement stm castling ep`,
Spike 01's golden-tested convention) parsed into per-(color, type)
bitboards (bit `i` = square `i`, a8=0 … h1=63 — cross-checked against
echecs' own bitboards in golden tests):

* **pawn_mismatches** — symmetric-difference popcount of the pawn sets
  (white-vs-white + black-vs-black). 0 ⟺ same skeleton.
* **pawn_hash** — BLAKE2b-128 of the Spike 01 pawn skeleton; bucket
  identity for strategies B–D.
* **material_distance** — L1 distance between material signatures
  `{wp,wn,wb,wr,wq, bp,bn,bb,br,bq}` (kings omitted). 0 = identical.
* **material_diff** — human-readable delta (`"wP+1 bN-1"`, `"="`).
* **piece_overlap** — non-pawn, non-king pieces on identical squares
  (`matches`), symmetric difference (`mismatches`), and the reference's
  total (`ref_pieces`). Kings are deliberately separate:
* **king_distance** — sum of per-color Chebyshev king-square distances.
* **stm_match / castling_match** — exact booleans, recorded but not
  filtered on (their usefulness is an evaluation question — see F1 below,
  where the best structural matches mostly have *opposite* side to move).
* **developed** — minor pieces off home squares (crudest possible proxy;
  brief: no sophisticated activity yet).
* **context** — preceding 4 and following 6 SANs of the exemplar game,
  plus common-prefix/suffix lengths with the reference's windows.
* **game metadata** — players, Elos, result, event, date, ECO, opening,
  links.

No dimension is combined into a score anywhere (brief §12). Every
candidate exposes all of them plus a one-line `why` (brief §18).

## 3. Candidate examples

`data/sim-candidates-100000.json` holds everything; the sheet (§4) is the
browsable form. Two reference sections, summarized:

**F1 (King's Indian Classical structure, 28 occurrences).** A: four exact
occurrences incl. a 2403-vs-2339 game. B: same-skeleton positions from
*other KID games* — 13–14/14 pieces matching, several with **stm DIFFERS**
(same structure, opposite side to move; a live evaluation question).
C: large overlap with B (identical material). D: structural siblings down
a bishop (`wB-1`). E: 14/14-piece matches with 3–5 pawn mismatches from
non-KID openings. F: games sharing the KID move order, at ply 16 — pawn
mismatch 0, 10–13/14 pieces. G: no color-reversed occurrences.

**B2 (unique middlegame, 1 occurrence).** A/B/C/D/F/G all retrieve
nothing cross-game: the exact pool is empty, and every one of the 14
bucket keys is a same-game sibling. E still finds 4 cross-game
piece-placement matches. This is the cold-position regime in one
reference.

## 4. Human evaluation (the handoff)

**Evaluator: the project owner (this is the point of the spike).**

Artifacts:

* `spike/position_retrieval/data/sim-eval-sheet-100000.html` — one
  self-contained page (no network needed; boards are inline SVG): 12
  reference positions × 7 strategies, **144 unique judgment units**. Each
  card shows the board, FEN, players/Elos/result/event, ECO/opening, the
  per-dimension line, preceding/following moves, links to the game at the
  ply and to an analysis board, and a 0–3 circle row. Duplicates across
  strategies appear as cross-references ("also retrieved here: see X").
* `spike/position_retrieval/data/sim-judgments-100000.tsv` — one row per
  unit (`id, ref, category, strategies, fen, game, score, note`); fill in
  `score` (0–3, brief §15 scale) and optionally `note`.
* `mix spike.sim.tally --games 100000` — ingests the TSV, prints
  per-strategy / per-category / per-dimension relevance tables (a
  judgment credits every strategy that retrieved the candidate), writes
  `sim-tally-100000.json`. Already verified on synthetic input.

Judging principle printed on the sheet (brief §16): *"Is this an
interesting historical analogy for someone trying to understand the
reference position?"* — not "is this position objectively good".

**Estimated effort: ~45–60 minutes** (144 units; structural cards judge
fast once the reference is in your head).

## 5. Failure cases (measured, pre-evaluation)

1. **Cold-position structural buckets are same-game traps.** B2, D2, E1,
   E2 have 100% same-game-only skeleton buckets; B1 73%, D1 50%. Without
   the same-game exclusion the top structural candidates for these
   references are literally the reference's own game a few plies later —
   superficially excellent "matches" that carry no historical information.
   Any structural index must filter or downweight same-game keys.
2. **Contextual retrieval degenerates for shallow references.** When the
   reference ply ≤ 10, games sharing the opening prefix reach the *exact*
   position — F can only re-find strategy A (C1/C2: kept 0 of pools
   422/600). H6 context only adds new positions for deeper references.
3. **Piece-placement-only matching produces confident garbage at the
   tail.** E's ranking surfaces 12/14-piece matches with **16 pawn
   mismatches** (B2-E3) — structurally unrelated positions whose pieces
   happen to sit similarly. Whether 3–5-mismatch cases (F1-E1/E2) are
   useful analogies is exactly what the evaluation must answer; the
   mechanism demonstrably produces both.
4. **My hand-written reference FEN in the first integration test had the
   wrong side to move.** Golden positions must be corpus-derived (or
   machine-validated), never hand-typed — same lesson as Spike 01's
   biased sampler: every hand assumption got checked by a test that
   failed first.

## 6. Successful cases (measured, pre-evaluation)

1. **Structural buckets for repeated structures are rich and clean:**
   A1/A2/C1/C2/F1/F2 buckets are 92–100% cross-game with 110–1946 distinct
   keys — plenty of candidate supply, no contamination.
2. **H7 pattern texture is real.** Following-4-move sequences over exact
   occurrences (≤ 400 sampled): A2's top sequence covers 23.9% (16–27
   distinct sequences per 31–71 occurrences); F1's top three are
   `Ne1 Ne8 Be3 f5` / `Ne1 Ne8 Nd3 f5` / `Ne1 Ne8 f3 f5` — **the same
   King's-Indian plan in permuted move orders**. C1/C2 (openings) are
   genuinely diverse (217–289 distinct / 400). Sequence identity
   undercounts recurring plans; move-order-insensitive comparison
   (multisets, LCS) is the right next representation.
3. **The endgame anecdote for H8:** E1's three occurrences all continue
   with the same checking maneuver (`Qa6+ Kb3 Qb5+` then three different
   king squares) — a *transformation* repeating while static positions
   differ. Motivating, but H8 got no implementation (brief §11: less
   effort there).
4. **Color-reversed retrieval exists but is confined to openings:** only
   C1/C2 had any reversed occurrences (2 each). Consistent with Spike
   01's 1.6% presence measurement.

## 7. Performance (brief §20 — secondary by design)

Environment: same laptop as Spike 01 (i5-1135G7, 16GB). Single generation
run over 12 references: **102.6s total**, of which strategy E's full
distinct-key scans are **101.1s**; **all other strategies together:
1.5s** (~126ms/reference, dominated by F's SAN-prefix scan + replay).

| ref | A pool/kept | B | C | D | E | F | G | judged |
|---|---|---|---|---|---|---|---|---|
| A1 | 30/4 | 110/4 | 90/4 | 19/4 | 1,002,042/4 | 66/4 | 0/0 | 19 |
| A2 | 70/4 | 181/4 | 172/4 | 9/4 | 1,001,970/4 | 66/4 | 0/0 | 20 |
| B1 | 0/0 | 15/4 | 9/0 | 6/4 | 66,359/4 | 0/0 | 0/0 | 8 |
| B2 | 0/0 | 14/0 | 3/0 | 8/0 | 1,280,437/4 | 0/0 | 0/0 | 4 |
| C1 | 1710/4 | 416/4 | 314/4 | 97/4 | 1,001,740/4 | 422/0 | 2/2 | 18 |
| C2 | 2447/4 | 1946/4 | 1565/4 | 366/4 | 1,000,220/4 | 600/0 | 2/2 | 18 |
| D1 | 0/0 | 12/4 | 6/0 | 0/0 | 591,696/4 | 0/0 | 0/0 | 8 |
| D2 | 0/0 | 9/0 | 9/0 | 0/0 | 151,837/4 | 20/4 | 0/0 | 8 |
| E1 | 0/0 | 12/0 | 12/0 | 0/0 | 8,370/4 | 0/0 | 0/0 | 4 |
| E2 | 0/0 | 8/0 | 8/0 | 0/0 | 79,439/4 | 0/0 | 0/0 | 4 |
| F1 | 27/4 | 364/4 | 306/4 | 54/4 | 1,001,791/4 | 61/4 | 0/0 | 20 |
| F2 | 1/1 | 120/4 | 72/4 | 40/4 | 1,002,039/4 | 1/0 | 0/0 | 13 |

Candidate-set growth as retrieval relaxes (the §20 question): exact pools
are 0–2447; skeleton buckets add one order of magnitude (9–1946 distinct
keys); relaxing material within a bucket shrinks it back (D pools 0–366);
dropping the structure constraint entirely (E) explodes to ~1M keys
(~17% of all distinct positions pass material distance ≤ 2 for a typical
middlegame). Relaxed retrieval needs prefilter buckets *and* caps.

Index: 171s load, 5.7GB BEAM memory (spike tooling, not a production
shape). Scoring cost per candidate is microseconds (bit arithmetic).

## 8. Per-hypothesis conclusions

Verdicts are split into **[corpus]** (measured fact) and **[eval]** (awaits
the human judgments in `sim-judgments-100000.tsv` + `mix spike.sim.tally`).

* **H1 (exact) — [corpus] supported with a hard depth boundary.** Exact
  pools: healthy for A/C/F references (27–2447), empty for all rare
  references (B/D/E: 0–3). 97.9% of distinct keys occur once; occurrence
  frequency collapses with ply (mean ply 4.6 at 100+ occ, 46.6 at 1 occ).
  Exact retrieval alone cannot serve middlegame/endgame investigation.
  Following-move information on exact matches is rich where exact exists
  (H7 evidence). [eval]: are the strong-game picks visibly better than
  random ones?
* **H2 (color-reversed) — [corpus] inconclusive leaning weak.** Exists
  only for the two opening references (pool 2), absent everywhere else
  (Spike 01 measured 1.6% presence corpus-wide). [eval]: are the two
  C1/C2 reversed twins useful analogies at all?
* **H3 (pawn structure) — [corpus] two regimes, not one answer.**
  Repeated structures: clean cross-game candidate supply (supported,
  pending usefulness). Cold positions: buckets degenerate to same-game
  siblings — 4 of 12 references have **zero** cross-game structural
  analogies at 100k games (rejected *as a universal mechanism* at this
  corpus size; whether 1M games fixes cold positions is measurable — the
  1M tier run answers it). [eval]: are B/C candidates for A/F references
  actually interesting?
* **H4 (piece placement) — [corpus] inconclusive by construction.** E
  produces both plausible analogies (14/14 pieces, 3 pawn mismatches) and
  obvious junk (16 mismatches). Nothing in the mechanism separates them;
  only the human judgments can. The dimension to watch in the tally:
  piece matches ≥ 12 *with* pawn mismatches ≤ 5 vs. more.
* **H5 (material differences) — [corpus] promising, small pools.** D
  pools are non-empty exactly where structure is hot (A1 19, C1 97, C2
  366, F1 54, F2 40) and empty elsewhere. [eval]: is a same-structure
  position down a minor piece still a useful analogy?
* **H6 (previous-move context) — [corpus] weak in this corpus.**
  Preceding-move diversity over exact occurrences is 1–2 distinct moves
  at every reference — positions here are rarely reached by genuinely
  different lines. F finds transpositional candidates only for deeper
  references (A1/A2/D2/F1: kept 4, 4, 4, 4). [eval]: are F's "same line,
  different position" candidates useful?
* **H7 (following sequence) — [corpus] supported as a phenomenon;
  representation needs work.** Recurring sequences exist with strong top
  shares (A2 23.9%, F1 17.9%, D1 66.7% at 3 occ), and the F1 top-3 shows
  move-order transposition inside one plan. N-gram identity is the wrong
  comparison; multiset/LCS is the next step. [eval]: do the `next:` lines
  on cards visibly differentiate good from bad candidates?
* **H8 (transformation) — not tested (as briefed).** The E1 checking-
  maneuver anecdote is the motivation to try it next.

## 9. Recommendation (pre-evaluation; to be confirmed by the tally)

1. **Next retrieval layer: pawn-skeleton buckets as the structural
   prefilter, with a mandatory cross-game filter**, feeding per-dimension
   candidate lists (never a fused score). Exact stays the backbone
   (Spike 01); buckets layer on top exactly as spike-01 §5 predicted.
2. **Cold positions need a different candidate source than structure** —
   at 100k games there is often *nothing* structurally identical outside
   the same game. Options the evaluation should discriminate: piece-
   placement relaxation (E), or a bigger corpus (re-run at 1M games —
   cheap now, ~20 min extract + ~5 min load).
3. **Following-move context becomes a first-class dimension** (multiset
   or LCS over the next 4–6 plies), both as candidate annotation and as
   a clustering device for exact-match sets. Measure its eval correlation
   before investing in "plan" labeling.
4. **Player-strength filtering stays a candidate-source modifier, not a
   ranking weight** (A's strong/random split makes its effect measurable;
   §17 question answered by the tally, not assumed).
5. **Do not build the universal similarity score yet** — nothing in the
   corpus evidence contradicts brief §12; several dimensions (stm match,
   material tolerance, piece-overlap threshold) need the human numbers
   first.

## Appendix: surprises encountered (engineering log)

1. **A uniform distinct-key sample hides the hot head** (queryset round 1
   found zero category-A positions) — fixed with the dual
   distinct/occurrence-weighted sampler. Same trap family as Spike 01's
   biased reservoir, caught the same way: the pools looked wrong.
2. **Same-game bucket contamination** (§5.1) — the single most important
   corpus fact discovered by this spike.
3. **Elixir `~s(...)` sigils miscount parens across interpolations**
   (`~s(a (b #{x} c))` fails to tokenize; `~s|...|` is immune). All
   HTML/SVG generation uses `~s|...|`.
4. **The eval sheet's Unicode-glyph SVG boards** needed zero assets and
   render everywhere — chosen specifically because the evaluation had to
   work offline in one sitting.
5. Re-validated the whole Spike 01 chain for free: sim-extract's hashes
   match `occ-100000.tsv`, and the index rebuild reproduces the published
   distinct-key (5,833,793) and skeleton (1,475,651) counts exactly.

### Reproduction

```sh
cd spike/position_retrieval
mix spike.sim.extract --games 100000      # ~1 min (keys+moves+games)
mix spike.sim.queryset --games 100000     # index load ~3 min + selection
mix spike.sim.generate --games 100000     # ~2 min candidate generation
mix spike.sim.sheet --games 100000        # eval sheet + judgments TSV
mix spike.sim.tally --games 100000        # after filling in judgments
mix test                                  # 37 tests (features, skeletons, pipeline)
```
