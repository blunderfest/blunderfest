# ADR-0023: Chat is for collaborators; the owner moderates by deletion

Status: Accepted (2026-08-17)

## Context

Room chat launched as open to every joined member, viewers included. Open
posting on public, link-shared rooms invites drive-by abuse, and the app has
no reporting/blocking machinery — moderation would fall on whoever runs the
server. The risk is cheapest to manage by shrinking who can post, not by
building moderation tooling.

## Decision

- **Posting chat needs edit rights**: owners and collaborators chat, viewers
  (and anonymous members, who can hold no role) read along. The room process
  enforces it in `submit_op` alongside the edit-op check, so demotion takes
  effect immediately and atomically.
- **The owner can delete a chat message** — a `delete_chat` op naming the
  message's seq. The original `chat` op stays in the log (append-only,
  ADR-0005); deletion is a filter every client applies, so replay hides the
  message too. `delete_chat` is owner-only and must name the seq of an
  actual chat op.

## Consequences

- No moderation queue, no reports: the collaborator gate keeps chat to
  people the owner explicitly promoted; the delete op covers the rest.
- Viewer clients render the history but no input, with a one-line hint.
- The op log grows with deletions as with everything else (bounded by the
  per-room op cap); the log remains the single source of truth — there is
  no second "moderated" view of history to keep in sync.
