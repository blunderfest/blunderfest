# UI Task — Contextual Position Context Panel

## 1. Goal

Replace the current opening-specific sidebar concept with a more general **Position Context** panel.

The current room UI contains an **OPENINGS** section near the move list. This information is useful while the current board position is still covered by the opening book, but the concept does not generalize beyond the opening.

We want the panel to become context-sensitive and represent:

> **What Blunderfest currently knows about this position.**

Depending on the current position and available data, this may eventually include:

1. Opening Book
2. Historical Evidence
3. Endgame Tablebase

The immediate task is to establish this UI architecture without making Historical Evidence expensive by automatically calculating it for every position.

---

# 2. Product principle

Do **not** model this as:

```text
Opening
    ↓
Middlegame
    ↓
Endgame
```

with a hard chess-phase classifier deciding which component appears.

Instead model it as:

```text
Current position
      ↓
Available position knowledge
      ↓
Position Context
```

Different sources of knowledge have different availability and cost characteristics.

For example:

```text
Opening Book
cheap / already indexed

Historical Evidence
potentially expensive / explicitly calculated

Tablebase
cheap lookup when position is eligible
```

The UI should reflect this distinction.

---

# 3. Rename the current section

Replace the current:

```text
OPENINGS
```

concept with:

```text
POSITION CONTEXT
```

or the equivalent wording that best fits the existing UI conventions.

Inside the panel, identify the currently displayed source explicitly.

For example:

```text
POSITION CONTEXT

Opening book
────────────────────
O-O        43 games
d6         28 games
```

Do not make the entire panel itself synonymous with Opening Book.

---

# 4. Opening Book state

When meaningful opening-book information exists for the current position, show it as one source of Position Context.

Conceptually:

```text
POSITION CONTEXT

Opening book

O-O          43 games
d6           28 games
```

Preserve the useful behavior and information from the existing OPENINGS implementation wherever possible.

Do not redesign or rewrite the opening-book implementation unnecessarily.

This task is primarily about placing it inside the broader Position Context concept.

---

# 5. Historical Evidence state

Historical Evidence can be considerably more expensive to calculate than opening-book information.

Therefore:

> **Do not automatically run Historical Evidence analysis every time the board position changes.**

This is an important constraint.

Instead distinguish between:

### Historical Evidence has not been calculated

and:

### Historical Evidence for this position is already available

---

# 6. Historical Evidence — not calculated

When Opening Book is no longer the appropriate primary context and Historical Evidence has not been calculated for the current position, show an explicit action.

Conceptually:

```text
POSITION CONTEXT

Historical evidence
────────────────────

Explore how this position
appeared in historical games.

[ Find historical evidence ]
```

Keep the copy concise and consistent with the existing application.

Do not start the analysis until the user explicitly invokes the action.

---

# 7. Historical Evidence — loading

When the user requests Historical Evidence, provide a clear loading state.

For example:

```text
POSITION CONTEXT

Historical evidence
────────────────────

Finding historical evidence…
```

Reuse existing Historical Examples/Historical Evidence loading behavior and state where practical.

Do not introduce a second independent analysis pipeline.

---

# 8. Historical Evidence — available

Once Historical Evidence has been calculated for the current position, replace the call-to-action with a compact summary.

The recent Historical Decision Menu experiment already provides a suitable summary representation.

Conceptually:

```text
POSITION CONTEXT

Historical evidence

28 historical games

Ne1       14 games
b4         9 games
a3         2 games

[ View evidence ]
```

The purpose of this sidebar representation is **summary**, not full analysis.

The complete Historical Evidence experience remains in the existing dialog.

---

# 9. Reuse the Historical Decision Menu

Do not invent a second representation of historical results specifically for the sidebar.

Reuse the concepts and, where architecturally sensible, presentation logic from Product Experiment 01:

> **What did the side to move play next?**

The full dialog may show:

```text
What did White play next?

Ne1       14 games
b4         9 games
a3         2 games
Bd2        1 game
Nd2        1 game
Qc2        1 game
```

The Position Context panel may show a compact subset:

```text
Historical evidence
28 games

Ne1       14
b4         9
a3         2

View evidence →
```

Do not duplicate the counting logic.

There should be one shared interpretation of Historical Evidence data.

---

# 10. Cached / previously calculated results

Historical Evidence should be associated with the **position**, not merely with whether the dialog is currently open.

If Historical Evidence for the current position has already been calculated during the current appropriate cache/session lifetime, Position Context should be able to show it immediately.

Conceptually:

```text
Position A
Historical Evidence calculated
        ↓
navigate elsewhere
        ↓
return to Position A
        ↓
summary available
```

It should not unnecessarily rerun the analysis merely because the user closed the dialog.

Inspect the existing Historical Evidence session/cache behavior before implementing this.

Reuse it where possible rather than introducing another cache.

---

