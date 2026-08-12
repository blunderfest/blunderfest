# Chess Position Search

## Functional Design

**Status:** Draft
**Scope:** Position and game search
**Audience:** Product and domain design, future developers and contributors

---

## 1. Purpose

The chess analysis application allows users to search a large collection of chess games for positions that may be useful for analysing a reference position.

The primary goal is **not to find mathematically similar positions**.

The goal is to help answer the practical chess question:

> **"I don't know what to do here. What do strong players do in positions sufficiently like this one?"**

Search therefore aims to retrieve **useful analogies**, rather than merely positions with a high numerical similarity.

---

## 2. Core Principle

### Similarity is a means, not the goal

A position can be similar to another position in several different ways:

* exact board configuration;
* pawn structure;
* material composition;
* piece placement;
* piece relationships;
* king safety;
* strategic concepts;
* position sequence.

None of these dimensions is sufficient by itself to define whether two positions are useful analogies.

The search system should therefore treat these dimensions as **evidence of relevance**, rather than automatically reducing them to a single universal similarity score.

---

## 3. Position and Game State

The system distinguishes between the complete state of a game and the aspects of that state that are relevant to a particular search.

A game state may contain:

* board configuration;
* side to move;
* castling rights;
* en-passant state;
* move counters;
* game and move metadata.

These attributes do not necessarily all form part of the user's definition of "the same position".

For example, the following positions have identical board configurations:

```text
(1) rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2

(2) rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2
```

They can arise through different move sequences:

```text
1. d4 d5
```

and

```text
1. d3 d5 2. d4
```

For search purposes, these may be considered the **same board position**, while still representing different game states because the side to move differs.

Therefore:

> **Position identity and game-state identity are separate concepts.**

Search must be able to selectively include or ignore relevant state dimensions.

---

## 4. Position Occurrences

Search results refer to **occurrences of positions**, not merely abstract positions.

A position may occur:

* in multiple games;
* multiple times in the same game;
* through different move orders;
* in different variations of a game.

A search result should therefore be traceable to the relevant game and location within that game.

Conceptually:

```text
Search
  ↓
Matching Position
  ↓
Position Occurrences
  ↓
Games / Variations / Move Sequences
```

---

# 5. Search Dimensions

The search system should support multiple dimensions of comparison.

These dimensions should remain conceptually independent. A search may use one or several of them.

## 5.1 Exact Board Position

The system must be able to find occurrences where the board configuration is identical.

This compares the actual placement of pieces and pawns on the board.

Side to move does not have to be part of this comparison.

---

## 5.2 Side to Move

Side to move is an independently searchable property.

The user may:

* require the same side to move;
* allow either side to move;
* potentially use the difference as ranking information.

A different side to move does not automatically make a position irrelevant.

---

## 5.3 Color Reversal

The system should support searching for a position after a complete color reversal.

Color reversal is a **transformation**, rather than a separate form of similarity.

Conceptually:

```text
Reference Position
        ↓
Color Reversal
        ↓
Transformed Position
        ↓
Normal Position Matching
```

The transformation includes the appropriate reversal of:

* piece colors;
* board orientation;
* side to move;
* castling rights;
* en-passant state.

---

# 6. Pawn Search

Pawn-related search must distinguish between several fundamentally different concepts.

## 6.1 Exact Pawn Placement

The same pawns occur on the same squares.

This is a geometric comparison.

## 6.2 Geometric Pawn Tolerance

The user may allow pawns to be displaced by a specified amount.

For example:

> "Match the same pawn placements while allowing a pawn to be one rank away."

This is a valid search operation, but it should **not** be described as structural similarity.

## 6.3 Pawn Structure Similarity

Structural similarity concerns relationships and characteristics rather than merely square coordinates.

Relevant characteristics may include:

* pawn chains;
* isolated pawns;
* doubled pawns;
* passed pawns;
* backward pawns;
* connected pawns;
* pawn islands;
* majorities;
* open and semi-open files;
* relationships between opposing pawn formations.

