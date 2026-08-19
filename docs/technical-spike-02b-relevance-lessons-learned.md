# What We Learned from Spike 02

## 1. The purpose of the search engine is not simply similarity

The first important conclusion is:

> **Position similarity is useful for finding candidates, but it is not sufficient for determining relevance.**

The evaluation sheet was deliberately built around a different question:

> *“Is this an interesting historical analogy for someone trying to understand the reference position?”* 

That distinction turned out to be fundamental.

A candidate can be:

* extremely similar and highly useful;
* extremely similar but only marginally useful;
* extremely similar but useful for a different question;
* less directly similar but nevertheless very interesting.

So the search engine should not ultimately be thought of as a **similar-position finder**, but as a system for finding **useful historical comparisons**.

---

# 2. Similarity is still extremely valuable

This does **not** mean that similarity is a bad approach.

In fact, the spike confirms that similarity is an excellent way of generating candidates.

B1 is the clearest example.

The historical game reaches essentially the same position, but through a different move order. That difference creates a meaningful question about the lost tempo.

Without positional similarity, we probably would not have found this comparison efficiently.

So the emerging architecture is more like:

```text
Reference position
        ↓
Candidate generation
        ↓
Potentially relevant historical games
        ↓
Contextual evaluation
        ↓
Useful historical analogies
```

rather than:

```text
Reference position
        ↓
Similarity score
        ↓
Final results
```

---

# 3. Differences between positions can be more interesting than similarities

This is one of the strongest findings.

B1 is interesting **because** the historical game differs in how the position was reached.

The difference is not noise. It is the thing that creates the question.

The same applies to B4 and F1-F4.

This suggests that a future system should not only ask:

> “How similar are these positions?”

but also:

> **“What is different, and could that difference be meaningful?”**

This is a major conceptual shift.

A mismatch is not necessarily a reason to reject a candidate.

It may be precisely why the candidate is interesting.

---

# 4. The continuation of the historical game matters

B2 demonstrated an important limitation of static position matching.

Two games can reach almost the same position through a meaningful difference, but if the subsequent play does not illuminate that difference, the historical game may not be particularly useful.

Conversely, B4 becomes interesting because the continuation exposes a strategic idea and creates useful follow-up questions.

Therefore:

> **The historical game cannot always be treated as a single matching position.**

The moves before and after the position are potentially part of the evidence.

This is probably one of the most important things the next technical experiments should investigate.

---

# 5. Relevance is query-dependent

B3 provided a particularly useful negative example.

The position was highly similar, but the plan being investigated was different.

The game itself was interesting, but it was not particularly useful for the question we were asking about B1/B2.

This means that:

> **“Interesting chess game” and “relevant historical analogy” are not the same thing.**

A future system may therefore need to understand something about the **investigative context**, rather than only the board position.

We should not jump to a solution for this yet, but the distinction is important.

---

# 6. A historical game can be valuable because it raises a question

B4 gave us another important insight.

A useful historical game does not necessarily need to provide a definitive answer.

It can instead expose a question such as:

> *Does this plan work in other games?*

or:

> *Under what circumstances does this plan succeed?*

This means that informational value can take several forms:

* demonstrating a consequence;
* showing an alternative;
* providing a counterexample;
* showing a successful plan;
* showing a failed plan;
* exposing a tempo issue;
* raising a useful follow-up question.

We should **not turn these into a fixed taxonomy yet**, but they are useful hypotheses for future experiments.

---

# 7. Chess features need context

A1 versus B1-E1 exposed another fundamental problem.

Something as abstract as:

> **piece activity**

can occur in completely different chess contexts.

In the opening, activity can be about:

* controlling important squares;
* developing pieces;
* establishing a plan;
* controlling the centre;
* preparing king safety.

In the endgame, activity can instead be about:

* activating the king;
* creating pawn breakthroughs;
* promoting pawns;
* restricting the opposing king.

Therefore:

> **A shared feature does not necessarily imply a shared chess function.**

This suggests that future retrieval experiments should consider **game phase and move context**, rather than treating individual board features as context-free signals.

---

# 8. The meaning of a feature may be more important than the feature itself

This is a deeper consequence of the previous observation.

Consider:

> `piece activity = high`

That description is technically correct but strategically weak.

