# Spike 05 — Contextual Historical Evidence: Re-Judgment Experiment

**Status:** Research / validation spike
**Goal:** Determine whether contextual information about historical candidates improves a human's ability to identify useful historical analogies.

---

## 1. Context

Spike 02 established that positional similarity alone is insufficient for identifying useful historical analogies.

Spike 04 investigated historical continuation patterns and found that continuation information can reveal recurring move-pattern families even when the exact move order differs.

Some important findings were:

* continuation patterns can identify related plan-like sequences without explicitly labeling the plan;
* continuation similarity can distinguish some otherwise similar positions that lead to different plans;
* continuation similarity alone is **not** equivalent to informational value;
* typed differences between the reference and candidate are important in cases such as tempo differences;
* the most useful representation may therefore combine **similarity, differences, and continuation context**.

Spike 04 specifically recommends treating continuation patterns primarily as **annotations and a clustering mechanism**, rather than turning them into a universal relevance score.

The next question is therefore not:

> “Can we calculate relevance?”

It is:

> **“Does this additional contextual information actually help a human recognize useful historical evidence?”**

---

# 2. Objective

Create a small re-judgment experiment in which previously evaluated historical candidates are shown with additional contextual information.

We want to determine whether this information changes our judgment of their usefulness.

The experiment should compare:

### Original presentation

The candidate as it was presented in the earlier evaluation.

versus:

### Contextual presentation

The same candidate, but augmented with information such as:

* candidate/reference differences;
* difference type;
* continuation pattern;
* continuation family/cluster;
* per-side continuation similarity;
* relevant move-order information;
* cross-game context.

The goal is **not** to make the candidate look more impressive.

The goal is to determine whether the additional information helps us understand *why* the candidate might be useful or irrelevant.

---

# 3. Important constraint

Do **not** build a final relevance score.

Do **not** combine the signals into a weighted formula.

Do **not** attempt to automatically decide:

> “This game is relevant.”

Instead, expose the evidence and let the human evaluator make that judgment.

We are testing whether the evidence itself is useful.

---

# 4. Candidates

Use the candidates from our existing qualitative evaluation, particularly:

* B1
* B2
* B3
* B4
* F1-F4

We do not need hundreds of candidates.

A small number of carefully selected examples is preferable because the purpose is to understand **why the additional information changes or does not change our judgment**.

If useful, add a small number of additional candidates from the Spike 04 dataset to cover cases not represented by B1-F4.

---

# 5. Contextual information to expose

For each candidate, provide the following where available.

## A. Position similarity

Retain the original similarity information.

This is the baseline.

---

## B. Typed differences

Explicitly identify important differences between the reference and historical position.

Examples:

```text
Move-order difference
Material difference
Pawn-structure difference
Piece-placement difference
King-position difference
Side-to-move difference
```

Do not invent semantic interpretations.

If the system can reliably identify the mechanical difference, show that.

---

## C. Continuation

Show the moves immediately following the matched position.

Test a few reasonable windows, for example:

* 4 half-moves;
* 6 half-moves;
* 8 half-moves.

Use the representation that proved most useful in Spike 04.

---

## D. Continuation family

If the candidate belongs to a continuation cluster/family, show that.

For example:

> **Continuation family:** Ne1–Ne8–f5

with the relevant variants grouped together.

Do not call this a "plan" unless the system has actually established that.

Use neutral terminology such as:

> continuation family
> move-pattern family
> continuation cluster

---

## E. Per-side continuation information

Where useful, distinguish White and Black continuation patterns.

This is particularly important for positions where one side is effectively a tempo behind.

---

## F. Historical context

Retain relevant information such as:

* player ratings;
* number of independent games;
* database;
* game result.

Do not rank by player strength yet.

---

# 6. Re-evaluation questions

For each candidate, ask the human evaluator questions such as:

### 1. Is this candidate useful for understanding the reference position?

Use the existing 0–3 scale.

### 2. Why?

Allow a short free-text explanation.

### 3. Did the additional contextual information change your opinion?

Use:

* No
* Slightly
* Significantly

### 4. What information was responsible for the change?

For example:

* position similarity;
* typed difference;
* continuation;
* continuation family;
* move order;
* player strength;
* game outcome;
* combination of several factors.

### 5. Does the candidate now raise an interesting question?

For example:

> “Does this alternative plan work?”

or:

> “Does the tempo difference actually matter?”

This is important because we have repeatedly found that a historical game can be valuable even when it does not provide a definitive answer.

---

# 7. Blindness / presentation

Where practical, avoid telling the evaluator our previous judgment.

The purpose is to see whether the contextual presentation changes the judgment independently.

If a fully blind A/B experiment is impractical, simply document that the evaluation is a continuation of our qualitative expert analysis.