# 11. Opening Book versus Historical Evidence

For this task, treat Opening Book as the preferred automatic context while meaningful opening-book information is available.

Conceptually:

```text
if meaningful opening-book data exists:
    show Opening Book
else if Historical Evidence is cached:
    show Historical Evidence summary
else:
    show Find Historical Evidence action
```

Do not use move number alone to decide whether the opening is over.

For example, do not implement:

```text
if fullmove_number > 15:
    hide opening book
```

Opening relevance should be based on actual book availability/support.

Inspect the existing Opening Book implementation and determine what signal is already available.

Use the smallest sensible rule.

Document the chosen rule.

---

# 12. Important: do not destroy access to Historical Evidence during the opening

Although Opening Book may be the **primary automatic context**, Historical Evidence can still be useful in an opening position.

Therefore, do not architect the feature such that:

```text
Opening Book exists
→ Historical Evidence is impossible to access
```

The existing Historical Evidence / Find Examples action should remain available.

For now it is acceptable that:

```text
Position Context → Opening Book
```

while the existing action elsewhere opens Historical Evidence.

We are not trying to merge every interaction into Position Context in this task.

---

# 13. Endgame Tablebase

Architect Position Context so that an **Endgame Tablebase** source can be added cleanly.

Conceptually:

```text
POSITION CONTEXT

Tablebase
────────────────────

Win

Kd4      Win
Kf4      Draw
...
```

However:

> **Do not implement a new tablebase integration unless one already exists in the repository and can be wired in trivially.**

If there is no existing tablebase data source, create only the component/state architecture needed to support it later.

Do not:

* choose a tablebase provider;
* add an external service;
* download Syzygy tables;
* implement WDL/DTZ logic;
* add backend infrastructure.

Document the intended extension point instead.

---

# 14. Future source priority

Design the state model so that source priority is explicit rather than buried in conditional rendering.

Our current working priority is approximately:

```text
Tablebase available
        ↓
Tablebase

otherwise

Meaningful Opening Book available
        ↓
Opening Book

otherwise

Historical Evidence already calculated
        ↓
Historical Evidence summary

otherwise

Find Historical Evidence
```

But do not over-engineer this into a generic plugin framework.

A small explicit state model is preferable.

For example, conceptually:

```text
type PositionContext =
  | TablebaseContext
  | OpeningBookContext
  | HistoricalEvidenceContext
  | HistoricalEvidenceAvailableAction
```

Use whatever representation fits the existing React architecture.

---

# 15. Multiple knowledge sources

The priority above determines the **primary content shown in the compact panel**.

It does not imply that only one kind of knowledge can exist for a position.

A position can simultaneously have:

* opening-book data;
* previously calculated Historical Evidence;
* eventually tablebase information.

Do not discard or invalidate one source merely because another has higher display priority.

This distinction should be reflected in the state architecture.

---

# 16. Historical Evidence dialog

The existing Historical Evidence dialog remains the detailed experience.

The Position Context panel should therefore provide:

```text
[ Find historical evidence ]
```

when analysis is absent,

and:

```text
[ View evidence ]
```

when analysis is available.

`View evidence` should open the existing dialog using the already calculated result.

It must not trigger an unnecessary second calculation.

---

# 17. Existing "Find examples" action

Inspect the existing **Find examples** button and determine how it relates to this new flow.

Avoid creating two separate implementations that both perform Historical Evidence analysis.

Both entry points should use the same underlying action/state:

```text
Find examples
        │
        ├───────────────┐
        ↓               ↓
existing button     Position Context
                        button
        │               │
        └───────┬───────┘
                ↓
      Historical Evidence
            analysis
                ↓
          shared result
```

Do not remove or rename the existing button as part of this task unless doing so is technically necessary.

We want to evaluate the new Position Context behavior before changing broader terminology.

---

# 18. Position changes

The panel must respond correctly when the board cursor changes position.

For example:

```text
Position A
Opening Book available

↓ navigate

Position B
No Opening Book
Historical Evidence not calculated

↓ Find historical evidence

Position B
Historical Evidence available

↓ navigate back

Position A
Opening Book available

↓ return

Position B
Historical Evidence summary immediately available
```

Pay particular attention to:

* stale async responses;
* race conditions when navigating quickly;
* cached evidence being displayed for the wrong FEN;
* opening information from the previous position briefly remaining visible.

Position Context must always correspond to the current board position.

---

# 19. Historical Evidence failures

Historical analysis may fail or return no independent evidence.

Handle this without breaking the panel.

Conceptually:

```text
Historical evidence

No independent historical
examples found for this position.
```

or, on technical failure:

```text
Historical evidence

Historical evidence could not
be loaded.

[ Try again ]
```

Reuse existing error semantics where possible.

Do not redesign the final Historical Evidence empty-state semantics in this task; Spike 07 established that these still need product investigation.

---

# 20. Loading and layout stability

