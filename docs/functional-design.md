# Functional Specification — Chess Analysis & Search

**Version:** 0.2
**Status:** Working document
**Purpose:** Shared functional model, product direction, and decision framework

> **Important:** This document deliberately distinguishes between established decisions, working hypotheses, and open questions. Working hypotheses are **not implementation requirements**. They are assumptions that should be tested through experiments and user feedback.

---# Functional Specification — Chess Analysis & Search

**Version:** 0.2
**Status:** Working document
**Purpose:** Shared functional model, product direction, and decision framework



# 1. Product Vision

The application helps chess players understand positions by using the history of chess as evidence.

The primary goal is not simply to answer:

> **"What is the best move?"**

Instead, the system should help answer questions such as:

> "What do strong players do in positions like this?"

> "What kind of plans occur in this type of position?"

> "Is this position actually similar to the positions I think it resembles?"

> "What happened in historical games when players chose a different approach?"

The system should help the user **investigate a position**, rather than merely return a single answer.

The primary user-facing interaction is therefore **Analyze**, rather than Search.

---

# 2. Problem Statement

A chess player often reaches a position where the opening knowledge ends and they are unsure how to proceed.

A traditional opening database can tell them:

> "These are the most common moves."

A chess engine can tell them:

> "This move is objectively strongest."

Neither necessarily answers:

> **"What is going on here?"**

The goal of Analyze is to provide historical and structural context that helps the player develop their own understanding.

The system should therefore treat historical games not merely as a database of moves, but as a source of **evidence about how chess players have handled comparable situations**.

---

# 3. Core Principles

## 3.1 Analyze, not Search

The user should not be required to formulate a precise search query.

The user starts from a chess position and asks the system to **Analyze** it.

Search/retrieval is an underlying technical capability.

Other features, including Opening Explorer, may use the same underlying capabilities for different purposes.

---

## 3.2 The user does not necessarily want a move

A user may want:

* a move;
* a plan;
* examples;
* patterns;
* comparisons;
* historical context;
* confirmation or contradiction of an idea.

The system should therefore not assume that every analysis request is a request for the best move.

---

## 3.3 Historical players are evidence, not personalities

The system should not attempt to model a player's personality in order to predict what they would play.

For example, the system should not assume:

> "Morphy likes sacrifices."

or:

> "Nakamura is positional."

Instead, it should ask:

> **"What did strong players actually do in comparable situations?"**

The retrieval system should therefore aim to behave more like a **strong chess spectator** than a personality model of an individual player.

---

## 3.4 Relevance is more important than raw similarity

A position that is mathematically or structurally similar is not necessarily useful to a human player.

The system should ultimately attempt to find **relevant analogies**, not merely positions with the smallest numerical distance from the reference position.

This is an established product principle.

The exact definition and implementation of relevance remain open.

---

## 3.5 Do not assume that a position can be understood in isolation

A single position contains important information:

* material;
* pawn structure;
* piece placement;
* king safety;
* space;
* possible moves.

However, strategic meaning may emerge more clearly from a **sequence of positions**.

For example, a series of positions may reveal:

* a strategic plan;
* a pawn break;
* a manoeuvring idea;
* a transformation;
* a change in king safety;
* a particular response to an opponent's plan.

### Current status

**Working hypothesis:** strategic interpretation will often benefit from sequences of positions or game context rather than isolated positions.

This must be tested.

---

# 4. Analyze

Analyze starts from a chess position.

Conceptually:

```text
Position
   ↓
Analyze
   ↓
Relevant historical material
   ↓
Patterns / comparisons / games
   ↓
Further exploration
```

The user may not know what they are looking for when they start.

The system should therefore be able to provide useful starting points rather than requiring a precise query.

Analyze is an **exploration process**, not necessarily a single query with a single answer.

---

# 5. Position and Game Context

The system should be able to reason about both:

### Position-level information

Examples:

* piece placement;
* material;
* pawn structure;
* side to move;
* castling rights;
* king safety;
* space.

### Sequence-level information

Examples:

* previous moves;
* subsequent moves;
* pawn breaks;
* manoeuvres;
* transformations;
* recurring plans.

The relative importance of these dimensions is not yet established.

---

# 6. Relevance and Similarity

We do not currently assume that there is one universal "similarity score".

A position can be relevant in different ways.

Potential dimensions include:

* exact position;
* material;
* pawn structure;
* piece placement;
* king safety;
* space;
* pawn breaks;
* previous moves;
* following moves;
* structural transformations;
* game context.

For example:

```text
Position A
    │
    ├── exact match
    ├── same pawn structure
    ├── similar material
    ├── similar piece configuration
    └── similar strategic sequence
```

These should be treated as potentially different forms of relevance.

### Important

We should not assume that combining all dimensions into one score is necessarily the correct solution.

A result may be useful because of **one particularly meaningful similarity**, even if it is not globally similar.

---

# 7. Historical Games as Evidence

The system will retrieve historical games and positions.