Important principle:

> **Geometric proximity does not imply structural similarity.**

For example, moving one pawn by one square can sometimes change its structural relationships significantly.

---

# 7. Material Search

Material search must distinguish between **material composition** and **material value**.

## 7.1 Material Composition

The system may search for positions containing similar types and numbers of pieces and pawns.

A difference of one pawn may still result in a highly useful analogue.

For example:

```text
Reference: Queen + Rook + Bishop + Knight + 5 pawns
Candidate: Queen + Rook + Bishop + Knight + 4 pawns
```

This may be considered a useful match.

## 7.2 Material Value

A search based purely on nominal material value is a different type of query.

For example:

```text
Queen + Rook + Bishop + Knight
```

and

```text
Queen + two Rooks
```

may have similar nominal material value while representing fundamentally different chess situations.

Therefore:

> **Material value should not be treated as a general proxy for positional similarity.**

Material composition is generally more relevant to analogical search.

---

# 8. Piece Search

## 8.1 Exact Piece Identity

The system can require the same piece type on the same square.

For example:

```text
Knight f3 → Knight f3
```

## 8.2 Piece Substitution

The system may support controlled relaxation of piece identity.

For example:

```text
Knight f3 ↔ Bishop f3
```

This is a **piece-identity relaxation**, not a claim that a knight and bishop perform the same function.

Substitution may be constrained by:

* color;
* piece class;
* number of substitutions;
* specific squares or pieces.

## 8.3 Piece Role

Functional similarity between pieces is a separate and higher-level concept.

For example:

> "Find positions where the piece on f3 performs a similar role."

This is not equivalent to:

> "Allow a bishop instead of a knight on f3."

Piece-role similarity belongs to a higher conceptual layer.

---

# 9. Structural Similarity

Structural similarity describes similarity in the organization of a position rather than merely similarity of individual pieces or squares.

It may include:

* pawn structure;
* open and semi-open files;
* king placement;
* piece relationships;
* weak squares;
* piece activity;
* space;
* material composition;
* important positional dependencies.

Structural similarity does **not** imply strategic equivalence.

Two positions can share the same structural characteristics while presenting different practical plans.

Therefore:

> **Structural similarity is evidence of relevance, not proof of strategic similarity.**

---

# 10. Conceptual Similarity

Conceptual similarity concerns meaningful chess ideas that a strong, style-independent observer could reasonably identify in two positions or position sequences.

Examples may include:

* attacking a weakness;
* preparing a pawn break;
* exchanging a defender;
* improving a poorly placed piece;
* creating or advancing a passed pawn;
* restricting an opposing piece;
* attacking the king.

The system must not assume that a position has one objectively correct strategic interpretation.

A position may support multiple plausible concepts.

Conceptual similarity therefore represents **overlap between possible interpretations**, not a definitive statement about the correct plan.

---

## 10.1 Strong Observer Principle

The system should model the perspective of a hypothetical **strong, style-independent observer**.

The observer should not rely on:

* the personality of the original player;
* known playing style;
* reputation;
* assumed intentions;
* hindsight based on later moves.

The observer asks:

> **"What meaningful chess ideas can reasonably be identified from this position?"**

This intentionally separates:

```text
What the position may suggest
```

from:

```text
What the player actually intended
```

and:

```text
What the player actually played
```

---

# 11. Position vs. Sequence

Some information cannot reliably be inferred from a single position.

A sequence of positions may reveal:

* the development of a plan;
* a strategic transformation;
* a pawn break;
* a change in piece roles;
* an attack being built;
* a transition into a particular type of endgame.

Therefore conceptual search may operate on:

### Position-level concepts

Ideas identifiable from one position.

### Sequence-level concepts

Ideas identifiable from the evolution of several positions.

This distinction should be preserved in the domain model.

---

# 12. Hard Constraints and Relevance Evidence

