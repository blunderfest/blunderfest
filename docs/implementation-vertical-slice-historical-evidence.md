# Historical Evidence — First Vertical Slice

**Status:** Implemented (2026-08-25) — see `docs/historical-evidence-api.md`,
ADR-0026/0027, and the backend/frontend regression suites for the result.
**Purpose:** Define the first production-oriented vertical slice after Technical Spikes 02–06.

---

## 1. Background

The research phase for historical position analysis is now complete enough to begin implementation.

The relevant technical spikes established the following:

### Spike 02

Position similarity is useful for **candidate generation**, but is not a measure of historical relevance.

### Spike 04

Continuation patterns provide valuable contextual information and can distinguish different continuation families.

However, continuation similarity alone is insufficient, particularly for tempo twins.

### Spike 05

Contextual information improves human interpretation of historical candidates.

The most useful signals were:

* route comparison;
* typed differences;
* continuation families;
* per-side continuation;
* historical occurrence/game counts.

### Spike 06

A plan skeleton can successfully act as a **per-side membership/annotation layer** on top of the validated continuation families.

It should **not replace the existing family clustering mechanism**.

In particular, B1 can now mechanically join the relevant continuation family despite its tempo difference. 

---

# 2. Goal

Build the smallest end-to-end implementation that can answer:

> **Given one chess position, what useful historical evidence exists around this position?**

The first implementation must not attempt to solve the entire search problem.

It should instead demonstrate the complete pipeline:

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
Human-readable result
```

This is the exact vertical slice identified by Spike 06. 

---

# 3. Scope

The first vertical slice should:

* accept one FEN/reference position;
* retrieve historical candidates;
* compare the reference position with each candidate;
* identify typed differences;
* compare the routes leading to the position;
* inspect subsequent moves;
* associate candidates with continuation families;
* apply per-side skeleton membership;
* provide occurrence and independent-game counts;
* identify singleton/same-game-only situations;
* return a structured historical-evidence result;
* render that result in a basic UI.

The slice should work with the existing **100k-game corpus**.

Do not optimize for the final corpus size yet.

---

# 4. Explicitly out of scope

Do **not** implement:

* a universal relevance score;
* machine-learned relevance;
* semantic chess-plan recognition;
* embeddings;
* engine-based relevance ranking;
* automatic claims such as "this is the best historical example";
* the complete relaxed-search system;
* the opening explorer;
* metadata filtering beyond what is necessary for the slice;
* production-scale corpus ingestion.

The objective is to validate the entire product concept, not to finish the search engine.

---

# 5. Architectural boundary

The search implementation must remain behind the `Blunderfest.Corpus` boundary.

The existing persistence spike explicitly established this requirement:

> application code must not know the occurrence representation or write directly against the corpus schema. 

The intended boundary is:

```text
Blunderfest.Corpus
├── Extraction
├── Occurrences
├── PackedIndex (future)
└── Search / analysis internals
```

Application code such as:

* controllers;
* Channels;
* profiles;
* library;
* UI-facing application services

must not depend on the physical representation of the corpus.

The indexing implementation must remain replaceable.

---

# 6. Corpus and persistence

Use the persistence architecture already established by Technical Spike 03.

The current recommendation is:

* PostgreSQL for application data;
* PostgreSQL as the initial corpus store;
* canonical PGNs as durable corpus data;
* occurrences/indexes as derived data;
* derived indexes must be rebuildable;
* future migration to the packed binary index must not affect application code.

The important invariant is:

```text
PGN
 ↓
moves
 ↓
positions
 ↓
indexes
```

Every layer after the PGN is derived and therefore replaceable/rebuildable. 

---

# 7. Candidate generation

For the first slice, use the already validated retrieval mechanisms.

Start with:

### Exact position

Use the canonical position identity established in Spike 01.

### Structural candidate generation

Use the pawn-skeleton bucket where appropriate.

Candidates must be capped/paginated.

Do not attempt to implement every relaxed similarity strategy yet.

The research showed that dropping structural constraints can produce approximately one million candidates for a typical position, so uncontrolled relaxed retrieval is not suitable for the first implementation. 

---

# 8. Position comparison

For each candidate, expose the already established comparison dimensions.

At minimum:

* pawn structure;
* material;
* piece placement;
* king position;
* side to move;
* castling rights where relevant.

The comparison should produce **typed differences**, not a single similarity score.

For example:

```text
Pawn structure: same
Material: same
Piece placement: 13/14
Side to move: differs
Castling rights: same
```

---

# 9. Route analysis

Route comparison is one of the most important discoveries of Spike 05.

The implementation should determine:

* how many plies the reference and candidate share;
* where their routes diverge;
* which side made the extra/different move;
* what those moves were.

For example:

```text
Shared route: 6 plies

Divergence:
White:
    reference: e4
    candidate: e3

Candidate reaches equivalent position one ply later.
```

The objective is not to interpret this as a strategic error.

The objective is to make the relationship explicit so that the user can interpret it.

---

# 10. Continuation families

Use the continuation-family mechanism validated in Spike 04.

Important:

> **Do not replace the existing family construction with skeleton clustering.**

Spike 06 explicitly demonstrated that skeleton-based clustering can chain unrelated families together.

Therefore:

```text
Spike 04 family construction
        +
