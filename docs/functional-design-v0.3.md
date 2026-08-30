# Functional Specification — Chess Analysis & Search

**Version:** 0.3
**Status:** Working document
**Purpose:** Shared functional model, product direction, and decision framework

> **Important:** This document distinguishes between established decisions, research-backed findings, working hypotheses, and open questions. Research-backed findings are strong enough to guide the first implementation, but remain subject to re-evaluation through product use and further experiments. Working hypotheses are **not implementation requirements**.



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

# 6. Relevance, Similarity, and Historical Relationships

Research has confirmed that there is no useful basis, at this stage, for treating historical usefulness as one universal similarity or relevance score.

Position similarity is valuable primarily for **candidate generation**. A historical candidate may then be useful for different reasons.

The first implementation should preserve distinct dimensions such as:

* exact or structural position relationship;
* pawn structure;
* material and piece placement;
* side to move and other typed position differences;
* the route by which the position was reached;
* move-order and tempo differences;
* following moves;
* continuation families;
* per-side continuation relationships;
* historical occurrence counts;
* number of independent games.

Conceptually:

```text
Reference position
        │
        ▼
Candidate generation
        │
        ├── Position relationship
        ├── Route
        ├── Typed differences
        ├── Continuation
        └── Historical support
                 │
                 ▼
         Historical evidence
```

These dimensions provide different kinds of information and should not be silently collapsed into a single user-facing relevance value.

### Research-backed finding

A result can be valuable because of a **meaningful difference**, not only because of similarity. Examples include a different move order, a tempo difference, an alternative piece setup, or a different continuation from the same decision point.

The system should therefore preserve both similarities and differences so the user can investigate the relationship.

# 7. Historical Games as Evidence

The system retrieves historical games and positions as candidate material for analysis.

A retrieved candidate is not automatically evidence that a chess interpretation is correct. The application should expose the historical relationship in a form that helps the user judge its usefulness.

Conceptually:

```text
Historical candidate
        ↓
Contextual relationship
        ↓
Historical evidence presented to user
        ↓
Human interpretation / further exploration
```

For a useful historical example, the application may expose:

* why the position was retrieved;
* how the candidate position relates structurally to the reference;
* typed differences between the positions;
* how the two routes reached the position and where they diverged;
* what happened after the position;
* whether the continuation belongs to a recurring continuation family;
* per-side continuation relationships where useful;
* how many occurrences and independent games support a pattern;
* whether the apparent pattern is only a singleton or same-game artefact.

### Important distinction

The application should distinguish **historical support** from interpretation.

For example, it may show that a continuation occurred in 17 occurrences across 12 independent games. It should not automatically turn that fact into a claim such as:

> "This is the correct plan."

Likewise, one unusual historical game can be interesting without constituting evidence of a recurring historical pattern.

We do not currently require a formal `Evidence` domain entity. The concept describes the product behaviour and information model.

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

# 15. Analyze Retrieval and Evidence Model

The original research plan described retrieval as a sequence of increasingly relaxed layers. Technical Spikes 01–06 showed that the first implementation is better modelled as a pipeline of complementary responsibilities rather than a single linear similarity ladder.

The current functional model is:

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
Continuation families / membership
       ↓
Historical support
       ↓