A retrieved item is initially simply a **search result**.

It becomes useful evidence when the user considers it relevant to the analysis.

This distinction is important:

```text
Search result
     ↓
Relevant result
     ↓
Evidence
```

We do not necessarily need a formal `Evidence` domain object in the first version.

The concept is primarily useful for understanding the intended user experience.

---

# 8. User Scenarios

## 8.1 Scenario A — Opening ends

The player knows the opening and reaches a position outside their preparation.

They ask:

> "What do strong players usually do here?"

The system should provide relevant historical examples and patterns.

---

## 8.2 Scenario B — No obvious plan

The player does not know what to do.

They ask:

> "What do players do in positions like this?"

The system should find useful analogies rather than simply ranking moves by engine evaluation.

---

## 8.3 Scenario C — User has a hypothesis

The player already has an idea:

> "I think Black usually plays ...c5 here to challenge the d4-pawn."

They want to investigate whether historical games support or contradict this idea.

Potential future functionality could allow:

* supporting evidence;
* counterexamples;
* alternative explanations;
* further searches.

This is an important possible direction, but it is **not required for the first implementation**.

---

# 9. Opening Explorer

Opening Explorer is a separate feature from Analyze.

It may use the same underlying search/retrieval infrastructure, but its purpose is different.

### Opening Explorer

Primarily asks:

> **"What moves have players played from here?"**

### Analyze

Primarily asks:

> **"What is interesting or useful to understand about this position and comparable positions?"**

Opening Explorer should therefore not simply be treated as another Analyze result view.

---

# 10. Collaboration

The application is intended to support collaborative chess analysis.

In the future, multiple users may contribute to the same analysis.

Possible concepts include:

* comments;
* variations;
* observations;
* evidence;
* hypotheses;
* counterexamples;
* shared searches;
* discussion.

However, these concepts should not automatically become formal domain entities.

We should only introduce explicit domain models when their behaviour and lifecycle are sufficiently understood.

---

# 11. Analysis as a Future Core Concept

An `Analysis` can eventually represent the context in which one or more users investigate a position.

Conceptually:

```text
Analysis
 ├── Positions
 ├── Searches
 ├── Results
 ├── Variations
 ├── Evidence
 └── Collaboration
```

This is a **functional model**, not a definitive database schema.

We should avoid prematurely translating every concept into a persistent entity.

---

# 12. Technical Constraints and Existing Decisions

The existing application already has the following technical choices.

### Backend

* Elixir
* Phoenix
* Phoenix API controllers
* Phoenix Channels where realtime functionality is required

### Frontend

* React 19
* Redux

### Deployment

* Fly.io

### Existing UI

The application already contains substantial UI functionality.

The Analyze/Search functionality was deliberately left out while the product concepts were being explored.

The existing UI should therefore be treated as the starting point for future Analyze integration.

---

# 13. Database and Storage

No database technology has been selected yet for the chess corpus/search workload.

This is deliberate.

The future workload may involve:

* millions of games;
* potentially hundreds of millions of positions;
* frequent retrieval;
* increasingly flexible matching criteria.

The storage system therefore needs to be evaluated experimentally.

We should distinguish between:

```text
Game corpus
     ↓
Position representation
     ↓
Position index
     ↓
Retrieval engine
     ↓
Analyze API
```

These components do not necessarily have to use the same technology.

---

# 14. Technical Spike 01 — Position Retrieval

## Goal

Determine whether we can efficiently store and retrieve chess positions from a large game corpus.

The first problem is deliberately simple:

> **Given a chess position, find all occurrences of that exact position in the corpus.**

This spike is intended to investigate the technical foundation, not to implement the complete Analyze engine.

---

## 14.1 Initial input

A FEN representing a chess position.

Example:

```text
rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2
```

The move counters in the FEN are not part of the identity of the chess position.

The exact definition of `PositionKey` should be investigated and documented.

Potential components:

* piece placement;
* side to move;
* castling rights;
* en passant state.

---

## 14.2 Initial output

For example:

```text
Game
Ply
Position
```

A query should allow us to answer:

> "Which games reached this exact position, and at what point in the game?"

---

## 14.3 Initial data representation

A minimal occurrence could conceptually contain:

```text
PositionKey
GameId
Ply
```

The exact implementation is intentionally left open.

---

## 14.4 Benchmark scale

The investigation should use progressively larger datasets.

Suggested starting points:

```text
100,000 games
1,000,000 games
10,000,000 games
```

The largest dataset is optional.

If an approach does not scale to a particular size, that is itself a useful result.

---

## 14.5 Metrics

Measure at least:

* import throughput;
* number of games;
* number of positions;
* storage size;
* index size;
* lookup latency;
* p50 lookup latency;
* p95 lookup latency;
* p99 lookup latency;
* memory usage;
* CPU usage where relevant.

The benchmark environment should be documented so results are reproducible.

---

# 15. Initial Retrieval Layers

Development should proceed incrementally.

