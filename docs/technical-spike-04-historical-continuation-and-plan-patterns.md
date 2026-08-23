# Spike 03 — Historical Continuation & Plan Patterns

**Status:** Research / technical spike
**Goal:** Investigate whether the moves following a historical position can provide useful information for identifying meaningful historical analogies.

## 1. Context

Spike 02 investigated several ways of retrieving historical positions.

The main conclusion was:

> **Position similarity is useful for candidate generation, but position similarity alone is not sufficient to determine historical relevance.**

The spike also identified several important limitations:

* Exact-position search is very effective for frequently occurring opening positions, but becomes much less useful later in games.
* Pawn-structure search can produce useful cross-game candidates, but also has a significant **same-game trap**: rare pawn structures often return the same game a few moves later rather than genuinely independent historical examples.
* Simple following-move n-grams can identify recurring continuations, but strict move-order matching is too restrictive.
* Move-order-insensitive following-move patterns appear promising because they can identify similar strategic sequences despite different move orders.
* Some candidates that are highly similar positionally still represent different plans.
* Conversely, a candidate can be useful precisely because it differs from the reference position in one meaningful way.

Spike 02 therefore recommended investigating **following-move context as a first-class retrieval dimension before attempting explicit plan recognition**.

The full Spike 02 report should be treated as the starting point for this spike.

---

# 2. Objective

Investigate:

> **Can the continuation of a historical game help us identify whether two otherwise comparable positions represent similar plans, alternative plans, or fundamentally different ideas?**

We are **not** trying to build a universal relevance score.

We are **not** trying to build a chess plan classifier.

We are trying to determine whether continuation patterns provide enough useful signal to justify making them an important part of the future search engine.

---

# 3. Important principle

Do not start by trying to determine the semantic meaning of a plan.

For example, do not try to build something that first labels a sequence as:

> “Kingside attack”

or:

> “Queenside expansion”

Instead, start with observable move sequences.

We want to investigate whether:

> **similar positions + similar continuation patterns**

provide a useful approximation of:

> **similar chess ideas / plans**

without explicitly having to understand those ideas.

---

# 4. Starting point: the examples from our manual evaluation

Use the examples discussed during the qualitative evaluation of Spike 02 as initial test cases.

These include B1, B2, B3, B4 and F1-F4.

The purpose is not to produce a statistically significant evaluation dataset.

Instead, use these examples as **qualitative test cases**.

For each one, investigate whether the continuation contains information that corresponds to the human reasoning about the candidate.

For example:

### B1

The interesting aspect was the different move order and potential tempo loss.

Question:

> Can the continuation distinguish this from a merely similar position?

### B2

The position was highly similar, but the continuation was less informative.

Question:

> Can continuation information explain why this candidate is less interesting than B1?

### B3

The position was highly similar, but the underlying plan was different.

Question:

> Can continuation patterns reveal that difference?

### B4

The candidate followed a different plan and generated useful follow-up questions.

Question:

> Can the continuation identify this as an alternative plan rather than simply treating it as noise?

### F1-F4

An alternative move (`h3`) introduced a different possibility, while the game subsequently returned to the standard plan.

Question:

> Can continuation analysis distinguish “interesting alternative idea” from “irrelevant deviation”?

---

# 5. Experiment A — Following-move patterns

Take a historical position and examine a window of moves after the position.

Start with something simple such as:

* next 4 half-moves;
* next 6 half-moves;
* next 8 half-moves;
* possibly next 10 half-moves.

Compare historical continuations using several representations.

For example:

### A. Exact move sequence

```text
Ne1 Ne8 Be3 f5
```

### B. Move-order-insensitive representation

Determine whether:

```text
Ne1 Ne8 Be3 f5
```

and:

```text
Ne1 Ne8 f5 Be3
```

can be recognized as related without requiring exact move order.

### C. Piece/action representation

Investigate whether representing moves in a more abstract form is useful.

For example:

```text
Knight → e1
Knight → e8
Bishop → e3
Pawn → f5
```

Do not over-engineer this. The goal is simply to see whether abstraction improves useful grouping.

---

# 6. Experiment B — Plan-pattern clustering

Use the continuation representations to cluster historical candidates.

The question is:

> **Do candidates that a human would describe as following the same plan naturally end up in the same cluster?**

And conversely:

> **Do candidates following clearly different plans separate naturally?**

Use examples from the King's Indian positions where we observed patterns such as:

```text
Ne1 Ne8 Be3 f5
Ne1 Ne8 Nd3 f5
Ne1 Ne8 f3 f5
```

The exact implementation is up to you.

The important thing is to test whether these can be recognized as related despite the differences in the intervening move.

---

# 7. Experiment C — Meaningful differences

