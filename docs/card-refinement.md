# Historical Comparison Card — UI refinement

**Status:** Adopted (2026-08-25) with the agreed adjustments: the headline is
positional only; the route divergence and ply gap stay on the card; exact
match counts live in the Comparison details disclosure; historical counts
are worded per candidate type; the Route section is omitted for bare-FEN
analyses. Implemented in `HistoricalEvidenceCard.tsx`.

We currently have a working historical-comparison card, but the information is still presented too much as internal analysis output.

The current card looks roughly like:

```text
Position
Pawn structure     same
Material           same
Piece placement    14/14 match
Side to move       same
Castling           same

Route
Shared for         7 plies

Continuation
Played             Nge7 O-O g6 c3 b5 Bc2 Bg7 Re1 O-O d4 exd4 cxd4
White's plan       plan 1 · 100% match
Black's plan       plan 1 · 100% match

Historical evidence
Appearances        499
Games              499
```

The underlying data is useful, but the presentation exposes implementation concepts rather than explaining the historical relationship to a chess player.

## Goal

Redesign the card so that a user can understand **why this historical game was found and what happened after the comparable position**, without needing to understand our internal terminology or scoring.

The card should answer four questions:

1. **How similar is the position?**
2. **How did the players arrive there?**
3. **What did they do afterwards?**
4. **How common is this historical example?**

---

# Proposed structure

```text
voncul — kel2zad22                         C70 · 0–1

HISTORICAL COMPARISON
Same position · same continuation

POSITION
Pawn structure       Same
Material             Same
Piece placement      Identical
Side to move         Same
Castling             Same

ROUTE
Same for 7 plies

CONTINUATION

White
Nge7 · O-O · c3 · Bc2 · Re1 · d4

Black
O-O · g6 · b5 · Bg7 · exd4

HISTORICAL EVIDENCE
499 independent games
```

This is a **conceptual UI specification**, not necessarily the final visual design.

---

## 1. Historical Comparison

The top line should give a short, human-readable description of the relationship.

For example:

```text
Same position · same continuation
```

Other possible descriptions may eventually be:

```text
Same position · different continuation
```

or:

```text
Same position · different move order
```

The important point is that this should describe the **relationship between the reference and historical game**, not expose an internal algorithmic score.

Do not display things such as:

```text
plan 1
100% match
similarity 0.92
family 17
```

unless they are placed in a developer/debug/details view.

---

# 2. Position

The Position section should describe objective similarities between the two positions.

For example:

```text
Pawn structure       Same
Material             Same
Piece placement      Identical
Side to move         Same
Castling             Same
```

Use human-readable states.

For example:

* `Same`
* `Identical`
* `Different`

Avoid:

```text
14/14 match
100% match
similarity = 1.0
```

unless the information is specifically useful to the user.

### Important distinction

"Piece placement — Identical" means:

> Every piece in the historical position occupies the same square as in the reference position.

It does **not** mean that the positions are merely generally similar.

---

# 3. Route

The Route section describes **how the historical game reached the comparable position**.

For example:

```text
Same for 7 plies
```

This means:

> Starting from the relevant comparison point, the historical game and reference game followed the same moves for 7 half-moves before their routes diverged.

If the routes differ immediately, the UI could say:

```text
Different from the reference immediately
```

If they share a longer route:

```text
Same route for 12 plies
```

The exact wording can be refined, but avoid exposing implementation terminology such as hashes, route IDs, etc.

---

# 4. Continuation

This is the most important change.

Do **not** call the output:

```text
White's plan
Black's plan
```

unless we actually have a reliable semantic plan description.

The system currently has evidence about **moves and recurring move patterns**, not necessarily an understanding of the chess plan.

Instead, simply show what each side did.

For example:

```text
White
Nge7 · O-O · c3 · Bc2 · Re1 · d4

Black
O-O · g6 · b5 · Bg7 · exd4
```

This makes the information immediately understandable to a chess player.

---

# 5. Comparing continuations

We may have internal continuation matching/clustering information.

That information can still be used to determine the relationship between the historical game and the reference game.

However, do not expose the internal terminology.

For example, do not show:

```text
White's plan: plan 1 · 100% match
Black's plan: plan 1 · 100% match
```

Instead, translate the result into something meaningful.

Possible user-facing descriptions:

```text
White followed the same continuation.
Black followed the same continuation.
```

