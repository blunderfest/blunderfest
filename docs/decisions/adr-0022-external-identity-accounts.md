# ADR-0022: External identity accounts (Lichess OAuth), anonymous-first

Status: Accepted (2026-08-16) — extends ADR-0004 (anonymous-first profiles), ADR-0001 (in-memory state)

## Context

Profiles have always been anonymous device-bound identities: a fun name and
a device secret, salted hashes server-side (ADR-0004). That covers
single-device use perfectly, but identity dies with the device — there is
no way back onto "your" profile from a new browser, and no way to pull a
user's own data (studies, games) from Lichess.

Lichess offers OAuth2 with PKCE — including **public clients** (no client
secret), which matches our no-PII posture: users prove ownership of a
Lichess account; we learn nothing but their username.

The identity model we adopt follows Better Auth's **User 1..n Account**:
one profile, several account types attached (device secrets now, lichess
links; magic links or other providers later).

## Decision

- **Profiles stay the display identity, and fun names are temporary.** A
  linked account is a *data source and a binding, never a persona* — the
  fun name is what everyone sees; the link is visible only to the owner
  in their account menu.
- **One action: "Sign in with Lichess."** The callback decides: an
  account already bound adopts the known profile for this session (the
  name follows the binding — signing in from a second browser makes you
  the same identity there), a new account binds to the current profile
  (the current name stays). There is deliberately no separate
  link-vs-recover concept: the user's model is "sign in / sign out".
- **"Sign out" detaches** the account (and its token, revoked at
  lichess best-effort). After sign-out the binding — the "known as"
  mapping — is gone; signing in again from a fresh session binds that
  session's name.
- **Profiles hold `accounts`** (`%{type, username, token, scopes,
  linked_at}`) and **one secret hash per device** (`secret_hashes`) — a
  session adopting a profile adds a hash, so other sessions keep working.
- **OAuth2 + PKCE, unregistered public client** — lichess accepts any
  unique client id (shown on the consent screen), no app registration and
  no secret (see their API spec's Authentication section). Scope:
  `study:read` (games endpoints are public — there is no `game:read`
  scope). Flow: SPA `POST
  /api/auth/lichess/start` (bearer required — the secret never goes into
  a redirect URL) → lichess → `GET /auth/lichess/callback` → token
  exchange + `/api/account` → bind to the current profile, or adopt the
  bound profile via a **single-use, 5-minute exchange code** the SPA
  trades for fresh device credentials.
- **Stored per account**: the lichess username (a public handle) and the
  access token (a server-side credential — it can't be hashed, we must
  call the API with it; it never leaves the server). No email, no real
  name. The token is never serialized to clients.
- **In-memory for now** (ADR-0001): a redeploy wipes linkage and secrets,
  users re-link — the same degradation profile as profiles themselves.
  The persistence spike makes accounts durable later; this ADR expects
  that follow-up.

## Consequences

- One identity follows the binding across browsers without accounts-as-
  personas, and the binding disappears on sign-out.
- Study imports ride the same token; game imports stay on the public
  games endpoints, which the token also authenticates (per-user rate
  limits instead of per-IP).
- `LichessAuth` (flow state, exchange codes) is deliberately ephemeral —
  nothing in it should ever want durability.