Spike 02 and our manual evaluation suggest that an interesting historical analogy is sometimes characterized by:

> **“similar enough to compare, but different in one meaningful dimension.”**

Investigate whether the system can explicitly find such candidates.

Examples:

### Same position, different move order

```text
Reference → e4 → ...
Historical → e3 → ... → e4
```

### Similar structure, different piece placement

Same pawn structure, but one piece occupies a different square.

### Similar position, different plan

Similar structural characteristics, but substantially different continuation.

### Same plan, different timing

Similar continuation, but one side achieves a key move one or more tempi earlier/later.

The objective is **not** to determine whether a difference is strategically meaningful automatically.

Instead, investigate whether we can expose the differences in a useful and measurable way.

---

# 8. Experiment D — Continuation vs positional similarity

Compare candidate ranking/grouping based on:

### Method 1

Position similarity only.

### Method 2

Position similarity + continuation similarity.

### Method 3

Position similarity + continuation similarity + meaningful differences.

Do not produce a final weighted relevance score.

Instead, compare the candidate sets and ask:

> **Does continuation information produce candidates that appear more useful than positional similarity alone?**

Use our qualitative examples as sanity checks.

---

# 9. Important negative test: same-game trap

The same-game problem identified in Spike 02 must remain visible.

A pawn-structure search can return:

```text
Game X, move 32
Game X, move 35
Game X, move 37
```

These may be technically very similar but provide little independent historical evidence.

Therefore:

> **Cross-game diversity remains mandatory.**

When testing continuation patterns, ensure that results can be filtered or grouped by game.

We ultimately care about:

> **independent historical examples**

rather than many snapshots of the same game.

---

# 10. Do not assume “plan” is the correct abstraction

This is important.

If the experiments suggest that continuation patterns work well without needing explicit plan labels, that is a successful outcome.

If they do not work, document why.

Possible outcomes include:

### Outcome A

Following-move patterns are surprisingly effective.

→ Good candidate for the next retrieval layer.

### Outcome B

They work for some positions but not others.

→ Identify the conditions under which they work.

### Outcome C

They require too much abstraction.

→ Identify what additional information is missing.

### Outcome D

They do not correlate with what humans consider useful.

→ That is also a valuable result. We should then reconsider the approach before building more on it.

---

# 11. What we are NOT doing

Do not:

* build a final relevance score;
* assign arbitrary weights to features;
* build a machine-learning model;
* build a semantic plan classifier;
* attempt to understand every chess plan;
* optimize the system for production scale yet;
* redesign the frontend;
* prematurely choose a database architecture based on this experiment.

This is still a research spike.

---

# 12. Deliverable

Produce a concise report containing:

## 1. Experimental setup

Explain:

* which candidate sets were used;
* which continuation windows were tested;
* which representations were tested;
* how similarity between continuations was measured.

## 2. Results

Show concrete examples.

Prefer actual chess positions and move sequences over abstract metrics wherever possible.

## 3. Comparison

Compare:

> position-only retrieval

against:

> position + continuation retrieval.

Show examples where the results differ.

## 4. Qualitative validation

Use B1/B2/B3/B4/F1-F4 as sanity checks.

We are not looking for statistical significance here.

We want to know whether the technical output is consistent with the reasoning we developed during the manual evaluation.

## 5. Failure cases

Explicitly document situations where continuation similarity gives a misleading result.

## 6. Complexity

Give a rough assessment of:

* computational cost;
* storage requirements;
* indexing requirements;
* whether this appears feasible at the scale we discussed in Spike 02.

Do not optimize prematurely. We mainly need to know whether the approach is technically plausible.

## 7. Recommendation

End with a clear recommendation:

> **Should continuation patterns become a first-class dimension of the historical search engine?**

If yes:

* what should the next experiment be?

If no:

* what should we investigate instead?

---

# 13. Most important question

At the end of the spike, answer this:

> **Can we use what happened after a historical position to distinguish “similar position” from “similar chess idea” without explicitly understanding the chess idea?**

That is the central question of this spike.

If the answer is **yes**, we may have found an important bridge between the technically measurable world of position similarity and the human concept of historical relevance.

If the answer is **no**, that is equally valuable: we will know that explicit contextual or semantic analysis is required before we go further.

---

## Guiding principle

We are building a search engine for a **strong spectator**, not an engine that claims to know the correct move.

A useful historical result may:

* confirm an idea;
* contradict an idea;
* demonstrate a consequence;
* show an alternative plan;
* show a successful or unsuccessful attempt;
* or simply raise an interesting question.

The system does not need to decide which interpretation is correct.

It needs to find the historical evidence that allows the human user to investigate it.

**Challenge the assumptions in this specification. If the experiments show that a different approach is more promising, say so explicitly rather than forcing the results to fit this model.**
