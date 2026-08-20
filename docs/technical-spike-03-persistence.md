Zeker. Ik zou deze spike bewust **niet** formuleren als "kies een database", maar als een onderzoek naar de persistence boundary van Blunderfest. Daarmee voorkomen we dat de developer te vroeg een technologie kiest zonder eerst te begrijpen welke data we eigenlijk moeten opslaan.

Je kunt dit rechtstreeks doorsturen:

---

# Spike 03 — Persistence Architecture

**Status:** Technical spike
**Goal:** Determine the persistence architecture and database strategy for Blunderfest.

## 1. Context

The frontend is now sufficiently developed that we need to make concrete decisions about persistence.

We have deliberately postponed database decisions while exploring the search/analysis concept.

The current backend stack is:

* **Elixir**
* **Phoenix**
* Phoenix Channels
* API controllers

The frontend is:

* **React 19**
* **Redux**

Deployment target:

* **Fly.io**

The chess search/analysis engine is still under development conceptually. Spike 02 showed that our future search system will likely require more than simple position similarity, but we do **not** want the persistence decision to depend on having already solved the relevance problem.

The purpose of this spike is therefore to determine a persistence architecture that supports the current application while leaving enough flexibility for the future chess search engine.

---

# 2. Main question

Answer:

> **What persistence architecture should Blunderfest use at this stage, and why?**

This is broader than:

> "Which database should we use?"

We need to understand:

* what data we need to persist;
* what data should be derived;
* what data should be indexed;
* what data may become very large;
* what access patterns we expect;
* which parts of the system need transactional persistence;
* which parts may eventually require specialized search/indexing.

---

# 3. Important constraint

Do **not** design the final search engine in this spike.

Do **not** assume that the current retrieval experiments represent the final search architecture.

The persistence architecture should allow us to evolve the search engine without requiring a major rewrite of the application.

In particular, investigate whether we should separate:

> **application persistence**

from:

> **chess corpus / search indexing**

even if the initial implementation uses the same database technology.

---

# 4. Identify the data we need

Start by categorizing the data Blunderfest currently has or is expected to have.

At minimum investigate:

## 4.1 Chess games

Potential data:

* game identity;
* PGN;
* players;
* ratings;
* date;
* event;
* result;
* opening information;
* source/database;
* moves;
* metadata.

Determine whether the original PGN should be treated as the canonical representation.

---

## 4.2 Positions

Investigate what we actually need to persist for positions.

Potential representations include:

* FEN;
* normalized/canonical position representation;
* side to move;
* castling rights;
* en-passant state;
* material;
* pawn structure;
* piece placement;
* derived fingerprints.

Important question:

> **Should positions themselves be stored as first-class persistent entities, or should they primarily be derived from games and indexed for search?**

Do not assume the answer.

---

## 4.3 Position occurrences

A position may occur in many games.

Investigate the relationship between:

```text
Game
  ↓
Move
  ↓
Position
```

and whether we need to efficiently answer questions such as:

> "Which games reached this position?"

and eventually:

> "Which games reached a position sufficiently related to this position?"

Estimate the implications when the corpus contains **millions of games and potentially tens/hundreds of millions of positions**.

We are interested in realistic order-of-magnitude considerations, not false precision.

---

# 5. Application data

Separately identify data belonging to the application itself.

Potential examples:

* users;
* saved games;
* saved positions;
* analysis sessions;
* user-created annotations;
* comments;
* search/analyze history;
* preferences;
* future collaborative features.

Do not invent requirements that are not currently supported by the project.

Instead, distinguish:

**Known requirement**

from:

**Likely future requirement**

from:

**Speculation.**

---

# 6. Derived data vs canonical data

This is an important part of the spike.

For every significant piece of chess data, determine whether it should be:

### Canonical

Data that must be persisted as the source of truth.

### Derived

Data that can be reconstructed from canonical data.

### Indexed

Data maintained specifically to make queries/search fast.

For example, investigate whether:

```text
PGN
  ↓
moves
  ↓
positions
  ↓
position indexes
```

is a better model than treating every representation as independent canonical data.

The goal is to avoid unnecessary duplication while still supporting the performance requirements.

---

# 7. Expected access patterns

Identify the queries we expect the system to perform.

At minimum consider:

### Exact position

> Find games that reached this exact position.

### Position with controlled differences

Examples from Spike 02:

* same pawn structure;
* material differences;
* piece differences;
* different move order;
* equivalent or normalized positions.

### Historical context

> Find games before/after a particular position.

### Game retrieval

> Retrieve the complete game containing a relevant position.

### User/application queries

Examples:

* load saved analysis;
* load a game;
* load an analysis session.

For each query, consider:

* expected frequency;
* expected result size;
* latency sensitivity;
* whether it requires an index;
* whether it belongs in the primary database or a specialized search layer.

---

# 8. Database candidates

Evaluate realistic options.

At minimum, investigate:

### PostgreSQL

Consider:

* relational modelling;
* indexing;
* JSON/JSONB where appropriate;
* scale;
* transactions;
* extensions;
* Elixir ecosystem;
* Fly.io deployment;
* suitability for chess data.