Avoid major sidebar layout jumps when switching between:

* Opening Book;
* Find Historical Evidence;
* loading;
* Historical Evidence summary.

The panel should feel like one stable part of the room whose **content changes with the position**, rather than several unrelated widgets replacing each other.

---

# 21. Visual design

Use the existing Blunderfest visual language.

The hierarchy should roughly be:

```text
POSITION CONTEXT          ← section

Historical evidence       ← source

28 historical games       ← support

Ne1                  14
b4                    9
a3                    2

View evidence →
```

The source name should be clearly subordinate to `POSITION CONTEXT`.

Do not make Historical Evidence look like engine analysis.

Avoid:

* green/red move quality;
* eval bars;
* best-move stars;
* engine-style ranking;
* percentages suggesting move quality.

Historical frequencies are evidence, not recommendations.

---

# 22. Terminology

Internally we may use:

* Position Context;
* Opening Book;
* Historical Evidence;
* decision menu;
* tablebase.

For user-facing Historical Evidence, continue using natural language such as:

```text
What did White play next?
```

and:

```text
14 games
```

Do not expose terms such as:

```text
continuation family
cluster
membership
occurrence bucket
```

unless they already belong in technical Comparison Details.

---

# 23. Scope exclusions

Do **not** use this task to:

* redesign Historical Evidence cards;
* make decision-menu moves clickable;
* implement evidence grouping;
* fix continuation-family chaining;
* deduplicate historical games;
* select representative games;
* introduce a relevance score;
* introduce AI-generated chess explanations;
* implement chess-phase classification;
* add new historical retrieval algorithms;
* change candidate generation;
* redesign the move list;
* redesign the entire right sidebar.

Keep the task narrow.

---

# 24. Tests

Add/update tests covering at least:

### Opening position

Opening Book is available:

```text
POSITION CONTEXT
Opening book
...
```

Historical Evidence is not automatically calculated.

### Non-book position, evidence absent

```text
POSITION CONTEXT
Historical evidence

[ Find historical evidence ]
```

No historical request occurs until invoked.

### Non-book position, evidence available

```text
POSITION CONTEXT
Historical evidence
28 games
...
[ View evidence ]
```

### Cached position

Navigate away and back; Historical Evidence is reused.

### Position switch during loading

A result for position A must never appear while position B is current.

### Historical Evidence failure

Panel exposes appropriate retry/error behavior.

### No evidence

Panel handles zero independent historical examples.

### Tablebase extension

If tablebase is not implemented, test or document that the state architecture has an explicit extension point rather than coupling Position Context permanently to Opening Book/Historical Evidence.

---

# 25. Implementation note

Before modifying code, briefly inspect and document:

1. how the current OPENINGS panel determines its data;
2. how Historical Evidence requests are initiated;
3. where Historical Evidence results are cached;
4. whether the dialog owns that state or whether it can be safely shared;
5. what identifies a position in those caches;
6. how cursor/board-position changes propagate through the room UI.

Prefer extracting/reusing existing state over duplicating it.

If the current architecture makes shared Historical Evidence state difficult, make the smallest clean refactor necessary.

Do not create a large generalized "knowledge source framework."

---

# 26. Deliverable

Implement the contextual Position Context panel.

Also create:

`ui-task-position-context-report.md`

containing:

### Existing architecture

How Opening Book and Historical Evidence were wired before the change.

### Implementation

What was changed and why.

### Opening Book cutoff

Exactly how the application determines that meaningful Opening Book information is unavailable.

### Historical Evidence lifecycle

How request, loading, caching, reuse and dialog opening now work.

### Position safety

How stale results and rapid cursor changes are handled.

### Tablebase extension point

What would need to be implemented later to add tablebase support.

### Known limitations

Especially preserve the known Historical Evidence limitations from Product Experiment 01 / Spike 07.

---

# 27. Definition of done

The task is complete when:

1. `OPENINGS` has become a contextual **POSITION CONTEXT** concept.
2. Opening Book remains available where meaningful.
3. Leaving book coverage does not automatically start expensive Historical Evidence analysis.
4. The user can explicitly request Historical Evidence from Position Context.
5. Already calculated evidence is summarized using the existing decision-menu data.
6. `View evidence` opens the existing detailed dialog without recomputing it unnecessarily.
7. Position changes cannot display stale context.
8. The existing Historical Evidence entry point continues to work.
9. No continuation-family, ranking or retrieval behavior has changed.
10. Tablebase can be added later without redesigning the entire panel.

---

## Final product constraint

The purpose of Position Context is **not**:

> “Determine which phase of the chess game we are in.”

It is:

> **“Show what Blunderfest currently knows about this position, and provide an explicit way to ask for more expensive knowledge.”**

Opening Book is one source.

Historical Evidence is another.

Tablebase will eventually be another.

Keep those concepts separate even though they share one place in the UI.