The search system should distinguish between **constraints** and **evidence**.

## Hard constraint

A condition that a result must satisfy.

Example:

> Pawn structure must match exactly.

A position that fails the constraint is excluded.

## Relevance evidence

A characteristic that makes a result more or less useful, but does not necessarily exclude it.

Example:

> Similar piece placement.

A candidate with different piece placement may still be highly relevant.

Conceptually:

```text
Reference Position
       │
       ├── Hard Constraints
       │       ↓
       │   Candidate Set
       │
       └── Relevance Evidence
               ↓
            Ranking
```

---

# 13. Combined Search

The search system must support combining multiple comparison dimensions.

For example:

> Find positions with:
>
> * the same pawn structure;
> * at most one additional or missing pawn;
> * similar king positions;
> * similar piece placement;
> * color reversal allowed.

The system should not require every comparison dimension to be treated as a hard constraint.

A query may therefore conceptually consist of:

```text
Constraints
+
Preferences / Relevance Evidence
+
Ranking
```

This is preferable to reducing every query to one universal similarity score.

---

# 14. Result Explanation

Search results should provide an understandable explanation of **why a position was considered relevant**.

For example:

```text
Pawn structure       Exact
Material composition  Very similar
King placement        Similar
Piece placement       Moderate
Conceptual overlap    High
```

The system should ultimately be able to explain a result in chess terms, such as:

> Same isolated-pawn structure, similar king safety, and similar pressure against the open file.

The purpose is not merely to produce a ranking, but to allow the user to judge whether the analogy is useful.

---

# 15. Primary User Goal

All search functionality should ultimately serve the following user question:

> **"I don't know what to do here. What do strong players do in positions sufficiently like this one?"**

This has several consequences.

The system should not optimize exclusively for:

* visual similarity;
* material similarity;
* geometric similarity;
* engine evaluation;
* a single numerical similarity score.

Instead, it should optimize for:

> **Useful analogies for understanding and analysing the reference position.**

---

# 16. Design Principles Established So Far

The following principles have emerged from the initial search-model investigation.

1. **Position identity is not necessarily FEN equality.**
2. **Game-state identity and search-position identity are separate concepts.**
3. **Side to move is an independently searchable dimension.**
4. **Color reversal is a transformation.**
5. **Geometric similarity is not structural similarity.**
6. **Piece substitution is a controlled relaxation of piece identity.**
7. **Material composition is generally more useful for analogy search than nominal material value.**
8. **Similarity dimensions are evidence of relevance, not necessarily the final answer.**
9. **Structural similarity does not imply strategic equivalence.**
10. **Conceptual similarity may require a sequence of positions.**
11. **A position may support multiple plausible interpretations.**
12. **The system should model a strong, style-independent observer rather than player intent.**
13. **Hard constraints and relevance evidence must be distinguishable.**
14. **Search results should explain why they are considered relevant.**
15. **The ultimate goal is useful analogy, not mathematical similarity.**

---

# 17. Open Questions

The following questions are intentionally left unresolved at this stage:

* How should structural similarity be calculated?
* How should conceptual similarity be identified?
* Which concepts should be represented explicitly?
* When does a sequence provide more useful information than a single position?
* How should different relevance dimensions be ranked?
* Should users be able to configure ranking weights?
* How should search results be grouped to avoid overwhelming the user?
* How should duplicate or transposed occurrences be presented?
* How should the system evaluate whether a retrieved game is actually useful to the user?

These are **open design questions**, not implementation requirements.

They should be addressed only when sufficient evidence or concrete use cases justify doing so.

---

# 18. Scope Boundary

This document deliberately does not define:

* database technology;
* indexing strategy;
* storage model;
* search engine technology;
* machine-learning architecture;
* chess-engine integration;
* performance implementation;
* distributed processing;
* caching.

Those decisions belong to a later technical design phase.

The purpose of this document is to establish **what the search system means and what it should be capable of doing**, independently of how it is implemented.
