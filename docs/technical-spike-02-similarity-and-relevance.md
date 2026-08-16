# Technical Spike 02 — Similarity & Relevance

**Status:** Proposed
**Purpose:** Research / experimentation
**Depends on:** Technical Spike 01 — Position Retrieval

> **Important:** This spike is an experiment, not a specification for the final search engine.
> The goal is to learn which types of similarity and context produce useful historical candidates. Do not assume that the hypotheses below are correct.

---

# 1. Goal

Technical Spike 01 established a reliable foundation for exact position retrieval.

The next question is fundamentally different:

> **Given a chess position, which other positions should we consider relevant?**

We deliberately do **not** want to answer this by immediately implementing one universal similarity score.

Instead, this spike should investigate different sources of relevance and determine which ones produce useful candidate positions.

The desired conceptual pipeline is:

```text
Reference position
       ↓
Candidate generation
       ↓
Candidate set
       ↓
Scoring / ranking
       ↓
Relevant historical positions
```

The distinction between **candidate generation** and **ranking** is important.

---

# 2. Background

Spike 01 showed that several retrieval classes are technically feasible:

* exact position;
* color-reversed position;
* structural similarity using pawn skeletons;
* contextual retrieval using game/ply information.

Relaxed similarity is the first class that requires a different retrieval mechanism: candidate generation followed by scoring. 

Spike 01 also showed that exact retrieval is not itself the difficult part. The packed index achieved approximately 12–16µs median lookup times across the tested tiers, including 673M position occurrences. 

Therefore, Spike 02 should focus primarily on **relevance**, not raw lookup performance.

---

# 3. Research Question

The central research question is:

> **What makes a historical chess position relevant to a user investigating a position?**

We currently have several hypotheses.

These should be treated as hypotheses, not requirements.

---

# 4. Hypothesis H1 — Exact Position

An exact position is the strongest possible structural match.

This is already solved technically.

However, we should establish how useful exact matches actually are for Analyze.

Questions:

* How often does an exact position have enough occurrences to be useful?
* How often is the exact position too rare?
* How useful are the games containing the exact position?
* Does the move sequence after the position provide meaningful information?

This should serve as the baseline for all other experiments.

---

# 5. Hypothesis H2 — Color-Reversed Position

A position with colors exchanged may be structurally equivalent from a chess perspective.

Spike 01 established that color-reversed lookup is technically trivial and measured approximately 26µs p50 for the double lookup. However, the corpus measurement showed that the reversed twin occurs relatively rarely (1.6% of sampled positions in the tested corpus). 

We should therefore determine whether these relatively rare matches are nevertheless useful.

---

# 6. Hypothesis H3 — Pawn Structure

Positions with similar pawn structures may provide useful historical analogies.

Spike 01 demonstrated that a pawn-skeleton index is technically feasible. At the 100k-game tier, 5.83M distinct full position keys collapsed into approximately 1.48M pawn skeletons. 

The experiment should investigate:

> Does similar pawn structure actually correlate with useful historical examples?

This is important because **structural similarity may be more meaningful to a human than raw piece-placement similarity**.

---

# 7. Hypothesis H4 — Piece Placement

Two positions can have the same pawn structure but very different piece placement.

For example:

```text
Same pawn structure
        +
different piece placement
        =
potentially very different position
```

We should investigate which piece-placement differences matter most.

Potential features:

* piece type;
* square;
* king position;
* development;
* piece activity;
* minor-piece configuration;
* queen placement;
* rook placement.

Do not attempt to encode "piece activity" as a sophisticated chess concept yet.

First determine whether relatively simple piece-location features already improve candidate quality.

---

# 8. Hypothesis H5 — Material Differences

A position with one additional pawn or a different minor piece may still be an interesting analogue.

This is particularly important because we previously observed that a user may reasonably want to investigate positions that are **not exact material matches**.

For example:

```text
Position A
White: c4 d4 e4

Position B
White: c4 d4 f4
```

These positions may have superficially similar characteristics while producing different strategic situations.

