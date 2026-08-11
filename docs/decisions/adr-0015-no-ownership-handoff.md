# ADR-0015: No ownership handoff when the owner leaves

Status: Accepted (2026-08-11)

## Context

Room ownership is a role recorded against the owner's profile id. When the
owner closes the room, the role stays behind: the room has no presenter, and
the question arises whether ownership (or at least presenting) should move
to another member. This came up while designing the read-only demo room
(ADR-0014) — the demo suffered from exactly this "absent owner" state until
it was made ownerless.

## Decision

No handoff. Ownership stays bound to the owner's profile — which persists
across reconnects via the device secret (ADR-0004) — and the room keeps
working while the owner is away:

- collaborators keep their edit rights;
- viewers can navigate and analyze freely (following simply pauses while
  there is no presenter);
- the owner resumes their role the moment they return, on any machine, since
  their profile id is stable.

## Consequences

- A room whose owner never returns stays owner-locked for viewers (they can
  watch but not edit). Rooms are ephemeral by design (ADR-0001) — state is
  lost on restart anyway — so permanently abandoned rooms don't accumulate
  meaning; anyone can create a fresh room and re-import the game.
- Presenting is derived from presence, so it resumes automatically when the
  owner reconnects; no "presenting handoff" logic exists to keep in sync.
- If real usage shows abandoned rooms are a problem, the fix is ownership
  transfer or room expiry, not a standing rule we maintain now.