or:

```text
White followed a different continuation.
Black followed the same continuation.
```

or, if we cannot make that distinction reliably:

> Simply show the continuation moves and omit the interpretation.

The UI should never claim more than the underlying analysis can establish.

---

# 6. Important: "plan 1" is not a user concept

The current implementation may internally assign continuation clusters identifiers such as:

```text
plan 1
plan 2
plan 3
```

Those identifiers are fine for development.

They must **not** be presented to users.

Also, avoid introducing another technical term such as:

```text
continuation family
```

as the user-facing label.

If we eventually want to describe a recurring pattern in natural language, we can introduce a proper chess-oriented description later.

For now, the safest user-facing representation is simply:

> **what the players actually played.**

---

# 7. Historical Evidence

Replace:

```text
Appearances 499
Games       499
```

with something closer to:

```text
Historical evidence

499 independent games
```

The meaning should be:

> This comparable position / historical relationship occurs in 499 distinct games.

If appearances and games differ, we should distinguish them explicitly.

For example:

```text
37 games
52 occurrences
```

rather than making the user infer what "Appearances" means.

Where possible, "independent games" should refer to distinct games, so multiple occurrences in the same game do not falsely appear to be independent evidence.

---

# 8. Don't expose numerical matching scores

Internally we can retain values such as:

```text
100%
0.83
0.42
```

They can be useful for:

* ranking;
* clustering;
* debugging;
* experiments.

But they should not automatically become UI elements.

A chess player is much more likely to understand:

> **Same continuation**

than:

> **Continuation similarity: 100%**

The latter immediately raises the question:

> "100% match of what?"

The UI should communicate the interpretation, not the implementation metric.

---

# 9. The card should remain evidence-oriented

The card should **not** tell the user:

> "This game is relevant."

Instead, it should show enough evidence for the user to decide whether it is relevant.

For example:

```text
Same position
Same route for 7 plies
White: Nge7 · O-O · c3 · Bc2 · Re1 · d4
Black: O-O · g6 · b5 · Bg7 · exd4
499 independent games
```

From this, a player can start asking:

> Why did they play this route?

> Is this continuation common?

> What happens if I choose the other move?

That is the intended role of the historical comparison.

---

# 10. Responsive / progressive disclosure

The compact card should contain the information that is useful at a glance.

Additional technical details can be placed behind an expandable section.

For example:

```text
▸ Comparison details
```

This could eventually contain:

```text
Piece placement: 14/14
Shared route: 7 plies
Continuation representation: ...
Continuation similarity: ...
Cluster identifier: ...
```

This gives us a place to expose technical information without making the main card difficult to understand.

---

# Design principle

The implementation should follow this rule:

> **Expose relationships and evidence, not algorithmic scores.**

The user should be able to understand:

> "This historical game reached the same position, followed the same route for seven moves, then played these moves, and this happened in 499 games."

without knowing anything about how we calculated similarity or grouped continuations.

### Additional UI guidance: relationship summary

One additional point: I would make the **top-level relationship description dynamic** rather than using one fixed label such as:

> "Same position · same continuation"

The purpose of this line is to give the user an immediate answer to:

> **"Why is this historical game interesting in relation to my position?"**

Depending on the comparison results, it could say things such as:

* **Same position · same continuation**
* **Same position · different continuation**
* **Same position · different move order**
* **Similar position · different continuation**
* **Same position · White diverged**
* **Same position · Black diverged**

These are examples, not a fixed list. Use only descriptions that the underlying analysis can reliably support.

### Avoid "plan" in the user-facing UI for now

I would remove the word **"plan"** from the current UI entirely.

The spikes have shown that we can identify recurring continuation patterns and meaningful differences, but we do not yet have a reliable semantic understanding of chess plans.

For example, internally we may currently have:

> `White's plan: plan 1 · 100% match`

This should **not** become a user-facing label.

Instead, show what we actually know:

> **White**
> Nge7 · O-O · c3 · Bc2 · Re1 · d4

and, where justified:

> **White followed the same continuation.**

This is both more understandable and more honest about what the system actually knows.

We can introduce proper chess-oriented plan descriptions later if the research supports them.

The general principle should be:

> **Do not expose an internal clustering concept as if it were a chess concept.**

The user should see the historical relationship and the evidence behind it, rather than the terminology or scores produced by the implementation.