Human-readable historical evidence
```

## 15.1 Candidate generation

Candidate generation may use exact position identity and structural retrieval mechanisms. Similarity at this stage is used to find potentially useful material, not to declare relevance.

## 15.2 Position comparison

Candidates should be compared using explicit dimensions rather than only a global distance. Relevant facts may include pawn structure, material, piece placement, king placement, side to move, castling rights, and other typed differences.

## 15.3 Route and move-order analysis

Previous moves can reveal relationships that the board position alone cannot show. The system should be able to expose shared route length, divergence points, extra or missing moves, and tempo/move-order relationships where mechanically detectable.

The system should expose the relationship rather than automatically interpreting it as a strategic mistake.

## 15.4 Continuation analysis

Following moves are a first-class source of context. Research has shown that recurring continuation families can distinguish different directions from otherwise identical or highly similar positions.

Continuation families should be used as clustering and annotation evidence, not as a universal relevance score.

## 15.5 Action / plan-skeleton membership

A lightweight action-based representation can help associate tempo-shifted or move-order-shifted candidates with an existing continuation family.

This representation is an **annotation/membership layer**. It should not replace the validated continuation-family construction mechanism, because skeleton-only clustering can merge genuinely different continuations.

## 15.6 Historical independence

Occurrence counts and independent-game counts are different facts and must remain distinguishable.

A continuation observed many times within one game is not equivalent to the same continuation appearing across many independent games.

Singleton and same-game-only results must not be presented as evidence of a recurring historical pattern.

## 15.7 First implementation target

The first production-oriented target is a vertical slice that takes one reference position through this entire pipeline and presents the resulting historical evidence to the user.

It is intentionally **not** a complete Analyze engine.

# 16. Established Decisions and Research-Backed Findings

## 16.1 Established product decisions

* The primary user interaction is **Analyze**, not Search.
* Analyze starts from a chess position.
* The user does not necessarily need to formulate a search query.
* Historical games are an important source of information.
* Relevance is more important than raw positional similarity.
* The system should not model individual player personalities as its primary retrieval mechanism.
* Opening Explorer and Analyze are different features.
* The existing UI is the starting point for Analyze integration.
* Elixir/Phoenix is the backend stack.
* React 19/Redux is the frontend stack.
* Fly.io is the deployment platform.
* Technical assumptions should be tested experimentally.

## 16.2 Research-backed findings from Technical Spikes 01–06

The following findings are sufficiently supported to guide the first implementation:

* Position similarity is useful for candidate generation but is not equivalent to historical relevance.
* Exact-position retrieval is valuable but becomes increasingly sparse outside common opening positions.
* Structural retrieval can find useful analogies, but must protect against same-game artefacts.
* Previous moves and route comparison can expose meaningful move-order and tempo relationships.
* Following moves provide useful contextual information and can reveal recurring continuation families.
* Contextual annotations improve a human evaluator's ability to understand why a historical candidate may be useful or irrelevant.
* Typed differences are more useful than hiding all differences inside one numerical similarity value.
* Per-side continuation information can matter, especially in tempo-shifted positions.
* Historical occurrence counts must be distinguished from independent-game counts.
* A singleton must not be presented as evidence of a recurring continuation family.
* Lightweight action/plan skeletons can improve membership annotation across move-order differences, but should not construct the continuation families themselves.
* Raw continuation-similarity values are primarily internal technical signals and are not, by themselves, useful user-facing explanations.
* The first implementation should expose historical relationships and evidence rather than calculate one universal relevance score.

# 17. Working Hypotheses

These ideas remain plausible but are not yet established implementation requirements.

### H1 — Historical evidence can become an exploration interface

Grouping examples by relationship, difference, continuation, and historical support may provide a better Analyze experience than a flat ranked list of "similar games".

### H2 — Meaningful differences can be as valuable as similarities

Candidates that are similar enough to compare but differ in one important dimension may be especially useful for human analysis.

The spikes provide examples supporting this idea, but the general rule still requires validation through actual product use.

### H3 — Continuation families can act as a practical proxy for some plan relationships

Continuation families and action membership can sometimes capture what a human describes as a related plan without semantic plan recognition.

This works in tested cases, but should not yet be generalized to all chess positions.

### H4 — Users often do not know what to investigate beforehand

A position can be the starting point of an investigation without the user knowing the question in advance. The first Analyze experience should therefore provide useful starting points for exploration.

### H5 — A strong-spectator model remains useful

The system should continue to behave as a strong spectator that knows where to find historical evidence, rather than as an oracle that claims a single correct interpretation.

### H6 — Human-readable relationships are more valuable than raw technical scores

The user may benefit more from statements such as "same route until move X", "alternative continuation family", or "12 independent games" than from opaque similarity values. This should be tested in the vertical slice.

# 18. Open Questions

The research phase answered several original questions, but important uncertainties remain.

### Retrieval and representative selection

* Which candidate-generation mechanisms should be enabled by default in the first Analyze experience?
* How should large candidate sets be sampled or capped without hiding useful minority examples?
* How should representative games be selected within a continuation family?
* Which transformations are genuinely useful beyond the tested cases?

### Ranking and presentation

* Does Analyze eventually need ranking within a group, and if so, by which explicit criteria?
* Should results primarily be grouped by relationship/continuation rather than globally ranked?
* How should unusual but potentially interesting singleton examples be presented without overstating their evidential strength?

### Context

* What route/continuation window is most useful across different game phases?
* When is local move context insufficient and a larger part of the game required?
* How robust are continuation families outside the tested opening/middlegame examples?

### Player strength and metadata

* How should player strength influence historical support or filtering?
* Should tournament level, rating, date, time control, or other metadata influence representative selection?
* How should master-level evidence and broader player databases be combined or contrasted?

### Strategy

* Which strategic concepts, if any, should eventually be inferred explicitly?
* When are continuation families sufficient, and when would semantic interpretation add real user value?
* Can transformations such as pawn breaks and piece manoeuvres be exposed usefully without turning them into overconfident labels?

### Infrastructure

* What corpus/index architecture is appropriate at full production scale?
* When should a specialized index replace or supplement the initial storage/retrieval implementation?
* Which derived indexes should be precomputed versus calculated on demand?

### UX

* How much historical evidence should Analyze initially show?
* What is the best form of a Historical Evidence Card or equivalent UI unit?
* How should continuation families and alternative directions be presented without overwhelming users?
* How should uncertainty and weak historical support be communicated?
* How should users move from an interesting historical example into deeper exploration?
* When should Analyze offer a move-oriented view versus a relationship/evidence-oriented view?

These questions should increasingly be answered by using the first vertical slice rather than by continuing an open-ended sequence of isolated research spikes.

# 19. Explicitly Out of Scope for the First Analyze Vertical Slice

The first vertical slice should **not** attempt to implement:

* the complete Analyze engine;
* a universal relevance score;
* semantic plan recognition;
* machine-learned relevance;
* AI-generated strategic explanations;
* automatic claims about the objectively correct plan;
* the complete Opening Explorer;
* full collaboration around historical evidence;
* every relaxed-similarity mechanism investigated during research;
* production-scale optimization of every corpus/index component;
* a final Analyze UX.

The purpose of the vertical slice is to turn the validated research into a usable end-to-end product loop.

---

# 20. Development Philosophy

The project should continue to be developed experimentally.

The intended process remains:

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
Real product use
  ↓
Re-evaluation
```

