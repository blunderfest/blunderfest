# Spike 06 — Plan Skeletons and Move-Order Robustness

**Status:** Research / technical spike
**Goal:** Determine whether a lightweight, order-insensitive representation of chess plans can solve the specific continuation-matching failure identified in B1, without collapsing genuinely different plans into the same pattern.

---

## 1. Context

The previous spikes established several important principles.

### Spike 02

Position similarity is useful for **candidate generation**, but is not sufficient to determine historical usefulness.

### Spike 04

Continuation patterns provide useful information about what players do after reaching a comparable position.

In particular, continuation families can identify related move patterns despite some differences in move order.

However, continuation similarity is not equivalent to informational value.

### Spike 05

Adding contextual information to historical candidates improved human judgment.

The most useful signals included:

* route comparison;
* typed differences;
* continuation families;
* per-side continuation;
* historical frequency / number of independent games.

A particularly important observation was that **route comparison** can expose relationships that raw continuation similarity misses.

---

# 2. The remaining problem

B1 is the key example.

The historical positions are closely related, and the human interpretation is approximately:

> White is a tempo behind, but both games are pursuing the same general plan.

The current continuation representation can fail to place these games in the same continuation family because the tempo difference shifts the move sequence.

For example, conceptually:

```text
Game A:
Ne1 Ne8 Be3 f5 ...

Game B:
Ne1 Ne8 f3 f5 ...
```

may already be recognized as related.

But a tempo-shifted situation can produce something like:

```text
Game A:
... Be3 f5 ...

Game B:
... f5 Be3 ...
```

where a strict sequence comparison no longer sees the relationship clearly.

We therefore want to investigate whether a **lightweight plan skeleton** can provide a more robust representation.

---

# 3. Objective

Test:

> **Can a simple, order-insensitive representation of important chess actions recognize related plans across move-order and tempo differences, while still keeping genuinely different plans separate?**

This is deliberately narrow.

We are **not** trying to build general-purpose plan recognition.

We are **not** trying to understand the semantic meaning of a plan.

We are testing whether a slightly more abstract representation can improve retrieval and clustering.

---

# 4. Important constraint

Start with the simplest representation that could plausibly solve the problem.

Do not jump immediately to:

* neural networks;
* LLM-based plan descriptions;
* engine evaluations;
* semantic chess concepts;
* a large machine-learning model.

The purpose of the spike is to determine whether a relatively simple representation contains enough information.

---

# 5. Proposed plan-skeleton representation

Investigate a representation based on **observable chess actions**.

Potential components include:

### Pawn actions

Examples:

```text
f-pawn advances
f-pawn reaches f5
b-pawn advances
b-pawn reaches b4
pawn exchange on c5
```

### Piece destinations

Examples:

```text
Knight → e1
Knight → d3
Knight → e8
Bishop → e3
```

### King actions

Examples:

```text
castle
king moves
```

### Important captures

Examples:

```text
d-pawn captures c-pawn
c-pawn recaptures
```

Do not assume that every move belongs in the skeleton.

The purpose is to capture **structurally meaningful actions**, not every move.

---

# 6. Order-insensitivity

Test whether the representation can recognize that these are related:

```text
Ne1 Ne8 Be3 f5
```

and:

```text
Ne1 Ne8 f5 Be3
```

even though the exact move order differs.

Likewise, test whether a one-tempo shift can still be recognized:

```text
... Be3 f5 ...
```

versus:

```text
... f5 Be3 ...
```

The representation should ideally identify:

> same underlying action set / continuation family

while preserving information about:

> which action happened first.

We do **not** want to throw away temporal information completely.

---

# 7. Key test case: B1

B1 is the primary success case.

The system should recognize the relevant relationship between the historical continuations despite the tempo difference.

The desired outcome is something approximately equivalent to:

> **Same broad continuation family, with a one-tempo route difference.**

Do not hard-code B1 specifically.

The representation must be general enough that the same mechanism could work for other positions.

---

# 8. Required negative tests

This is extremely important.

A representation that groups everything together is not useful.

Test it against clearly different plans.

At minimum, include the families already identified in the previous spikes:

### Kingside continuation

Examples involving:

```text
Ne1 / Ne8 / Be3 / Nd3 / f3 / f5
```

### Queenside continuation

Examples involving:

```text
b4 / a5
```

### Marshall / Closed-type alternatives

Use the existing examples from the Spike 04 dataset.

The system must **not** collapse these into one generic "active plan" family.

---

# 9. Preserve important differences

The skeleton representation must not erase useful distinctions.

For example:

```text
Be3
Nd3
f3
```

may all occur within the same broad continuation family, but they are not necessarily interchangeable.

The output should therefore distinguish between:

### Family-level similarity

> These games pursue related continuations.

and:

### Variation-level differences

> This game uses Be3, while another uses Nd3.

This distinction is important because the user may specifically be interested in the difference.

---

# 10. Test several representations

Do not assume the proposed representation is correct.

Compare at least a few simple alternatives.

For example:

### Representation A — exact sequence

Baseline from Spike 04.

### Representation B — unordered action set

Ignore move order and compare the set of important actions.

