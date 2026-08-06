# ADR-0008: `main` is the active branch; `main_backup` archives the old history

Status: Accepted (2026-08-06)

## Context

The repository accumulated two divergent lines of work: an old `main` (with
docs and an earlier direction) and a `restart` branch (the current product).
Keeping both live was confusing — two "main" branches, stale docs, and
ambiguous remote state. The project wanted one clearly active branch and a
safe archive of the discarded history.

## Decision

- **`main` is the single active branch** (it was renamed from `restart` via
  the GitHub API; its history — including the renamed commits — is intact).
  All work commits to `main`.
- **`main_backup` archives the old `main`** history (docs, earlier direction).
  It is not developed; it exists purely so nothing is lost.
- The old remote `restart` branch and the local `implementation` /
  `implementation_2` branches were deleted. The `architecture` branch remains
  locally as scratch. Two dependabot branches on the remote are left alone.
- `gh` CLI is installed and authenticated as the `blunderfest` account for
  repo administration.

## Consequences

- One branch to look at, one default branch on GitHub (`origin/main`).
- Anyone needing the old direction knows exactly where to find it.
- If the old history is ever truly unwanted, deleting `main_backup` is a
  one-command revert of this ADR.