### Layer 1 — Exact position

Find exactly the same position.

### Layer 2 — Transformations

For example:

> Same position with White and Black exchanged.

### Layer 3 — Structural similarity

For example:

> Similar pawn structure.

### Layer 4 — Relaxed similarity

Allow limited differences in pieces, pawns, or other properties.

### Layer 5 — Context

Compare preceding and following positions/moves.

### Layer 6 — Behaviour and patterns

Investigate what players actually did after reaching comparable positions.

Only Layer 1 is currently an implementation target.

Layers 2–6 are future research directions.

---

# 16. Established Decisions

The following are currently considered established:

* The primary user interaction is **Analyze**, not Search.
* Analyze starts from a chess position.
* The user does not necessarily need to formulate a search query.
* Historical games are an important source of information.
* Relevance is more important than raw positional similarity.
* The system should not model individual player personalities as its primary retrieval mechanism.
* Exact position retrieval is the first technical problem to solve.
* Opening Explorer and Analyze are different features.
* The existing UI is the starting point for future integration.
* Elixir/Phoenix is the backend stack.
* React 19/Redux is the frontend stack.
* Fly.io is the deployment platform.
* The database/search technology has not yet been decided.
* Technical assumptions should be tested experimentally.

---

# 17. Working Hypotheses

These are ideas we currently consider plausible but have **not yet established**:

### H1 — Strategic meaning requires context

A sequence of positions may provide significantly more useful strategic information than a single isolated position.

### H2 — Structural similarity is useful

Pawn structure and related structural properties may be more useful for human-oriented retrieval than simple piece/material similarity.

### H3 — Context improves relevance

Previous and subsequent moves may significantly improve the usefulness of retrieved examples.

### H4 — Users often do not know what to search for

A position can be the starting point of an investigation without the user knowing the question beforehand.

### H5 — Historical examples can reveal useful plans

The actions of strong players in comparable positions can provide useful information even when there is no single obvious "best move".

### H6 — A strong-spectator model is useful

Treating the retrieval system as a strong chess spectator may produce more useful results than trying to model individual player personalities.

These hypotheses should be tested rather than assumed to be true.

---

# 18. Open Questions

The following questions remain deliberately unresolved:

### Retrieval

* How should a chess position be represented?
* Which properties should be indexed?
* How should en passant be represented?
* How should transformed positions be handled?
* How should structural similarity be defined?

### Ranking

* What makes a historical example useful?
* How should multiple similarity dimensions be combined?
* Should there even be one global relevance score?
* How should representative games be selected?

### Context

* How many previous moves are useful?
* How many subsequent moves are useful?
* Is a short sequence sufficient?
* Does the entire game matter?

### Player strength

* How should "strong player" be defined?
* Should player strength influence ranking?
* Should tournament level, rating, date, or other factors matter?

### Strategy

* Can strategic concepts be inferred from positions?
* Can they be inferred reliably from sequences?
* Which concepts can actually be detected algorithmically?

### Infrastructure

* Which database/storage technology is appropriate?
* Should corpus storage and search indexing be separate?
* Can PostgreSQL handle the expected workload?
* When would a specialized index become justified?

### UX

* How much information should Analyze initially show?
* How do we avoid overwhelming users?
* How do we expose uncertainty?
* How do we let users investigate an interesting result without requiring them to understand the underlying search system?

---

# 19. Explicitly Out of Scope for the First Technical Spike

The first technical spike should **not** attempt to implement:

* the complete Analyze engine;
* strategic interpretation;
* similarity ranking;
* AI-generated explanations;
* hypotheses;
* collaborative research workflows;
* full realtime collaboration;
* a new Analyze UI;
* a final database architecture;
* a universal similarity score.

The existing UI should not be substantially redesigned as part of this spike.

The purpose of the spike is to **learn**, not to prematurely finalize the architecture.

---

# 20. Development Philosophy

The project should be developed experimentally.

The intended process is:

```text
Idea
  ↓
Working hypothesis
  ↓
Experiment
  ↓
Observation
  ↓
Decision
  ↓
Implementation
  ↓
Re-evaluation
```

We should actively look for evidence that disproves our assumptions.

A failed hypothesis is a successful outcome if it prevents us from building the wrong thing.

We should prefer:

> **"We tested this and it doesn't work."**

over:

> **"This sounds like it should work."**

---

# 21. Immediate Next Step

The immediate technical task is:

> **Technical Spike 01 — Position Retrieval**

The goal is to determine whether a practical, scalable foundation exists for retrieving exact chess positions from a large corpus.

The outcome should inform the first architectural decision regarding:

* position representation;
* indexing;
* storage;
* retrieval technology.

Only after this experiment should we begin implementing the Analyze retrieval layer.

---

## Document status

This document is intentionally **not a final specification**.

It is a shared model of what we currently believe.

As experiments produce new information, sections should be updated rather than allowing outdated assumptions to silently become implementation requirements.

**The document should evolve with the evidence.**
