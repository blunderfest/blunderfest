# ADR-0004: Anonymous-first profiles with device secrets, no stored PII

Status: Accepted (2026-08-04)

## Context

The product must be usable with zero friction — no account, no email, no
signup wall. At the same time, per-member identity is needed for room roles,
presence, and (later) a game library. Identity must not mean collecting
personal data.

## Decision

- Every visitor automatically gets a **profile**: a server-generated fun name
  (curated wordlists, no user input → no moderation needed) plus a random
  **device secret** held in `localStorage` under `blunderfest.device`.
- The server stores only a **salted hash** of the secret, never the secret
  itself. API calls authenticate with `Authorization: Bearer <secret>`
  (`Profiles.authenticate/2`).
- No email addresses, names, or other PII are ever stored. Future sign-in
  (magic links / external providers) will link profiles via keyed hashes of
  identifiers, never the identifiers themselves.
- Profiles are entirely optional for using the product — they are a convenience
  layer for cross-device identity and the future game library.

## Consequences

- Zero-friction onboarding: the first page load creates the profile in the
  background.
- A leaked secret hash is useless to an attacker; a lost device means a new
  anonymous identity (nothing personal is lost).
- Server-enforced roles depend on the bearer secret being kept client-side;
  there is no server-side session to steal.
- Since ADR-0029 profiles are durable (Ecto-backed, one per device secret
  cluster-wide): a deploy no longer re-rolls an identity — roles, account
  links, and the library follow the device.