What matters is potentially:

> **What is the activity trying to achieve?**

That might be:

* attack;
* defence;
* preparation;
* restriction;
* promotion;
* tactical exploitation.

This points toward a future concept of **strategic function**, but we should be careful.

We do **not** yet know whether strategic plans can be reliably detected automatically.

So this should currently be treated as a research hypothesis, not as an implementation requirement.

---

# 9. Player strength is evidence, not relevance

F1-F4 gave us an interesting example.

The players were not particularly strong, which reduces our confidence in the strategic conclusions we can draw from the game.

But that does not make the game automatically irrelevant.

A weaker game can still reveal:

* an unusual idea;
* an interesting deviation;
* a practical possibility;
* a useful counterexample.

Therefore:

> **Player strength should probably affect the evidential weight of a candidate, but should not automatically determine relevance.**

This distinction will be important if we eventually combine master games with the much larger database of games from all players.

---

# 10. We should preserve negative examples

The failure cases may actually be more valuable than the obvious successes.

Examples include:

### B2

Very similar, but not sufficiently informative.

### B3

Very similar, but addressing a different plan.

### A1/B1-E1

Shared abstract characteristics, but completely different chess function.

These demonstrate things a future ranking system must **avoid**.

A good future experiment should therefore not only ask:

> “Can we find good candidates?”

but also:

> **“Can we distinguish good candidates from these specific failure cases?”**

---

# 11. What the current system already gives us

The spike has given us a useful candidate-generation and inspection framework.

The evaluation sheet exposes, among other things:

* the reference position;
* candidate FEN;
* retrieval strategy;
* pawn mismatch;
* material;
* piece matching;
* king distance;
* side to move;
* castling;
* previous and next moves;
* player information;
* game result;
* links to the full game and analysis. 

This is important because it means we can now investigate **which additional information actually matters**, rather than designing the entire system theoretically.

---

# 12. What we should *not* conclude yet

We should **not** conclude that we already know how to calculate relevance.

In particular, we should not yet create something like:

```text
relevance =
    position_similarity
  + move_order_similarity
  + plan_similarity
  + player_strength
  + ...
```

We don't have enough evidence for that.

Likewise, we should not assume that:

* higher similarity is always better;
* stronger players are always better evidence;
* similar plans are always more useful;
* different plans are always more useful;
* engine evaluation determines relevance.

The current evidence is qualitative and exploratory.

---

# 13. The emerging model

I think the most useful conceptual model coming out of Spike 02 is currently:

```text
                  Reference position
                          │
                          ▼
                 Candidate generation
                          │
              ┌───────────┴───────────┐
              │                       │
        Position similarity      Interesting differences
              │                       │
              └───────────┬───────────┘
                          ▼
                   Historical context
                   /              \
              preceding          continuation
                moves               moves
                   \              /
                    ──────┬──────
                          ▼
                  Informational value
                          │
                          ▼
                   Query relevance
```

This is **not an architecture yet**.

It is a hypothesis about where the useful information may come from.

---

# 14. The most important conclusion

If I had to reduce the entire spike to one sentence, it would be:

> **Blunderfest should not search for games that are merely similar to the user's position; it should search for historical evidence that helps the user understand what is happening in that position.**

And that fits extremely well with the direction we have been developing throughout the project.

The search engine does not need to be an oracle.

It needs to be a **strong spectator**:

> *“Here are some historical games that might help you investigate this idea.”*

---

## What I think we should do next

I would **not start building the relevance engine yet**.

Instead, I think Spike 03 should take **one or two of the strongest hypotheses** from this exercise and test whether they can actually be detected from chess-game data.

My first candidates would be:

1. **Move-order / continuation analysis**
   Can we identify cases where essentially the same position was reached through different sequences, and determine whether the subsequent play provides useful contrast?

2. **Plan/continuation similarity**
   Without attempting full AI plan recognition, can we derive useful information from the moves immediately before and after the matched position?

Those are concrete enough to experiment with, while directly addressing the weaknesses exposed by B1–B4.

And importantly: **we can keep this small.** We don't need to solve "chess relevance" in Spike 03. We need to find out whether these two pieces of information actually improve our ability to distinguish something like B1 from B2/B3.

That feels like the right next step without falling into analysis paralysis.
