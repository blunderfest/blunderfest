# Product Experiment 01 — Historical Decision Menu

**Status:** Implementation experiment
**Purpose:** Test whether showing the historical decision landscape before individual examples improves how users investigate a chess position.

## 1. Background

Technical Spike 07 evaluated the current Historical Examples vertical slice through live use against the 100k corpus.

Its primary conclusion was:

> **Mostly no:** the individual Historical Example card is a good terminal/inspection unit, but appears to be the wrong primary unit for historically rich positions.

The current implementation immediately presents a carousel of individual historical examples.

Spike 07 found that during actual use, the first useful question was repeatedly:

> **What did players do from this position?**

Only after seeing that landscape does the next question become:

> **Which historical game should I inspect to understand one of those choices?**

The backend already contains most of the data needed to expose this first question. 

---

# 2. Experiment hypothesis

We want to test:

> **Showing the historical next-move distribution before the existing example carousel helps the user understand the historical landscape before inspecting individual games.**

This experiment does **not** test a complete evidence-first redesign.

It tests only whether exposing the historical **decision menu** changes how the feature is understood and used.

---

# 3. Product principle

The decision menu should answer:

> **What did players play next from this position?**

For example, for the F1 KID position Spike 07 measured:

```text
What did White play next?

Ne1    14 games
b4      9 games
a3      2 games
Nd2     1 game
Bd2     1 game
Qc2     1 game
```

For A2:

```text
What did Black play next?

O-O    43 games
d6     28 games
```

And for the Najdorf test position:

```text
What did White play next?

Bg5    120 games
Be3     81 games
Bc4     59 games
Be2     56 games
f3      40 games
Bd3     39 games
a4      18 games
h3      15 games
...
```

These examples come from the measured Spike 07 results. 

---

# 4. Important distinction

This experiment is about the **next-move distribution**.

It is **not** about continuation families.

Do not expose the current family list as the primary landscape representation in this experiment.

Spike 07 found that the current slice-wide continuation-family configuration can chain genuinely different historical directions together.

Examples include:

* A2: 68 of 71 games end up in one family despite the important Closed/Marshall distinction;
* Najdorf: 445 of 477 games end up in one family despite many clearly different system choices.

Therefore, continuation families are **not sufficiently reliable as the primary overview representation yet**. 

The next-move distribution does not have this problem.

---

# 5. Scope

Add a small **Historical Decision Menu** to the existing Historical Examples dialog.

It should appear **before the individual-example carousel/card**.

Conceptually:

```text
Historical examples

28 independent games reached this position

What did White play next?

Ne1       14 games
b4         9 games
a3         2 games
Nd2        1 game
Bd2        1 game
Qc2        1 game

────────────────────────────

[ existing Historical Example card ]

Previous        1 of 19        Next
```

This is conceptual layout guidance, not a pixel-perfect design specification.

Fit it naturally into the existing visual language.

---

# 6. Use independent-game counts

The user-facing number should represent **independent games**, not raw occurrences, wherever that distinction matters.

For example:

```text
Ne1    14 games
```

should mean that the move occurred in 14 independent historical games.

Do not accidentally count multiple occurrences of the same position within one game as independent historical support.

If the current response does not allow this to be calculated correctly from the frontend, document that before changing the API.

Do not silently substitute occurrence counts.

---

# 7. Side to move

The heading should make clear whose decision is being shown.

For example:

```text
What did White play next?
```

or:

```text
What did Black play next?
```

derive this from the reference position.

Do not hard-code White.

---

# 8. Ordering

Order moves by independent-game count descending.

For example:

```text
Ne1    14
b4      9
a3      2
Nd2     1
Bd2     1
Qc2     1
```

For equal counts, use a stable deterministic ordering.

Do not introduce a relevance score or engine ordering.

---

# 9. Long decision menus

Some positions, such as the Najdorf example from Spike 07, have many historical moves.

Do not allow the menu to dominate the dialog.

Choose a simple presentational solution consistent with the existing UI, such as showing the most common moves and allowing the remaining moves to be revealed.