### Other relevant options

Investigate alternatives only where there is a concrete reason to do so.

Examples might include:

* specialized search/index technologies;
* embedded databases;
* column-oriented stores;
* key-value stores;
* graph databases.

Do **not** create a large database comparison matrix just for completeness.

The question is:

> **Does an alternative provide a meaningful advantage for our actual access patterns?**

---

# 9. PostgreSQL + specialized search/index

Explicitly investigate the possibility that we do **not** need one database to solve every problem.

For example:

```text
                    ┌───────────────┐
                    │   Phoenix     │
                    └───────┬───────┘
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
          Application DB          Chess corpus/index
                 │                     │
                 └──────────┬──────────┘
                            │
                            ▼
                     Search results
```

Determine whether this is:

* unnecessary complexity;
* useful from the beginning;
* or something we should explicitly design for but postpone.

We strongly prefer avoiding premature distributed architecture.

---

# 10. Scale and performance

We know the search system is intended to work with **millions of positions/games** and should remain performant under load.

Investigate:

* approximate data volume;
* storage requirements;
* index size;
* write/import performance;
* read/query performance;
* concurrent users;
* backup/restore implications;
* rebuild time for derived indexes.

Use realistic estimates and state assumptions clearly.

We do not need production-scale benchmarking yet.

---

# 11. Importing the chess corpus

The chess corpus will likely be imported in bulk rather than created through normal application requests.

Investigate:

* how games should be imported;
* whether imports should be idempotent;
* how duplicates are handled;
* transaction boundaries;
* how positions are generated;
* whether derived indexes should be generated during import or asynchronously;
* how failed imports can resume;
* how the corpus can be re-indexed later.

This is important because the corpus may become much larger than the application data.

---

# 12. Search/index rebuildability

One principle should be explicitly investigated:

> **Can expensive derived/search data be deleted and rebuilt from canonical data?**

For example, if we later discover that our position indexing strategy is wrong, we should ideally be able to:

```text
canonical chess data
        ↓
new indexing strategy
        ↓
new search index
```

without losing games or user data.

This is one of the main reasons not to couple the canonical data model too tightly to the current search algorithm.

---

# 13. Persistence boundary

Propose a clear boundary between:

### Domain/application data

and:

### Search infrastructure.

The result should make it possible for us to change the search/index implementation without forcing changes throughout the application.

This does **not** necessarily mean introducing abstractions everywhere.

Avoid speculative abstraction.

The goal is a clean boundary, not an abstraction framework.

---

# 14. Elixir/Phoenix considerations

Evaluate the practical implications for our chosen stack.

Consider:

* Ecto;
* migrations;
* connection pooling;
* bulk imports;
* transactions;
* background jobs/processes;
* Phoenix Channels;
* testing;
* local development;
* Fly.io deployment.

We want the recommendation to be practical for an Elixir/Phoenix application rather than a generic database recommendation.

---

# 15. What we explicitly do NOT need yet

Do not solve:

* final search-ranking algorithm;
* final relevance algorithm;
* full-text search unless there is a demonstrated requirement;
* distributed database architecture;
* sharding;
* multi-region persistence;
* massive-scale production infrastructure.

If one of these becomes relevant later, identify the trigger that would make it necessary.

---

# 16. Deliverable

Produce a concise technical report containing:

## 1. Data model

Describe the major persistent entities and their relationships.

A diagram would be useful.

## 2. Canonical vs derived vs indexed data

Clearly identify which is which.

## 3. Access patterns

List the important queries and their expected characteristics.

## 4. Scale assumptions

Give realistic order-of-magnitude estimates and explain the assumptions.

## 5. Database evaluation

Evaluate PostgreSQL and any genuinely relevant alternatives.

## 6. Recommended architecture

Give one concrete recommendation.

Include a simple architecture diagram.

## 7. Search/index boundary

Explain how the future search engine can evolve independently from the canonical persistence layer.

## 8. Import strategy

Describe how a large chess corpus would be imported and indexed.

## 9. Rebuild strategy

Explain how derived/search data can be regenerated.

## 10. Open questions

List anything that should deliberately remain undecided.

## 11. Next step

Recommend the smallest implementation step that should follow this spike.

---

# 17. Decision criteria

The recommendation should prioritize:

1. **Simplicity**
2. **Fit with Elixir/Phoenix**
3. **Correctness**
4. **Ability to handle our expected scale**
5. **Query performance**
6. **Operational simplicity**
7. **Ability to evolve the search engine**

Do not optimize for hypothetical billion-position scale before we need it.

---

# Guiding principle

We want to make the persistence decision **now**, because the application is reaching the point where it needs persistence.

But we do not want to make a decision that assumes we already know what the final chess search engine looks like.

The desired outcome is therefore:

> **A simple, concrete persistence architecture for the application, with a clean path toward a potentially specialized chess search/index layer later.**

And, as with the previous spikes:

> **Challenge the assumptions. If the evidence suggests that one of these assumptions is wrong, say so explicitly.**
