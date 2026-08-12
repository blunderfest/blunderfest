Zeker. Ik zou hem juist een opdracht geven die **onderzoekend maar concreet** is. Niet: *"zoek uit welke database we moeten gebruiken"*, want dan is de kans groot dat hij eindigt met een vergelijkingstabel zonder dat we echt iets geleerd hebben.

Ik zou hem ongeveer dit geven:

---

# Technical Spike: Position Retrieval

### Context

We are building a collaborative chess analysis application.

The application will eventually contain a large chess corpus, potentially **millions of games and hundreds of millions of game positions**.

The core Analyze functionality needs to retrieve positions efficiently. Exact position matching is only the first use case; eventually we want to support increasingly flexible forms of similarity.

For now, **do not design or implement the complete search engine**.

We want to investigate the technical foundation first.

---

## Goal

Determine whether we can build a scalable position-retrieval system and identify the most promising storage/indexing approach.

The investigation should answer:

1. How should we represent a chess position for efficient retrieval?
2. How much storage does the resulting position corpus require?
3. How fast can we retrieve exact positions?
4. How does performance scale as the corpus grows?
5. Which database/indexing technology is a good candidate for this workload?
6. What technical problems are likely to appear when we move from exact matching to more flexible similarity searches?

---

## Phase 1 — Exact position retrieval

Start with a relatively small corpus.

For every position occurring in every game, store at least:

```text
PositionKey
GameId
Ply
```

The position key should represent the actual chess position, not the FEN's move counters.

Investigate what should be part of the key:

* piece placement
* side to move
* castling rights
* en passant state

Please document the reasoning, especially around en passant.

Then implement:

```text
FEN → PositionKey → all occurrences
```

The result should allow us to answer:

> "Which games reached exactly this position, and after which move?"

---

## Phase 2 — Benchmark

Test progressively larger datasets, for example:

```text
100k games
1M games
10M games (if practical)
```

We don't necessarily need to reach 10M. If the approach clearly stops scaling before that, **that itself is a useful result**.

Measure at least:

* import time;
* number of positions;
* storage size;
* index size;
* lookup latency;
* lookup latency distribution (p50/p95/p99);
* memory usage;
* CPU usage where relevant.

Please record the hardware/environment used for the benchmarks.

---

## Phase 3 — Database/index investigation

Do **not** assume PostgreSQL is the answer.

Start with PostgreSQL as the baseline because it integrates naturally with our Elixir/Phoenix application, but investigate whether another approach would be significantly better for this workload.

The important question is not:

> "Which database is generally best?"

It is:

> **"Which approach is best suited to retrieving hundreds of millions of chess positions using increasingly flexible matching criteria?"**

If PostgreSQL performs well enough, that's a perfectly good outcome.

If it doesn't, we want to understand **why** before considering alternatives.

---

## Phase 4 — Prepare for future similarity

Don't implement the similarity engine yet.

Instead, investigate whether the chosen representation could support future queries such as:

### Exact

> Same position.

### Color reversed

> Same position with White and Black exchanged.

### Structural

> Same/similar pawn structure.

### Relaxed

> Similar position, but allowing some differences in pieces/pawns.

### Contextual

> Similar position **and similar preceding/following game context**.

For each, answer:

> Can the proposed representation/index support this efficiently, or would it require a fundamentally different retrieval mechanism?

---

## Deliverables

I don't want a production-ready search engine from this spike.

I want:

### 1. Short technical report

Containing:

* findings;
* assumptions;
* benchmark results;
* promising approaches;
* problems encountered;
* recommendation;
* things we should investigate next.

### 2. Reproducible benchmark

Ideally something like:

```text
mix benchmark.position_retrieval
```

or an equivalent command that another developer can run.

### 3. Minimal prototype

Something capable of:

```text
FEN
 ↓
PositionKey
 ↓
lookup
 ↓
occurrences
```

It does **not** need to be integrated into the existing UI yet.

### 4. Recommendation

At the end, answer:

> **"If we were to implement Analyze tomorrow, what storage/indexing approach would you choose, and why?"**

---

## Constraints

A few deliberate constraints:

**Don't optimize prematurely.**

A simple implementation that gives us good benchmark data is more valuable than a highly optimized implementation whose behaviour we don't understand.

**Don't build the similarity engine yet.**

We are still testing our assumptions about what similarity should mean.

**Don't make the database decision irreversible.**

This is a technical spike, not an architectural commitment.

**Document surprises.**

If something behaves very differently from what you expected, that's particularly valuable.

---

### One extra thing I'd tell him

I'd give him explicit permission to **prove us wrong**.

Something like:

> *The goal of this spike is not to validate our current ideas. If you discover that one of our assumptions is wrong, that is a successful outcome.*

That fits very well with how we've been approaching the project.

And I would **not give him a prescribed database shortlist beyond PostgreSQL as the baseline**. If he enjoys this sort of investigation, let him discover whether something like a columnar store, embedded analytical database, specialized index, or even a surprisingly simple PostgreSQL design makes sense.

Then when he comes back with the results, **we can use those results to make the first real architectural decision** rather than making it now based on intuition.
