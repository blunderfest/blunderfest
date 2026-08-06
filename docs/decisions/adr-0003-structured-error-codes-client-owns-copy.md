# ADR-0003: The API returns structured error codes; the client owns all copy

Status: Accepted (2026-08-04)

## Context

The frontend is i18n-aware from day one (`react-i18next`, English as the
source-of-truth locale, more locales planned). If the server returned prose
error messages, every message would need translation server-side and the
client could not rephrase or localize failures.

## Decision

- **The server never returns prose.** JSON errors are structured:
  `{"errors": {"code": "invalid_code"}}` — machine-readable codes, nothing
  human-readable.
- **The client owns all user-facing strings**, keyed in `assets/src/i18n/locales/en.json`.
  Errors from the API are mapped to copy by the client (`ApiError.code` in
  `assets/src/lib/api.ts` → i18n key).
- Chess content (SAN, FEN, PGN) is language-neutral and travels as data;
  user-authored content (comments, line names) is stored raw.
- No server-side gettext.

## Consequences

- Adding a locale requires zero backend work.
- The error-code vocabulary is part of the API contract: adding a code is an
  API change, and the client should handle unknown codes gracefully (it falls
  back to a generic message).
- Client tests can assert on codes; copy changes never touch the backend.