Spike 06 skeleton membership
```

is the intended combination.

Not:

```text
Spike 06 skeleton clustering
```

---

# 11. Plan skeleton

Use the Spike 06 `:skeleton` representation as a **membership/annotation layer**.

It should answer:

> Which side played which actions, and how does that action set relate to this continuation family?

The representation should remain explainable.

Do not expose an opaque similarity number to the user.

Where within-side order matters, retain the `:skeleton_seq` information internally.

The `:skeleton_phase` representation should not be implemented. Spike 06 explicitly recommends dropping it. 

---

# 12. Historical evidence

Every result must distinguish:

### Occurrences

How many times was this pattern encountered?

### Independent games

How many separate games support it?

These must never be conflated.

For example:

```text
27 occurrences
19 independent games
```

is substantially different from:

```text
27 occurrences
1 independent game
```

A singleton family must not be presented as historical evidence of a recurring pattern.

This was a concrete failure identified in Spike 05.

---

# 13. Same-game protection

The implementation must identify candidates that are only repeated positions from the same game.

These should not masquerade as independent historical examples.

The earlier spikes found that structural searches can otherwise return the reference game itself a few plies later, producing superficially excellent but historically useless matches. 

At minimum, the result should expose:

```text
same_game_only: true
```

or an equivalent representation.

---

# 14. Result model

The first API should return a structured historical-evidence object.

Conceptually:

```text
HistoricalEvidence
├── reference
├── candidate
│   ├── game
│   ├── occurrence
│   ├── position_relationship
│   ├── typed_differences
│   ├── route
│   ├── continuation
│   ├── continuation_families
│   ├── historical_counts
│   └── flags
└── ...
```

The exact Elixir representation is up to the developer.

Do not expose database schemas directly through the API.

---

# 15. The UI unit: Historical Evidence Card

The first UI representation should be a **Historical Evidence Card**.

The card should make the relationship understandable without requiring the user to know how the search engine works.

Conceptually:

```text
Historical example

[board]

Position
  Same pawn structure
  13/14 pieces match
  Side to move differs

Route
  Shared for 6 plies
  Diverges:
    White: e4 → e3

Continuation
  White: Family A / variation 2
  Black: Family A

Historical evidence
  17 occurrences
  12 independent games

Flags
  Tempo difference
```

This is a conceptual structure, **not a final UI specification**.

The actual UI should be refined after we have a working vertical slice.

---

# 16. No relevance score

Do not return:

```text
relevance = 0.83
```

and do not create a hidden composite score that becomes the basis of the UI.

The system should provide evidence.

The user decides whether that evidence is interesting.

This is one of the central product principles established by the research phase.

---

# 17. API / UI separation

The API should expose structured facts.

The frontend should decide how those facts are presented.

For example, the backend should return:

```text
route_shared_plies: 6
white_extra_moves: [...]
black_extra_moves: [...]
```

rather than:

```text
explanation: "White lost a tempo"
```

The latter is already an interpretation.

We want the system to expose enough information for the UI to explain the relationship, without hard-coding chess interpretation into the retrieval layer.

---

# 18. Testing

The implementation must include tests around the known research cases.

At minimum:

### B1

Must identify the tempo relationship and place Black's continuation in the appropriate family.

### B3

Must not incorrectly claim continuation-family similarity.

### B4

Must preserve its hybrid/alternative character.

### F1

Must distinguish the major continuation families.

### A2

Must preserve the Marshall/Closed distinction.

### Singleton case

Must not present a one-game continuation as independent historical evidence.

### Same-game case

Must identify or exclude repeated occurrences from the same game appropriately.

These cases are more valuable than generic unit tests alone because they encode the empirical discoveries from the spikes.

---

# 19. Performance

Do not optimize prematurely.

However, instrument the vertical slice sufficiently to measure:

* candidate generation time;
* comparison time;
* route analysis time;
* continuation analysis time;
* total request time.

The previous experiments indicate that exact retrieval is easily within interactive territory and that controlled structural retrieval is feasible. 

The first objective is to establish an end-to-end baseline.

---

# 20. Deliverables

The implementation task is complete when we have:

### Backend

* a `Blunderfest.Corpus`-contained historical evidence pipeline;
* a stable application-facing API;
* candidate generation;
* position comparison;
* route analysis;
* continuation families;
* skeleton membership;
* historical counts;
* same-game/singleton flags.

### Frontend

* a basic Analyze interaction;
* historical evidence cards;
* enough information to understand why candidates differ;
* no relevance score.

### Tests

* research regression cases described above.

### Documentation

Document:

* API contract;
* major modules;
* data flow;
* which components are temporary;
* which decisions are research-backed;
* known limitations.

---

# 21. Definition of done

The vertical slice is successful when we can load a position in the application and say:

> **"This is what Blunderfest currently knows about historical examples of this position."**

We should be able to inspect the result and manually answer questions such as:

* Why was this game found?
* How did its route differ?
* What happened after the position?
* Is this part of a recurring continuation family?
* How many independent games support that family?
* Is this just a singleton or same-game artifact?
* What is different between this candidate and the reference?

If we cannot answer those questions from the result, the slice is not finished.

---

# 22. After the vertical slice

Do not immediately start implementing additional search algorithms.

First use the feature ourselves.

We need to discover:

* what information is actually useful;
* what information is confusing;
* which candidates we naturally want to inspect;
* what users expect from "Analyze";
* which parts of the current model need refinement.

Only then should we decide what the next implementation milestone is.
