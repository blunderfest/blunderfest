# Chess Analysis Platform — Glossary

## Purpose

This document defines the canonical terminology used throughout the Chess Analysis Platform.

The purpose of the glossary is to ensure that domain concepts have a consistent meaning across functional requirements, technical documentation, source code, user interfaces, and discussions between contributors.

The definitions in this document are conceptual. They do not prescribe a particular implementation or storage technology.

---

## Position

A **Position** represents a complete chess position at a specific point in time.

A Position contains the information required to reconstruct the board state and determine the legal continuation of the game.

At a minimum, this includes:

* Piece placement
* Side to move
* Castling rights
* En passant target square

Other information associated with a FEN, such as the halfmove clock and fullmove number, may be retained but does not necessarily form part of the position's chess identity.

A Position describes **what the chess position is**, not where or when it occurred.

---

## Position Occurrence

A **Position Occurrence** represents a specific occurrence of a Position within a Game or Variation.

A Position may occur many times across different games and variations.

A Position Occurrence therefore provides contextual information such as:

* The Game or Variation in which it occurs
* The move or ply at which it occurs
* The preceding move
* The following move, where applicable

Conceptually:

```text
Position
    │
    ├── Position Occurrence in Game A
    ├── Position Occurrence in Game B
    └── Position Occurrence in Game C
```

The distinction between Position and Position Occurrence is important for position search.

---

## Position Feature

A **Position Feature** is a property that can be determined from a Position.

Examples include:

* Material balance
* Number of pieces of each type
* Pawn count
* Pawn structure
* Whether a file is open
* Whether a bishop pair exists
* Piece mobility

A Position Feature may be directly observable from the board or derived through deterministic rules.

Position Features describe **properties of a position**, rather than interpretations of its quality.

---

## Position Relation

A **Position Relation** describes a relationship between two or more elements of a Position.

Examples include:

* A rook occupying an open file
* A piece attacking a square
* A piece defending another piece
* Two rooks being connected
* A knight occupying a square that cannot be challenged by an opposing pawn
* A bishop controlling a diagonal toward the enemy king

Position Relations are distinct from simple Position Features because they describe relationships rather than isolated properties.

---

## Position Interpretation

A **Position Interpretation** is a higher-level conclusion or assessment derived from a Position and its features and relations.

Examples include:

* White has a kingside attack
* Black has a space advantage
* White has a good bishop
* The position contains a minority attack
* The position offers White better practical chances

Interpretations may be deterministic, heuristic, engine-derived, or AI-generated.

They should therefore not be treated as part of the fundamental identity of a Position.

---

## Exact Position

An **Exact Position** match occurs when two positions have identical values for all attributes that are defined as part of the position's identity.

Exact matching is the strictest form of position matching.

---

## Position Transformation

A **Position Transformation** is an explicitly permitted transformation applied to a position before comparison.

Examples may include:

* Color reversal
* Board reflection
* Other geometrically or semantically meaningful transformations

A transformation does not necessarily imply that two positions are equivalent in every context. It defines how the positions should be normalized for a particular search operation.

---

## Equivalent Position

Two positions are **Equivalent** when they are considered interchangeable for a particular search purpose under explicitly defined equivalence rules.

Equivalence is broader than exact identity but stronger than general similarity.

Examples may include:

* Positions that are identical after color reversal
* Positions where explicitly permitted piece substitutions are applied
* Positions that differ only in attributes declared irrelevant by the search

Equivalence must always be defined in terms of explicit rules. It should not be treated as a subjective judgment.

---

## Tolerant Match

A **Tolerant Match** allows explicitly defined deviations from a reference position.

Examples include:

* A pawn on h2 or h3
* A knight within one square of a reference square
* A material difference of at most one pawn

Tolerance describes **allowed deviations**, rather than general similarity.

---

## Structural Similarity

Two positions have **Structural Similarity** when important structural characteristics are similar even if their exact piece placement differs.

Potential structural characteristics include:

* Pawn structure
* Open and semi-open files
* Pawn islands
* Passed pawns
* King locations
* General material structure

Structural similarity is normally expressed as a degree or score rather than as a binary condition.

---

## Similarity

**Similarity** describes the degree to which two positions resemble each other according to a defined set of comparison dimensions.

Similarity is inherently multidimensional.

Possible dimensions include:

* Material
* Pawn structure
* Piece placement
* King position
* Mobility
* Board structure
* Tactical features
* Strategic features

Different searches may assign different importance to these dimensions.

A similarity score must therefore be interpreted together with the dimensions and rules used to calculate it.

---

## Similarity Dimension

A **Similarity Dimension** is a specific aspect of a position that contributes to a similarity comparison.

Examples include:

* Material similarity
* Pawn structure similarity
* Piece placement similarity
* King position similarity
* Mobility similarity

A search may assign different weights to different dimensions.

For example:

```text
Pawn structure     40%
Material           30%
King position      15%
Piece placement    10%
Side to move        5%
```

These weights are illustrative and do not define a final scoring algorithm.

---

## Search Query

A **Search Query** is a formal description of the conditions and comparison rules used to retrieve Games, Positions, or Position Occurrences.

A Search Query may contain:

* Filters
* Position constraints
* Transformations
* Tolerances
* Equivalence rules
* Similarity dimensions
* Similarity thresholds
* Ranking instructions
* Game metadata constraints

---

## Search Result

A **Search Result** is an item returned by a Search Query.

For position searches, a result will normally refer to a Position Occurrence rather than merely to an abstract Position, because the user needs to know where the position occurred.

A Search Result may also contain:

* Similarity score
* Matching dimensions
* Differences
* Applied transformations
* Explanation of the match

---

## Retrieval

**Retrieval** is the process of identifying candidate results that may satisfy a Search Query.

Retrieval prioritizes efficiently narrowing a potentially very large dataset to a manageable candidate set.

Retrieval does not necessarily perform the complete similarity calculation.

---

## Matching

**Matching** is the process of determining how well a candidate satisfies the rules of a Search Query.

Matching may involve:

* Exact comparison
* Constraint evaluation
* Tolerance evaluation
* Equivalence rules
* Feature comparison

---

## Ranking

**Ranking** is the process of ordering matching candidates according to relevance or similarity.

For similarity searches, ranking may use a similarity score and other search-specific criteria.

---

## Search Dimension

A **Search Dimension** describes an aspect of a search that can be independently constrained, compared, or weighted.

Examples include:

* Material
* Pawn structure
* Piece placement
* King position
* Game metadata
* Tactical characteristics
* Strategic characteristics

Search dimensions may be used for both filtering and similarity comparison.
