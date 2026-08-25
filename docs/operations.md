# Operations

## Branches

- `main` — the only active branch; all work lands here (ADR-0008). GitHub
  default branch. Pushes to `main` are not auto-deployed — deploys are manual
  (see below).
- `main_backup` — archive of the old history; never developed.

## Local development

- Bootstrap once: `./execute.sh` (idempotent; Arch tooling, Postgres init,
  `flyctl`; `mix setup` and `assets` setup included).
- Agent tooling: `./setup-mcp.sh` configures opencode MCP servers
  (`opencode.json`): Playwright (browser automation, enabled) and Stitch
  (UI design fetch, disabled until Google Cloud credentials are set up).
  Requires an opencode restart to take effect.
- Backend: `mix phx.server` on `:4000`.
- Frontend dev server: from `assets/`, Vite on `:5173` with HMR, proxying
  `/api` and `/socket` to Phoenix. Prod runs the bundled SPA from Phoenix.
- Full verification before any change is done:
  - `mix precommit` (format, compile with warnings-as-errors, all ExUnit)
  - from `assets/`: `pnpm lint && pnpm typecheck && pnpm exec vitest run --pool=forks`

### Local corpus database (docker)

The corpus Postgres runs in a docker container (ADR-0026). Host networking
(no bridge support in the local docker setup) and host port `5433` (system
Postgres already owns `5432`); data lives in a bind mount on `/home` (the
docker data root `/var/lib/docker` sits on the small root partition):

```sh
mkdir -p ~/docker/blunderfest-pg
docker run -d --name blunderfest-dev-db --network host \
  -e POSTGRES_USER=blunderfest -e POSTGRES_PASSWORD=blunderfest \
  -e POSTGRES_DB=blunderfest_dev -e PGPORT=5433 \
  -v ~/docker/blunderfest-pg:/var/lib/postgresql postgres:18-alpine
docker exec blunderfest-dev-db createdb -U blunderfest -p 5433 blunderfest_test
```

Dev/test `DATABASE_URL`s:

```
postgres://blunderfest:blunderfest@localhost:5433/blunderfest_dev
postgres://blunderfest:blunderfest@localhost:5433/blunderfest_test
```

Export the dev one (or put it in your shell profile) before running
`mix phx.server`; `config/runtime.exs` picks it up.

### Loading the corpus into production

The prod load lessons (all fought the hard way, 2026-08-25):

- **Don't load on the app machines.** They auto-stop (killing the load),
  deploys recreate them (wiping the ephemeral disk), and the shared vCPU
  throttles the pawn-hash transform until the COPY connection idles out.
- **Precompute the transform locally**, then load via chunked `psql`
  COPYs through `flyctl proxy` (retryable ~50MB chunks):

```sh
flyctl proxy 15432:5432 -a blunderfest-db &   # background
mix corpus.prepare                           # data/corpus/positions-100000.tsv
split -l 600000 -d data/corpus/positions-100000.tsv /tmp/loadchunks/chunk_
# psql "$URL" -f DDL...  (see Blunderfest.Corpus.Occurrences for the DDL)
# for each chunk: psql "$URL" -c "COPY corpus_positions_stage FROM STDIN" < chunk_N
# INSERT ... DISTINCT ON → corpus_positions; COPY occurrences from the same
# chunks (cut -f1,3,4); COPY games/moves; CREATE the two indexes; ANALYZE.
```

- **The PG volume must have headroom for index builds**: building the
  6.7M-row occurrence index on a 3GB volume sent the cluster into
  emergency read-only mid-build (`cannot execute CREATE INDEX in a
  read-only transaction`, flapping until space freed). The volume is
  extended to 10GB (`flyctl volumes extend`).
- Machine-side `bin/blunderfest rpc` is for quick probes; the app's pool
  needs a few minutes after a machine start before it is reliable
  (boot-time DNS/network settling).

## Deploy

- App: `blunderfest` on Fly.io → `https://blunderfest.fly.dev` and
  `https://blunderfest.org` (PHX_HOST). `fly.toml` lives in the repo root.
- Ship it: commit → `git push origin main` → `flyctl deploy`.
- Release is built by the multi-stage `Dockerfile` (Node stage runs
  `pnpm build` → Vite out to `priv/static`; Elixir stage compiles the release
  that serves it). Docs-only changes need no deploy.
- Config: port 8080, regions `ams` + `ord`, **scale-to-zero**
  (`auto_stop_machines`, `min_machines_running = 0`) — app state is in-memory
  and rebuilt on boot, so sleeping costs nothing and loses nothing (ADR-0001).
  The corpus Fly Postgres (`blunderfest-db`) does **not** scale to zero and
  carries a small standing cost (ADR-0026).
  `SECRET_KEY_BASE`, `RELEASE_COOKIE` and `DATABASE_URL` live in **`fly
  secrets`** (rotated 2026-08-07; never commit them to `fly.toml` or the
  repo).
- A read-only demo room lives at `#/r/chess` (see `Blunderfest.DemoRoom`,
  ADR-0014) — an annotated game visitors can open straight from the home
  page. It is seeded on demand at join, not at boot, so it survives
  room-process and machine loss.

### The version banner

Open tabs learn about deploys through a **version beacon**: the Docker
build writes `priv/static/version.json` (a build timestamp) and the SPA
compares it against the value at page load — every 60s and on the
browser's `online` event. When it changes, a banner offers a reload.

- Fires **only in prod** (dev/Vite has no beacon).
- Fires **only for bundle-changing deploys**: the Docker layer cache
  re-runs the `date` step exactly when the frontend changes, so
  backend-only deploys don't trigger it (a reload would change nothing).
- The shell HTML is served with `cache-control: no-store`, so a normal
  F5 after a deploy always picks up the new bundle; the banner is for
  tabs that are *already open*.
- Dev note: `version.json` must stay in the `only:` list of
  `BlunderfestWeb.static_paths/0`, or it 404s.

## CI

GitHub Actions is **disabled** (commit `63acf25`); checks and deploys are
done locally with the verification commands above. The workflow files were
removed, not just turned off — do not assume CI catches anything.

## Change workflow

- Small, milestone-scoped commits (see `PROJECT.md`).
- Significant decisions are recorded as ADRs in `docs/decisions/` at decision
  time (see `docs/decisions/README.md`).