The experiment should therefore investigate whether small material/structural differences can still produce useful candidates.

---

# 9. Hypothesis H6 — Previous Move Context

The same position can be reached through different move orders.

The sequence leading to the position may contain information about the position's meaning.

For example:

```text
Game A
... → Position P

Game B
... → Position P
```

The positions are identical, but the preceding sequences may differ.

Spike 01 already stores `(gid, ply)` with occurrences, so contextual retrieval has no fundamental storage barrier. 

Investigate whether previous moves improve the usefulness of retrieved examples.

---

# 10. Hypothesis H7 — Following Sequence

This may be one of the most important experiments.

Two historical games may reach comparable positions, but the subsequent play may reveal very different ideas.

For example:

```text
Position
   ↓
...c5
   ↓
...Nc6
   ↓
...e5
```

versus:

```text
Position
   ↓
...O-O
   ↓
...Re8
   ↓
...Bf8
```

The **sequence** may contain more useful information than the static position.

We want to investigate whether groups of subsequent moves can be used to identify recurring patterns.

This does **not** mean that we should attempt to automatically label these sequences as "strategic plans" yet.

First determine whether the raw behavioural similarity exists.

---

# 11. Hypothesis H8 — Transformation

Two positions may be different at a single point in time but represent similar stages of a broader chess transformation.

Examples might include:

* a pawn break;
* an exchange;
* transition from one pawn structure to another;
* opening of a file;
* transition into an endgame.

The hypothesis is:

> **A meaningful transformation may sometimes be a stronger signal of relevance than static similarity.**

This is exploratory and should probably receive less implementation effort than H1–H7.

---

# 12. Do Not Build a Universal Similarity Score Yet

This is an explicit constraint.

Do **not** immediately create something like:

```text
similarity =
    pawn_structure * 0.35 +
    material * 0.15 +
    pieces * 0.25 +
    king_safety * 0.10 +
    ...
```

We do not yet know whether such a model is appropriate.

Instead, keep the dimensions independently observable.

For example:

```text
Candidate
 ├── exact_match
 ├── color_reversed
 ├── pawn_similarity
 ├── material_difference
 ├── piece_similarity
 ├── previous_context
 └── following_context
```

This allows us to examine **why** a candidate was retrieved.

---

# 13. Experimental Dataset

Do not start with the full corpus.

Use a manageable subset from the same corpus used in Spike 01.

The purpose is not to demonstrate scalability.

The purpose is to produce results that humans can inspect.

A dataset of approximately:

* 100k games initially;
* optionally 1M games after the methodology is validated;

should be sufficient.

---

# 14. Query Set

We need a deliberately selected set of reference positions.

Do not use only random positions.

Create several categories.

### Category A — Exact repetition

Positions that occur frequently.

### Category B — Rare positions

Positions with few or no exact matches.

### Category C — Opening positions

Useful as a control group.

### Category D — Middlegame positions

Especially positions where opening theory is likely to have ended.

### Category E — Endgame positions

Useful because our earlier discussion suggests that different goals and plans may become particularly visible here.

### Category F — Known structural similarities

Create positions where we deliberately expect some non-exact analogies to be interesting.

---

# 15. Human Evaluation

This is the most important part of the spike.

A similarity metric is not useful merely because it produces a mathematically elegant ranking.

We need to know:

> **Would a strong chess spectator consider these results relevant to the reference position?**

For a selected set of reference positions, generate candidate lists using different retrieval strategies.

For example:

```text
Reference position

A — exact
B — pawn structure
C — pawn + material
D — pawn + pieces
E — contextual
F — combined
```

Then inspect the candidates manually.

For each candidate, record something simple such as:

```text
0 = not relevant
1 = somewhat relevant
2 = clearly relevant
3 = highly relevant
```

Do not over-engineer the evaluation framework.

The objective is to discover patterns, not create a scientifically perfect scoring system.

---

# 16. Important Evaluation Principle

The evaluator should **not** ask:

> "Is this position objectively good?"