### Representation C — grouped action set + limited ordering

Group related actions but retain coarse temporal information.

For example:

```text
early:
Ne1 Ne8

later:
Be3 f5
```

rather than:

```text
Ne1 Ne8 Be3 f5
```

The objective is to discover whether retaining *some* temporal structure gives a better result than either extreme.

---

# 11. Compare against Spike 04

For the existing test cases, compare:

> **How does the new representation change the continuation families produced by Spike 04?**

Pay particular attention to:

* B1;
* B2;
* B3;
* B4;
* F1-F4.

We do not need a new human evaluation of every candidate at this stage.

We mainly want to know whether the new representation produces **more plausible groupings**.

---

# 12. Important distinction: family vs relevance

Do not turn the result into a relevance score.

The output should be something like:

```text
Continuation family A
    17 games

    Variant A1
        Be3 f5
        8 games

    Variant A2
        Nd3 f5
        5 games

    Variant A3
        f3 f5
        4 games
```

rather than:

```text
Plan similarity = 0.73
Relevance = 0.81
```

The numerical similarity may exist internally, but it is not the goal of this experiment.

---

# 13. Historical independence

Continue to enforce the rule discovered in Spike 04/05:

> **A singleton from one game is not evidence of a historical continuation family.**

When reporting family sizes, distinguish:

* occurrences;
* independent games;
* players if useful.

For example:

> 27 occurrences across 19 games

is more informative than:

> 27 occurrences.

A family consisting of 10 positions from one game should not be treated as stronger historical evidence than a family occurring once in each of 10 independent games.

---

# 14. Computational feasibility

Give a rough assessment of the implementation implications.

Investigate:

* how the skeleton could be represented;
* what indexing might be required;
* whether it can be generated offline;
* whether matching can be done efficiently at our expected scale;
* approximate storage implications.

Do not optimize production code.

We only need to establish whether the approach appears technically practical.

---

# 15. Success criteria

The experiment is successful if the new representation can:

### 1.

Recognize B1-like cases where the same broad continuation is shifted by a tempo or move-order difference.

### 2.

Keep clearly different plans separate.

### 3.

Preserve useful variations within the same broad family.

### 4.

Provide a more useful grouping than strict continuation matching alone.

### 5.

Remain simple enough that we can explain what the system is doing.

---

# 16. Failure criteria

The approach should be considered unsuccessful if:

* it requires too many hand-written chess rules;
* it merges fundamentally different plans;
* it loses too much temporal information;
* it provides little improvement over the existing continuation representation;
* or it becomes so complex that explicit semantic plan recognition would be a better approach.

If this happens, document the failure clearly.

That is a useful result.

---

# 17. Deliverable

Produce a concise technical report containing:

## 1. Representation

Describe the representations tested.

## 2. Test cases

Show the relevant chess positions and continuation sequences.

## 3. Grouping results

Show which candidates were grouped together under each representation.

## 4. B1 analysis

Explain whether the tempo-shifted continuation is successfully recognized as related.

## 5. Negative tests

Show examples where the system correctly keeps different plans apart.

## 6. Failure cases

Document where the representation produces misleading groupings.

## 7. Complexity

Give a rough assessment of indexing, storage and runtime implications.

## 8. Recommendation

Answer:

> **Should a plan-skeleton / action-based representation become part of the historical search engine?**

If yes:

* which representation should we carry forward?

If no:

* what should we investigate instead?

---

# 18. Do not proceed directly to implementation from a positive result

Even if the experiment succeeds, **do not immediately build the final production implementation**.

Instead, conclude with a proposed architecture for a **first vertical slice**.

The architecture should identify the minimum components needed to test the complete concept:

```text
Reference position
       ↓
Candidate generation
       ↓
Position comparison
       ↓
Route / difference analysis
       ↓
Continuation analysis
       ↓
Continuation / plan families
       ↓
Historical evidence
       ↓
Human-readable presentation
```

The goal is to make the next step implementation-ready.

---

# Final question

The most important question for this spike is:

> **Can a simple action-based representation bridge the gap between exact continuation matching and semantic plan recognition?**

If yes, we may have found a sufficiently powerful middle ground:

> **more meaningful than raw move similarity, but far simpler and more explainable than full plan recognition.**

---

## And what happens after Spike 06?

**Yes: assuming Spike 06 doesn't uncover a major problem, I think we should start implementing.**

But I would make the first implementation a **vertical slice**, not "build the search engine."

Something like:

> **Given one FEN, find historical candidates → compare their routes → identify differences → group their continuations → show the historical evidence in the UI.**

We can initially use a deliberately small corpus and even a somewhat crude retrieval mechanism. The point is to get the entire loop working.

That gives us something the spikes cannot give us: **we can actually use it.**

And then the next discoveries will come from real interaction with the system rather than another six-week theoretical exercise.

So my proposed sequence would be:

**Spike 06 → architecture/design checkpoint → first vertical slice → use it ourselves → iterate.**

I would *not* wait until we have solved relevance, plan recognition, database selection, scaling, etc. Those are precisely the things that are likely to become clearer once we have a working end-to-end prototype.
