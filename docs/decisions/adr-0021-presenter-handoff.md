# ADR-0021: The owner can hand presenting to another member

Status: Accepted (2026-08-15) — amends ADR-0015 (no ownership handoff)

## Context

ADR-0015 ruled out ownership *handoff* when the owner leaves: ownership stays
bound to the owner's profile, and the room simply has no presenter until they
return. That left a real gap: a coach who promotes a student to collaborator
to demo a line finds that followers keep watching the owner — a collaborator
demo'ing is invisible to the room. Presenting and owning turned out to be
different jobs: ownership is permission, presenting is the floor.

## Decision

Ownership still never transfers. But the owner may **hand the presenter mic
to any recorded member** (or take it back), via a `set_presenter` message on
the room channel and a `presenter` field in room state (nil = the owner
presents, the previous and only behavior).

Presenting still **derives from presence**: the selector is "the handed
member if they're in the room, else the owner if they're in the room". An
absent presenter yields the floor back to the owner automatically — no
fallback logic to keep in sync, exactly the property ADR-0015 relied on.

## Consequences

- A collaborator can drive the room's boards for a demo without owning the
  room; the owner reclaims with the same button.
- The demo room is untouched (it records no owner, roles, or presenter).
- ADR-0015 stands for ownership; only the "no presenting handoff" line is
  superseded — by presence-derived fallback rather than stored handoff state.