We should actively look for evidence that disproves our assumptions.

A failed hypothesis is a successful outcome if it prevents us from building the wrong thing.

The research phase has now produced enough evidence to shift emphasis from isolated technical spikes toward **implementation and learning through use**.

---

# 21. Immediate Next Step

The immediate product/engineering task is the **first Analyze historical-evidence vertical slice**.

The slice should demonstrate the complete path:

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
Continuation / plan-family annotation
       ↓
Historical support
       ↓
Human-readable presentation
```

The implementation should initially answer:

> **"What historical evidence does Blunderfest currently know about this position?"**

The user should be able to inspect a historical candidate and understand, where available:

* why it was retrieved;
* what is similar;
* what is different;
* how the routes differ;
* what happened afterwards;
* whether the continuation is part of a recurring family;
* how many independent games support that pattern;
* whether the apparent evidence is only a singleton or same-game artefact.

The vertical slice should not return one universal relevance value.

After implementation, the feature should be used internally to determine which information is genuinely useful, confusing, missing, or unnecessary. Those observations should drive the next product and technical decisions.

---

## Document status

This document is intentionally **not a final specification**.

Version 0.3 incorporates the main product findings from Technical Spikes 01–06 and establishes the first Analyze historical-evidence vertical slice as the immediate implementation target.

The final Analyze UX, production-scale retrieval architecture, ranking/representative-selection behaviour, and explicit strategic interpretation remain open.

As implementation and real product use produce new information, this document should continue to evolve rather than allowing outdated assumptions to silently become requirements.

**The document should evolve with the evidence.**