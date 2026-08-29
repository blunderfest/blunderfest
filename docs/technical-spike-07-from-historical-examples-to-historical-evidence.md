# Technical Spike 07 — From Historical Examples to Historical Evidence

**Status:** Product / UX research spike
**Primary mode:** Investigate first. Do not implement product changes unless explicitly requested after the report.

## 1. Purpose

Blunderfest now has a working first vertical slice for historical position analysis.

The current implementation can:

* find historical examples for a chess position;
* compare position characteristics;
* compare the route by which positions were reached;
* expose typed differences;
* inspect continuations;
* associate continuations with historical families/patterns;
* show historical game counts;
* expose more technical comparison details;
* allow an individual example to be added as a variation or to the room.

The current UI presents these results primarily as a sequence of individual **Historical Example** cards.

This spike must evaluate whether that is the correct product abstraction.

The central question is:

> **Should Blunderfest primarily present individual historical games, or should it first present the historical structure/evidence around a position and use individual games as supporting examples?**

Do not assume either answer is correct.

---

# 2. Required reading

Before investigating the implementation, read the relevant project documentation.

At minimum:

1. `functional-design-v0.3.md`
2. Technical Spike 02 / 02b reports
3. Technical Spike 04 report
4. Technical Spike 05 report
5. Technical Spike 06 report
6. The implementation/design specification for the first Historical Evidence vertical slice

Also inspect the current implementation of the Historical Examples feature in the repository.

Do not infer intended behavior from the code alone. The functional design and spike reports explain **why** the current implementation exists.

---

# 3. Important established findings

Treat these as research findings to be challenged only when the current product provides new contradictory evidence.

## 3.1 Position similarity is candidate generation, not relevance

A candidate can be highly positionally similar and still be unhelpful.

Conversely, a candidate can be useful specifically because one meaningful thing differs.

---

## 3.2 Difference + route is one important explanatory unit

The earlier research found that typed differences become substantially more useful when combined with route/move-order information.

For example:

> same structure → different move → route divergence → consequence

Route comparison was one of the strongest signals found in Spike 05. 

---

## 3.3 Continuation families matter

Historical games can share a meaningful continuation direction even when their exact move sequences differ.

Continuation families can expose:

* common directions;
* alternative directions;
* transpositions;
* return to a common plan;
* divergence from the reference continuation.

They are annotations/evidence, not relevance scores. 

---

## 3.4 Counts are essential

A continuation appearing in:

```text
17 independent games
```

is fundamentally different evidence from:

```text
1 occurrence / 1 game
```

Singleton membership must not be presented as evidence of a recurring historical pattern.

---

## 3.5 Raw similarity scores are not useful default user information

Values such as:

```text
similarity 0.50
```

can be useful internally and for technical comparison, but Spike 05 found that they are poor standalone signals on individual result cards. 

Do not assume that making these numbers more visually prominent improves the product.

---

## 3.6 Different can be as useful as similar

A historical example may be valuable because it shows:

* an alternative continuation;
* a different setup;
* a tempo difference;
* a different decision at exactly the same position;
* a failed or successful alternative;
* a question worth investigating.

The system should expose evidence, not decide that only the most similar game matters.

---

# 4. Current implementation

The current Historical Examples modal presents approximately this flow:

```text
Historical examples
21 examples

        [historical board]

        Historical Example

        Position
        Route
        Continuation
        Historical Evidence

        Add as variation
        Add to room

        Comparison details

Previous       1 of 21       Next
```

Observed result types include:

```text
SAME POSITION
```

and:

```text
ONE MOVE BEFORE THIS POSITION
```

An exact example may show:

```text
Position
  Pawn structure       Same
  Material             Same
  Piece placement      14/14 match
  Side to move         Same
  Castling             Same

Route
  Same route for       7 plies

Continuation
  White ...
  followed the most common continuation

  Black ...
  followed the most common continuation

Historical evidence
  499 games
```

A near-match may expose:

```text
13/14 match
side to move: Different
same route for 7 plies
reached 1 ply earlier
```

with technical details available on expansion.

The current UI is a **working vertical slice**, not a finalized UX.

---

# 5. Core product hypothesis to test

During inspection of the working vertical slice, a new hypothesis emerged:

> **The fundamental UI unit may not be the Historical Example Card. It may be a Historical Evidence Group / Direction / Family, with individual games underneath as supporting evidence.**

For example, suppose 21 results conceptually contain:

