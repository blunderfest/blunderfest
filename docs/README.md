# Documentation

The documentation lives here, next to the code it describes. `PROJECT.md` at the
repo root remains the roadmap and single entry point for new sessions; this
directory holds the durable record of how and why the system is built.

## What lives here

| Path | Contents |
|---|---|
| `architecture.md` | How the system is put together: components, data flow, real-time model, frontend structure. Read this before reading code. |
| `operations.md` | Branches, deploy, local dev, verification commands. |
| `decisions/` | Architecture Decision Records (ADRs) — one file per decision, most recent first. |

## How to use the ADRs

Every significant decision gets an ADR: a short "context → decision →
consequences" record that says *why* the code is the way it is. When you change
something that contradicts an ADR, either update the ADR (it describes the
current reality) or add a new one and mark the old one superseded. See
[`decisions/README.md`](decisions/README.md) for the template and rules.

## Reading order for a new session

1. `PROJECT.md` — what the product is and where it is going.
2. `architecture.md` — how it is built today.
3. `operations.md` — how to run, test, and ship it.
4. `decisions/` — the history of *why*, in digestible chunks.