Do **not** pretend this is a statistically rigorous human study.

---

# 8. Key test cases

Pay particular attention to the following.

## B1 — Tempo twin

We previously considered this interesting because of the move-order/tempo difference.

Test whether explicit difference information makes the reason for its relevance easier to recognize.

The important question is:

> Does the system's contextual representation make the tempo relationship visible without requiring the evaluator to reconstruct it manually?

---

## B2 — Similarity with weaker continuation evidence

Test whether the additional continuation information explains why this candidate is less informative than B1.

Question:

> Can contextual evidence distinguish two highly similar positions that differ in informational value?

---

## B3 — Different plan

Test whether the continuation family clearly exposes that this candidate follows a substantially different continuation.

Question:

> Does continuation context make it easier to reject a structurally similar but conceptually different candidate?

---

## B4 — Alternative plan / useful question

Test whether the contextual presentation makes the alternative setup more obviously useful.

Question:

> Can the system expose the candidate as an interesting alternative without claiming that the alternative is objectively correct?

---

## F1-F4 — Same position, different continuations

These are particularly valuable because positional similarity is essentially identical.

Question:

> Can continuation families separate different directions from the same position in a useful way?

---

# 9. What we are testing

The central hypothesis is:

> **Historical relevance is better represented by a combination of position similarity, meaningful differences, and continuation context than by positional similarity alone.**

We are **not** trying to prove this statistically.

We want to see whether the additional information produces qualitatively better human judgments.

---

# 10. Analyze the results

For each candidate, compare:

```text
Original judgment
        ↓
Additional contextual evidence
        ↓
New judgment
        ↓
Reason for change / no change
```

Look specifically for:

### Cases where the candidate becomes more useful

Why?

### Cases where the candidate becomes less useful

Why?

### Cases where the judgment does not change

Why not?

### Cases where the contextual information itself is confusing

This is important.

Additional information is only useful if it helps the user understand the candidate. More information is not automatically better.

---

# 11. Evaluate the three dimensions separately

Do not collapse these into one concept.

### Similarity

> How similar is the historical position?

### Difference

> What is different between the reference and historical position?

### Continuation

> What happens after the historical position?

Determine whether each dimension provides information that the other two cannot.

We are particularly interested in whether:

> **similarity identifies candidates, difference explains the comparison, and continuation explains what happened next.**

This is a hypothesis to test, not an assumption.

---

# 12. Do not implement plan-skeleton tokenization yet

Spike 04 suggested that a more sophisticated representation involving pawn breaks and minor-piece destinations might be promising.

Do **not** implement that as part of this spike unless the current experiment demonstrates that the existing continuation representation is clearly insufficient.

First determine whether the simpler representation is already useful.

If it is insufficient, document **exactly what information is missing**.

That will give us a much better basis for deciding whether plan-skeleton tokenization is justified.

---

# 13. Deliverable

Produce a concise report containing:

## 1. Experimental setup

Explain what candidates were used and what contextual information was displayed.

## 2. Before/after judgments

Show the original and contextual judgments.

## 3. Changed judgments

Identify candidates where contextual information changed the evaluation.

Explain why.

## 4. Unchanged judgments

Identify candidates where additional context did not matter.

Explain why.

## 5. Most useful contextual signals

Which information consistently helped?

For example:

* typed differences;
* continuation family;
* per-side continuation;
* move order;
* historical frequency.

## 6. Unhelpful or confusing signals

Which information added little value or potentially distracted the evaluator?

## 7. Implications for the search engine

Describe what information a future candidate result should expose.

Do **not** convert this into a relevance score yet.

## 8. Recommendation for Spike 06

Recommend the smallest next experiment based on the evidence.

---

# 14. Success criteria

This spike is successful if we can answer:

> **Does contextual historical evidence make it easier for a human to identify why a candidate is useful or irrelevant?**

And, more specifically:

> **Which contextual signals actually help?**

A successful outcome does **not** require a ranking algorithm.

A result such as:

> “Typed differences and continuation families clearly improve interpretation, while raw continuation similarity adds little”

would already be a very valuable result.

Likewise:

> “The additional information does not materially improve judgment”

would also be a successful outcome, because it would prevent us from building unnecessary complexity.

---

# Guiding principle

Blunderfest should not try to tell the user:

> **“This is the correct interpretation of your position.”**

It should help the user discover:

> **“Here are historical examples that may help you understand what is happening.”**

The system should therefore expose **evidence and relationships**, rather than pretending that a numerical relevance score represents human understanding.

**Challenge this hypothesis. If the experiment shows that another representation is more useful, or that the contextual information does not improve human judgment, document that clearly rather than forcing the results to fit this model.**