For example:

```text
Bg5    120
Be3     81
Bc4     59
Be2     56
f3      40
Bd3     39

Show 8 more
```

The exact initial cutoff is a UI implementation decision.

Keep it simple.

Do not build searching, filtering or complex navigation into the menu.

---

# 10. Cold positions

The decision menu must behave sensibly when historical support is weak.

Examples discovered in Spike 07 include:

### One independent game

Conceptually:

```text
Historical evidence

Only 1 independent historical game reached this position.

What happened next?

Ng4    1 game
```

### Multiple occurrences from the same game

Do not present this as multiple independent games.

### No independent historical games other than the analyzed game

Do not fabricate a decision landscape.

The existing self-filter behavior may result in zero inspectable historical examples even though the corpus contains the analyzed game itself.

This experiment does not need to solve the final empty-state UX, but it must not misrepresent the evidence.

If necessary, preserve the existing empty state and document the limitation.

---

# 11. Do not make the menu interactive yet

For this first experiment, the decision menu is **informational only**.

Do **not** make:

```text
b4    9 games
```

clickable.

Do not filter the carousel when a move is selected.

Do not jump to examples.

Do not introduce selected states.

This is intentional.

We first want to observe:

> **Does seeing the decision menu itself change how the user understands and uses Historical Examples?**

If users naturally want to click `b4`, that is evidence for the next product interaction.

We should not assume that interaction in advance.

---

# 12. Preserve the existing carousel

Do not redesign the Historical Example card.

Specifically preserve:

* the historical board;
* route-aware headline;
* Position section;
* Route section;
* Continuation section;
* Historical Evidence section;
* Comparison Details;
* Add as variation;
* Add to room;
* Previous / Next navigation;
* existing keyboard behavior;
* existing session/cache behavior.

Spike 07 found that the card works well as the **inspection unit** for a concrete historical example. 

This experiment changes what the user sees **before** that unit, not the unit itself.

---

# 13. Do not fix continuation-family clustering

Spike 07 discovered a genuine retrieval-quality problem with continuation-family chaining.

Do not solve it in this task.

In particular, do not:

* tune family thresholds;
* introduce position-specific clustering;
* change Jaccard/LCS configuration;
* change skeleton matching;
* create new plan recognition;
* modify family construction.

That problem should remain independently testable.

---

# 14. Do not fix representative-game selection

The carousel currently contains duplicate games at different occurrences.

Spike 07 found examples such as:

```text
F1:
19 visible cards
11 distinct games
```

and:

```text
D1:
4 visible cards
1 distinct game
```

This is important, but it is **not part of this experiment**. 

Do not:

* deduplicate cards;
* rank representative games;
* reorder the carousel;
* prefer stronger players;
* change candidate caps.

We want to isolate the effect of adding the decision landscape.

---

# 15. Do not change wording elsewhere

Do not fix, as part of this experiment:

* "followed the most common continuation";
* singleton wording;
* Historical Evidence counts on individual cards;
* Elo visibility;
* family labels;
* empty-state messaging.

Spike 07 identified issues with several of these.

They are deliberately left unchanged so that this experiment has one independent variable:

> **decision menu present vs decision menu absent.**

---

# 16. Data source

Prefer using data already returned by the existing Historical Evidence response.

Spike 07 established that the response contains:

```text
reference:
  fen
  occurrences
  games
  families
```

and that the next-move distribution can be derived from the existing reference data. 

Before implementing, verify this against the actual code.

If the frontend can derive **correct independent-game counts per next move** from the existing response, do so.

If it cannot, make the smallest additive API change necessary.

Do not redesign the API.

---

# 17. Important data-quality check

Before rendering the menu, verify that:

```text
sum(per-move independent-game counts)
```

has the semantics we expect.

A single independent game should normally contribute once to the next move actually played from a given occurrence.

However, because the same position can occur multiple times within a game, ensure that a repeated position does not make one game appear as historical support for the same move multiple times.

Document exactly how this is handled.

