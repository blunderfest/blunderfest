# ADR-0007: Room codes are 5 chars from an unambiguous alphabet, validated on both ends

Status: Accepted (2026-08-06)

## Context

Room codes are typed by humans (often from a chat message or a phone screen)
and appear in URLs. Ambiguous characters (i/l/o/0/1), long codes, and codes
with mixed case all cause join failures that are hard to debug. Codes must
also be cheap to validate before any state work happens.

## Decision

- Codes are **exactly 5 characters** from the unambiguous alphabet
  `abcdefghjkmnpqrstuvwxyz23456789` (no `i`, `l`, `o`, `0`, `1`).
- Validation exists on **both ends**, and both ends use the same rules:
  - server: `Rooms.valid_code?/1` in `Blunderfest.Rooms`
  - client: `validRoomCode` in `assets/src/lib/roomCode.ts`, plus a strict
    hash-regex in `App.readHashRoute` (`^#\/r\/[a-z0-9]{5}$` per the alphabet)
    so malformed deep links fall back to the home screen instead of erroring
    inside the room view.
- The channel rejects malformed topics with `{:error, %{reason: :invalid_code}}`.
- The client normalizes input (lowercase, strips `_`, `-`, spaces) before
  joining; `POST /api/rooms` validates before creating.

## Consequences

- Typing a code over voice chat or from a photo is reliable; no case-sensitivity
  surprises.
- Invalid codes fail fast on both ends — the server never sees junk topics and
  the client never navigates to a nonsense room.
- 30⁵ ≈ 24M codes; tiny collision risk at this scale, which is acceptable
  (rooms are ephemeral, see ADR-0001).
- The alphabet and length are load-bearing: shortening or extending codes
  touches the server validator, the client validator, the hash regex, and the
  test fixtures together.
