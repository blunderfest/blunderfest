# ADR-0002: Backend serves a JSON API + channel sockets and a bundled SPA; no server-rendered UI

Status: Accepted (2026-08-04)

## Context

The project wants a rich, collaborative chess analysis board — dragging pieces,
arrows, live cursors — which is far more natural in a client-side framework
than in server-rendered markup. The team also wants a single deployable
artifact rather than two applications (API + static hosting).

## Decision

The Phoenix backend contains no UI:

- No LiveView, no HTML views, no server-rendered markup.
- It exposes a plain JSON API (`/api/*`), the channel socket at `/socket`, and
  a catch-all route that hands non-API requests to the compiled React bundle
  (a static `index.html` shell + hashed assets in `priv/static`).
- The frontend is **React 19 + Vite + TypeScript** living in `assets/`, built by
  Vite into `priv/static` and served by Phoenix — one origin, one app.

## Consequences

- A single Phoenix release serves the entire product; deploy is one artifact.
- All UI decisions happen in the React codebase; the backend stays a pure
  API, testable with plain HTTP/channel tests.
- The API contract is the only interface between the two halves — it must
  stay machine-readable and stable (see ADR-0003).
- There is no server-side rendering or SEO for the SPA (acceptable for a
  collaborative tool).