The evaluator should ask:

> **"Is this an interesting historical analogy for someone trying to understand the reference position?"**

These are different questions.

A bad move in a relevant position may be highly informative.

A perfect engine move in an irrelevant position is not useful.

---

# 17. Strong Player / Historical Game Selection

Do not yet build an elaborate player-strength model.

However, retain enough metadata to allow us to compare:

* all games;
* stronger players;
* weaker players;
* tournament games;
* other subsets.

The question we eventually need to answer is:

> Does player strength materially improve relevance?

This should be measured rather than assumed.

---

# 18. Result Explanation

Every candidate returned by the experimental system should expose **why it was retrieved**.

For example:

```text
Candidate #1

Pawn structure:       very similar
Material:             identical
Piece placement:      similar
Previous context:     unknown
Following sequence:   similar

Reason:
"Same pawn structure and similar minor-piece placement."
```

This is primarily for the developer/researcher during the spike.

It does not need to become part of the user-facing UI yet.

---

# 19. Candidate Generation

The experiment should investigate a layered candidate-generation strategy.

Conceptually:

```text
Reference position
        │
        ├── Exact
        │
        ├── Color reversed
        │
        ├── Pawn structure
        │
        ├── Material
        │
        ├── Piece placement
        │
        └── Context
                ↓
         Candidate pool
                ↓
          Feature extraction
                ↓
          Human inspection
```

The purpose is to determine which layers contribute useful candidates.

---

# 20. Performance

Performance is **secondary** in this spike.

We already know from Spike 01 that exact retrieval is fast enough for the initial scale. 

However, record:

* candidate generation time;
* number of candidates generated;
* scoring time;
* total query time;
* memory usage.

We particularly want to know how candidate-set size changes as the retrieval becomes more relaxed.

---

# 21. Expected Output

The spike should produce a report containing:

### 1. Experimental methodology

How the query set and candidate sets were constructed.

### 2. Feature definitions

Exactly how each similarity dimension was calculated.

### 3. Candidate examples

Several reference positions with representative results.

### 4. Human evaluation

The relevance judgments and observations.

### 5. Failure cases

Examples where a seemingly similar position was clearly not useful.

These are especially valuable.

### 6. Successful cases

Examples where a relatively different position turned out to be a very good analogy.

### 7. Performance measurements

Candidate-generation and scoring performance.

### 8. Conclusions

For each hypothesis:

```text
H1 — supported
H2 — inconclusive
H3 — rejected
...
```

Do not force a binary conclusion if the evidence is ambiguous.

### 9. Recommendation

Recommend what should become the next retrieval layer.

---

# 22. Explicitly Out of Scope

Do **not** implement:

* AI-generated explanations;
* natural-language strategic descriptions;
* a final similarity score;
* embeddings;
* machine learning;
* a production Analyze API;
* Analyze UI;
* user-specific weighting;
* collaborative analysis;
* automatic classification of strategic plans.

These may become appropriate later.

---

# 23. Success Criteria

The spike is successful if we learn something meaningful about relevance.

It is **not** successful merely because the code is fast.

A successful outcome could be:

> "Pawn structure produces useful candidates, but piece placement needs to be considered separately."

Or:

> "Static similarity produces poor results; following move sequences are substantially more informative."

Or even:

> "Our current assumptions about structural similarity are wrong."

All three are valuable outcomes.

---

# 24. Guiding Principle

The goal is not to make the computer decide what a position means.

The goal is to make it possible for the computer to find **interesting historical evidence** from which a human can decide what the position means.

In other words:

> **The search engine should behave like a strong spectator, not like an oracle.**

---

# 25. Immediate Task

Implement the smallest experimental framework necessary to answer:

> **Given a reference position, which similarity dimensions produce the most useful historical candidates?**

Start with:

1. exact position;
2. color-reversed position;
3. pawn structure;
4. material;
5. piece placement;
6. preceding/following context.

Do not attempt to solve all possible similarity classes.

**We want evidence first. Architecture second.**