```text
Historical evidence

Same position
│
├── Main continuation
│     9 games
│
├── Alternative continuation
│     5 games
│
└── Rare continuation
      1 game

Tempo / move-order variants
│
├── Same broad continuation
│     3 games
│
└── Different continuation
      1 game

Alternative piece setup
      2 games
```

The user might learn more from this structure than from:

```text
Example 1 of 21
Example 2 of 21
Example 3 of 21
...
```

This is a hypothesis, **not a requirement**.

Try to disprove it.

---

# 6. Research question A — What does the user actually want to know?

Analyze the current feature from the perspective of a chess player investigating a position.

Consider questions such as:

> What do players normally do here?

> Are there multiple historical directions?

> Is this continuation common or unusual?

> Has somebody tried this alternative setup?

> Does spending this tempo change the continuation?

> Do strong players treat this position differently?

> Is this one unusual game, or a recurring historical pattern?

> Which historical game should I inspect to understand this direction?

Determine which of these questions the current individual-card navigation answers well and which it answers poorly.

Do not invent user needs simply to justify a redesign.

Use the functional specification and previous qualitative research as evidence.

---

# 7. Research question B — Example versus evidence

Explicitly distinguish:

## Historical Example

One concrete historical game/occurrence that can be inspected.

from:

## Historical Evidence

What a collection of independent historical games tells us about the reference position.

Investigate whether these should be represented as separate levels in the product.

For example:

```text
Historical Evidence
       ↓
Direction / family
       ↓
Representative games
       ↓
Individual game
```

Compare this with the current:

```text
Historical Examples
       ↓
Individual game
       ↓
Next individual game
       ↓
Next individual game
```

Identify advantages and disadvantages of both.

---

# 8. Research question C — What should `499 games` mean to the user?

The current card can show:

```text
Historical evidence
499 games
```

while displaying one individual game.

Investigate whether the UI sufficiently explains the relationship between:

* this individual game;
* its continuation;
* the 499 games;
* other continuations from the position;
* the reference game;
* independent games versus repeated occurrences.

Ask:

> If there are 499 supporting games, what aggregate information would be more useful before selecting one concrete game?

Do not automatically conclude that more statistics are needed.

Look for the smallest useful representation.

---

# 9. Research question D — Decision menu

Previous spikes found that the next-move distribution is a cheap and useful representation of a position's **decision menu**. 

Investigate whether the Historical Evidence UI should expose something analogous to:

```text
From this position:

Ne1     43 games
b4      21 games
Nd2     8 games
Qc2      3 games
other    5 games
```

and then allow the user to explore the historical continuations underneath.

Do not assume that the grouping key must literally be the next move.

A continuation family may sometimes be a better abstraction.

Compare:

* next move;
* continuation family;
* relationship type;
* typed difference;
* combinations of these.

---

# 10. Research question E — Representative games

If results are grouped, the UI cannot show every game immediately.

Investigate how representative games might be selected.

Possible criteria include:

* strongest players;
* most representative continuation;
* closest route;
* closest position;
* historically earliest;
* historically recent;
* decisive result;
* canonical/high-level game.

Do **not** implement a ranking formula.

Instead, determine what information is needed before we can make a responsible product decision.

Remember that previous research explicitly found that player strength should not simply act as a relevance filter. 

---

# 11. Research question F — Progressive disclosure

Evaluate which information belongs at which level.

For example:

### Level 1 — Historical landscape

Potentially:

```text
3 major historical directions
499 games
```

### Level 2 — Direction

Potentially:

```text
Kingside continuation
317 games

Common pattern:
Ne1 → Ne8 → f5
```

### Level 3 — Representative game

Potentially:

```text
Player A — Player B
C70 · 1-0
```

### Level 4 — Detailed comparison

Potentially:

```text
typed differences
route divergence
per-side skeleton membership
raw similarity
```

This hierarchy is illustrative only.

Determine whether something like this corresponds better to actual user questions than the current card-first model.

---

# 12. Evaluate the current UI, not an imaginary replacement

Inspect the actual implementation and identify what already works well.

In particular, evaluate:

* `SAME POSITION`;
* `ONE MOVE BEFORE THIS POSITION`;
* Position section;
* Route section;
* Continuation section;
* Historical Evidence count;
* `Add as variation`;
* `Add to room`;
* Comparison Details;
* Previous/Next navigation;
* mini-board;
* modal layout.

Do not redesign elements merely because they could look different.

Separate:

```text
works well
```

from:

```text
works, but belongs at another hierarchy level
```

from:

```text
actually causes a product problem
```

---

# 13. Repository investigation

Inspect the implementation to determine what data is already available.

Document whether the backend already exposes enough information to construct:

* result groups;
* decision menus;
* continuation-family counts;
* independent-game counts;
* representative-game lists;
* route/difference categories;
* reference-family markers.

Do not change APIs yet.

If data required for a proposed UI does not currently exist, say so explicitly.

---

# 14. No implementation

This spike is primarily observational.

Do **not**:

* redesign the Historical Examples modal;
* modify React components;
* modify Phoenix APIs;
* introduce new ranking algorithms;
* add AI-generated explanations;
* add semantic plan recognition;
* introduce a relevance score;
* change database architecture;
* refactor unrelated code.

Small throwaway scripts or read-only probes are allowed if they help inspect existing result distributions.

Any such code should remain clearly experimental.

---

# 15. Use real positions

Do not evaluate the product from one screenshot alone.

Use several real reference positions where possible.

Prefer a small, deliberately varied set such as:

* an opening position with many exact occurrences;
* a position with multiple continuation families;
* a tempo/move-order twin;
* a structural near-match;
* a position with weak historical support;
* if practical, a later middlegame position with fewer examples.

For each position, record:

```text
What was I trying to understand?

What did the current UI show?

Which result did I actually want to inspect?

Did I want another individual game,
or did I want to understand the result set?

What information was missing?
```

The purpose is to use Blunderfest, not merely critique screenshots.

---

# 16. Product test

For every investigated position, try to answer:

> **After using Historical Examples, do I understand the historical landscape around this position better?**

Not:

> Did the search return technically valid matches?

Those are different questions.

---

# 17. Preserve the strong-spectator principle

Blunderfest is not trying to replace the chess player with an engine-generated explanation.

The product should help the user investigate historical evidence.

A good result may:

* support an idea;
* contradict an idea;
* expose another direction;
* reveal that an idea is rare;
* show a recurring pattern;
* demonstrate a consequence;
* raise a better question.

The system does not have to tell the user what conclusion to draw.

---

# 18. Deliverable

Produce:

`technical-spike-07-from-historical-examples-to-historical-evidence-report.md`

The report should contain:

## 1. Executive conclusion

Answer:

> **Is the current individual-example card the correct primary UI unit?**

Use one of:

* Yes
* Mostly yes
* Mostly no
* No
* Insufficient evidence

Explain why.

## 2. Current implementation

Describe how Historical Examples currently works based on the actual repository and live/product evidence.

## 3. User questions

List the concrete chess questions the current UI supports well and poorly.

## 4. Example vs evidence

Analyze the distinction between an individual historical example and aggregate historical evidence.

## 5. Real-position observations

For each tested position, document what happened during actual use.

## 6. Result-set structure

Determine whether meaningful groups/directions are already present in the returned data.

Use concrete counts/examples.

## 7. Decision-menu findings

Evaluate whether next-move distribution or continuation-family structure improves the user's understanding.

## 8. Representative-game problem

Explain what would be required to select useful representative games without pretending that one universal relevance ranking exists.

## 9. Progressive-disclosure recommendation

Recommend which information belongs at:

* overview;
* group/direction;
* individual example;
* technical detail.

## 10. What should remain unchanged

Explicitly identify parts of the current vertical slice that should be preserved.

## 11. Smallest next product experiment

Propose **one** small follow-up experiment.

Do not propose a complete redesign unless the evidence genuinely demands it.

## 12. Implementation impact

Estimate whether the proposed experiment requires:

* frontend only;
* API changes;
* retrieval changes;
* new aggregation;
* new persisted data;
* none of the above.

---

# 19. Success criteria

The spike succeeds if it gives us enough evidence to choose between at least these two product directions:

### Direction A — Example-first

```text
Position
  ↓
Historical examples
  ↓
Individual cards
```

### Direction B — Evidence-first

```text
Position
  ↓
Historical landscape
  ↓
Directions / families
  ↓
Representative examples
  ↓
Individual games
```

A hybrid answer is allowed.

The important outcome is that the recommendation follows from observed use and available data rather than UI taste.

---

# 20. Final instruction

Do not optimize for producing a redesign.

Optimize for discovering whether our current mental model is wrong.

The current Historical Examples UI is a **research instrument**.

Use it.

Challenge it.

And distinguish carefully between:

> **“This UI could be nicer.”**

and:

> **“This UI is presenting the wrong product abstraction.”**

The second question is what this spike is about.
