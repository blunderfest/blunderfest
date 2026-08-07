# Operations

## Branches

- `main` — the only active branch; all work lands here (ADR-0008). GitHub
  default branch. Pushes to `main` are not auto-deployed — deploys are manual
  (see below).
- `main_backup` — archive of the old history; never developed.
- `architecture` — local scratch branch.

## Local development

- Bootstrap once: `./execute.sh` (idempotent; Arch tooling, Postgres init,
  `flyctl`; `mix setup` and `assets` setup included).
- Backend: `mix phx.server` on `:4000`.
- Frontend dev server: from `assets/`, Vite on `:5173` with HMR, proxying
  `/api` and `/socket` to Phoenix. Prod runs the bundled SPA from Phoenix.
- Full verification before any change is done:
  - `mix precommit` (format, compile with warnings-as-errors, all ExUnit)
  - from `assets/`: `pnpm lint && pnpm typecheck && pnpm exec vitest run --pool=forks`

## Deploy

- App: `blunderfest` on Fly.io → `https://blunderfest.fly.dev` and
  `https://blunderfest.org` (PHX_HOST). `fly.toml` lives in the repo root.
- Ship it: commit → `git push origin main` → `flyctl deploy`.
- Release is built by the multi-stage `Dockerfile` (Node stage runs
  `pnpm build` → Vite out to `priv/static`; Elixir stage compiles the release
  that serves it). Docs-only changes need no deploy.
- Config: port 8080, regions `ams` + `ord`, **scale-to-zero**
  (`auto_stop_machines`, `min_machines_running = 0`) — state is in-memory and
  rebuilt on boot, so sleeping costs nothing and loses nothing (ADR-0001).
  `SECRET_KEY_BASE` and `RELEASE_COOKIE` live in **`fly secrets`** (rotated
  2026-08-07; never commit them to `fly.toml` or the repo).
- A demo room is seeded on every boot at `#/r/chess` (see
  `Blunderfest.DemoRoom`) — an annotated game visitors can open straight from
  the home page.

## CI

GitHub Actions is **disabled** (commit `63acf25`); checks and deploys are
done locally with the verification commands above. The workflow files were
removed, not just turned off — do not assume CI catches anything.

## Change workflow

- Small, milestone-scoped commits (see `PROJECT.md`).
- Significant decisions are recorded as ADRs in `docs/decisions/` at decision
  time (see `docs/decisions/README.md`).
