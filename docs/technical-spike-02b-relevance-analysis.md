# Spike 02 — Phase 2: From Similarity to Relevance

**Status:** Research / technical spike
**Goal:** Determine what information a future historical-position search engine needs in order to find *useful* analogies, rather than merely similar positions.

## 1. Context

The first phase of Spike 02 investigated several retrieval strategies for finding historical chess positions related to a reference position.

The resulting `evaluation.html` is an evaluation sheet. Its intended question is:

> **“Is this an interesting historical analogy for someone trying to understand the reference position?”**

The sheet provides a 0–3 relevance score and shows the position, retrieval strategy, move context, game information, and links to the full game and analysis board. 

We have started evaluating candidates manually.

However, we do **not** have enough independent evaluators to perform a statistically meaningful human-evaluation study.

That is not the goal of this phase.

Instead, we will treat the current evaluation as a **qualitative expert exercise**. The purpose is to discover what makes a historical game useful to a human chess spectator and turn those observations into testable technical hypotheses.

---

# 2. Core principle

The search engine should not simply answer:

> **“Which historical positions look most like this position?”**

It should eventually help answer:

> **“Which historical games can help me understand this position?”**

Therefore:

> **Position similarity is candidate generation, not relevance.**

Do not assume that the most structurally similar position is the most useful result.

---

# 3. What we have learned so far

The following observations have emerged from our manual analysis.

These are **hypotheses, not final conclusions**.

### B1 — High similarity can be highly useful

A historical position was essentially identical to the reference position, but had been reached through a different move order.

The difference in move order created a potentially meaningful tempo question.

The historical game therefore provided something the reference position alone could not:

> **a concrete historical comparison showing the possible consequences of reaching the same position differently.**

---

### B2 — High similarity can still be insufficient

Another almost identical position showed the same basic tempo difference, but its continuation did not make the consequence particularly clear.

The candidate was therefore still relevant, but less informative.

This suggests:

> **The continuation of the historical game can affect its usefulness.**

---

### B3 — A highly similar position can answer the wrong question

Another candidate was structurally very similar, but the players followed a substantially different plan.

The game itself was interesting, but if we were investigating the original position, we would not necessarily want to include it.

This suggests:

> **Query relevance matters in addition to positional similarity.**

---

### B4 — An alternative plan can be highly valuable

Another candidate showed a different piece setup and a different strategic plan.

The game did not necessarily prove whether that plan was objectively good.

However, it created useful questions such as:

* Does this plan work in other games?
* Under what circumstances does it work?
* Can the opponent prevent it?
* Does the player have enough time to execute it?

This suggests:

> **A historical game can be valuable because it generates a useful question, even when it does not provide a definitive answer.**

---

### F1-F4 — A less direct candidate can still be interesting

A candidate differed in an important move (`h3` rather than castling).

The continuation did not necessarily demonstrate that the alternative was strong, and the players were not particularly strong.

Nevertheless, the game raised an interesting question about whether castling is actually necessary and whether a kingside attack is possible.

This suggests that:

> **Interesting deviations can have informational value even when the candidate is not a near-identical position.**

---

### A1 vs B1-E1 — Shared abstract features are not enough

We also found a case where two positions shared a broad characteristic such as piece activity, while belonging to completely different game phases and serving completely different purposes.

In an opening, piece activity may be about:

* controlling important squares;
* establishing a plan;
* controlling the centre;
* preparing king safety.

In an endgame, piece activity may instead be about:

* king activation;
* pawn breakthroughs;
* promotion;
* restricting the opposing king.

Therefore:

> **An abstract feature such as “piece activity” is not meaningful without chess context and function.**

---

# 4. Objective of this phase

Do **not** build the final relevance algorithm.

Do **not** assign arbitrary weights to similarity features.

Do **not** attempt to make the current small qualitative evaluation statistically significant.

Instead, answer:

> **What information would a search engine need in order to eventually rank historical games by their usefulness to a human chess spectator?**

We want a conceptual and technical model that can be tested in later spikes.

---

# 5. Investigate the following dimensions

For each dimension, determine:

* whether it appears relevant;
* why it might matter;
* whether it can be derived from the available chess data;
* whether it can be measured objectively;
* what remains difficult or ambiguous.

## 5.1 Position similarity

Examples:

* exact position;
* pawn structure;
* material;
* piece placement;
* king placement;
* side to move.

Question:

> How useful is similarity for generating candidates, and where does it stop being useful for ranking them?

---

## 5.2 Move-order relationship

Investigate whether we can detect things such as:

> Same position reached through different move orders.

And:

> A player spent a tempo on one move before reaching the same position.

Question:

> Can move-order differences themselves be useful historical information?

---

## 5.3 Continuation

Investigate the moves immediately following the matched position.

Examples:

* Did the historical player choose a different plan?
* Did the deviation produce a concrete consequence?
* Did the game expose a weakness?
* Did the game demonstrate a successful or unsuccessful plan?

Question:

> How much information can we extract from what happened *after* the matching position?

---

## 5.4 Preceding context

Investigate the moves immediately before the matched position.

Question:

> Does knowing how the historical game arrived at the position provide information that the board alone cannot?

---

## 5.5 Game phase

Investigate whether the meaning of structural features changes between:

* opening;
* middlegame;
* endgame.

Do not assume that a generic feature has the same meaning across phases.

---

## 5.6 Plan / strategic function

We are particularly interested in the difference between:

> **what the pieces are doing**

and:

> **why they are doing it.**

For example, active pieces can be used to:

* prepare an attack;
* control important squares;
* support a pawn break;
* restrict the enemy king;
* promote a pawn.

Determine which aspects might be detectable automatically from move sequences and which would require more sophisticated analysis.

Do not attempt to solve the entire concept of “plan recognition” in this spike.

---

## 5.7 Differences between reference and candidate

Investigate whether meaningful differences may actually increase relevance.

Potential examples:

* different move order;
* one tempo difference;
* different pawn break;
* different king position;
* different piece placement;
* different plan;
* different side to move.

Question:

> Can the search engine identify candidates because of *interesting differences*, rather than despite them?

---

## 5.8 Historical evidence

Investigate the role of:

* player strength;
* number of occurrences;
* frequency of a move;
* results;
* master games versus broader databases.

Do not assume that:

> stronger players = more relevant.

The goal is to understand how historical evidence might support or weaken an analogy.

---

# 6. Use our current evaluations as qualitative examples

The current B1/B2/B3/B4 and F1-F4 discussions should be treated as **examples of reasoning**, not as a statistically representative dataset.

For each example, extract:

```text
Reference position
        ↓
Historical candidate
        ↓
Important similarity
        ↓
Important difference
        ↓
What happened in the game?
        ↓
Why is this useful / not useful?
        ↓
What question does it answer or raise?
```

The reasoning is more important than the numerical 0–3 score.

---

# 7. Identify failure modes

This is especially important.

Find cases where:

> **The retrieval system did something technically reasonable, but the result was not useful to the human.**

Examples already identified include:

* extremely similar position, but wrong strategic question;
* same abstract feature, but different chess function;
* very similar position, but uninformative continuation;
* different plan despite high structural similarity;
* interesting game that is not relevant to the current investigation.

These failure cases should guide the next experiment.

---

# 8. Separate three concepts

Please explicitly investigate the distinction between:

### Similarity

> How much does this historical position resemble the reference position?

### Informational value

> Does the historical game tell us something interesting about the reference position?

### Query relevance

> Is that information relevant to what a player investigating this particular position would want to know?

These should **not** automatically be treated as the same metric.

---

# 9. Deliverable

Produce a concise technical report containing:

### 1. What we learned

Summarize the strongest observations from the current qualitative evaluation.

### 2. Potential relevance dimensions

Identify the characteristics that may matter when ranking historical games.

### 3. Failure modes

Identify situations where similarity produces poor results.

### 4. Detectability

For each proposed dimension, classify it as:

**Directly available**

Examples: FEN, moves, player rating, result.

**Derivable**

Examples: move-order differences, material changes, pawn-structure changes, game phase.

**Difficult / uncertain**

Examples: strategic plan, purpose of piece activity, whether a game demonstrates a particular idea.

### 5. Proposed next experiments

For each important uncertainty, propose the smallest technical experiment that could test it.

### 6. Recommendation

Answer:

> **What should we build/test next, and why?**

---

# 10. Important constraint: avoid analysis paralysis

We deliberately do **not** want to solve the complete relevance problem in this spike.

The output should not be:

> “Here is the perfect relevance model.”

It should be:

> “Here are the 3–5 most promising hypotheses, here is how we could test them cheaply, and here is what we should do next.”

Keep the experiments small and falsifiable.

---

# Guiding principle

The search engine should behave like a **strong spectator**.

It should not try to impose a personality or playing style on the user.

We are not trying to find:

> “What would a tactical player play?”

or:

> “What would a positional player play?”

We are trying to find:

> **“What historical games would help a strong human spectator understand what is going on in this position?”**

The eventual system should help the user discover ideas, comparisons, consequences and questions — rather than pretending to know the single correct interpretation.

**Challenge the assumptions above. If the evidence suggests that one of them is wrong, say so explicitly.**
