# ADR-0030: Historical examples are browsed privately — only picks are shared

Status: Accepted (2026-08-27); presentation amended 2026-08-30 (carousel →
list + detail, the "relevant games finder")

## Context

The Examples tab ran a corpus query per position and, since one session's
sync work, shared that analysis *request* transiently: a button press
broadcast `evidence_run`, and every member whose cursor sat on that
position auto-ran the same query so "one member's examples become
everyone's" (a channel broadcast, never an op, so replays would not
re-run corpus queries). In practice this meant the whole candidate list —
the browsing itself — was room-shared, which was the wrong unit: members
care about the games someone decides to bring into the room, not about
every candidate someone is still browsing. The tab also forced a
sidebar-shaped layout on a browsing experience.

## Decision

- **Browsing is private.** "Find examples" (now a button in the board
  header, next to Export PGN / Save to library — the Examples tab is
  gone) opens a modal over the candidates for the cursor's position. The
  corpus query runs on open for the opener only — no channel traffic.
  (Presentation amended 2026-08-30: the original one-slide-at-a-time
  carousel became a list + detail layout — see below.)
- **Only picks are shared.** Picking means the existing ops: "Add to
  room" (`set_game` with `evidence_gid` + `openAtPly` + fingerprint
  dedupe) and "Add as variation" (`set_position`/`add_line`). Everyone
  sees the picked games via the op log, as before.
- **Picks never change the selection.** The button flips to "Added ✓"
  (echo-proven) and the user browses on — a candidate can be added as a
  game *and* as a variation without navigating away. Esc/backdrop close
  the dialog; finished analyses stay in the session cache, so reopening
  the dialog for the same position never re-runs the query.
- The `evidence_run` channel push, its broadcast, and the Redux
  `evidenceRun` state are removed.

## Consequences

- Viewers no longer see a shared candidate list (there is none) — the
  only historical-evidence content they see is games an editor picked,
  which arrive as ordinary ops. Editors-only, as the analysis already
  is; the button is hidden for viewers.
- The room channel, store, and `Analysis`/`AnalysisSidebar` drop one
  transient broadcast path — replays, sync and tests get simpler.
- The per-position session cache (`evidenceCache.ts`) is kept; a future
  in-game move browser inside the dialog (fetched PGN playback) is noted
  as a follow-up, not part of this change.