This is important because Spike 07 showed that repeated occurrences within the same game are common enough to affect the UI materially. 

---

# 18. Suggested presentation

Use the existing Blunderfest visual language.

The section should be visually quieter than the board and should not look like an engine recommendation.

Avoid evaluation-like presentation.

In particular, do not use:

* eval bars;
* green/red "good/bad" coloring;
* percentages implying move quality;
* engine symbols;
* best-move indicators.

These are historical frequencies, not recommendations.

Something simple is sufficient:

```text
Historical evidence

28 independent games

What did White play next?

Ne1                         14
b4                           9
a3                           2
Nd2                          1
Bd2                          1
Qc2                          1
```

The wording can be adjusted to fit existing localization conventions.

---

# 19. Terminology

Prefer human-facing language.

Good:

```text
28 historical games
```

```text
What did White play next?
```

```text
14 games
```

Avoid exposing implementation terminology such as:

```text
decision menu
family membership
occurrence bucket
continuation cluster
```

`Decision menu` is our internal/product-design term, not necessarily user-facing terminology.

---

# 20. Testing

Add tests for at least:

### F1

Expected landscape approximately:

```text
Ne1    14
b4      9
a3      2
Nd2     1
Bd2     1
Qc2     1
```

Use the actual corpus/test fixture expectations rather than hard-coding these numbers if the fixture differs.

### A2

The UI must expose the two main next moves even though continuation-family clustering currently chains them.

Conceptually:

```text
O-O    43
d6     28
```

This is a particularly important regression case.

### Repeated-position case

Verify independent-game counting.

### Cold position

Verify sensible rendering with one independent game.

### Long menu

Verify collapse/expansion presentation.

### Side to move

Verify both:

```text
What did White play next?
```

and:

```text
What did Black play next?
```

---

# 21. Instrumentation

Do not add analytics infrastructure solely for this experiment.

However, if the existing application already has an appropriate lightweight event mechanism, it is acceptable to record:

* Historical Examples opened;
* decision menu expanded;
* carousel navigation;
* Add as variation;
* Add to room.

Do not introduce new external analytics dependencies.

Our first evaluation will primarily be qualitative: we will use the feature ourselves.

---

# 22. Deliverable

Implement the Historical Decision Menu in the current Historical Examples dialog.

Also add a short document:

`product-experiment-01-historical-decision-menu.md`

containing:

## Implementation

What changed?

## Data semantics

Exactly how are per-move game counts calculated?

## Limitations

Especially:

* continuation-family chaining remains;
* duplicate-game cards remain;
* representative-game selection remains unsolved;
* empty-state semantics remain provisional.

## Evaluation questions

Record the questions we should ask during actual use:

1. Do I look at the move distribution before inspecting a game?
2. Does it help me understand what kind of position this is?
3. Does it reveal alternatives I want to investigate?
4. Do I naturally want to click a move?
5. Once I choose a direction mentally, can I find a useful game in the existing carousel?
6. Does the menu become noise in positions with many moves?
7. Is it useful in positions with little historical evidence?

Do **not** answer these questions in the implementation document.

They are for the subsequent product evaluation.

---

# 23. Definition of done

The experiment is done when:

1. opening Historical Examples shows the historical next-move landscape before the existing individual example;
2. counts represent independent games correctly;
3. the side to move is correct;
4. hot, cold and repeated-position cases behave sensibly;
5. the existing card/carousel behavior remains unchanged;
6. no continuation-family or ranking behavior has been modified;
7. the implementation document explains the counting semantics and known limitations.

---

# 24. Final constraint

This is an **experiment, not the new final Historical Evidence UI**.

Do not use the implementation opportunity to anticipate the next design.

In particular:

> **If the finished experiment makes you think "obviously these moves should be clickable", leave them non-clickable.**

That reaction is precisely one of the things we want to observe when we use the experiment.

The goal is to learn whether:

```text
position
    ↓
historical landscape
    ↓
individual examples
```

is more useful than:

```text
position
    ↓
individual examples
```

Everything else can wait.
