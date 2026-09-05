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

### Packed occurrence backend (Spike 08 + broadcast validation)

The occurrence layer can be served from the packed binary index instead of
the Postgres occurrence tables. Games/moves/metadata stay in Postgres.

```sh
# Build from the extraction artifacts (artifact-aligned, external sort):
mix corpus.pack --data-dir data/corpus-broadcast --tier 1174661 \
  --out data/corpus-packed-broadcast

# Format v2 repack (Spike 09 Phase 2, ADR-0038): pos headers carry the
# pack-time run statistics; builds into a NEW dir, v1 stays the rollback:
mix corpus.pack --data-dir data/corpus-broadcast --tier 1174661 \
  --out data/corpus-packed-broadcast-v2 --format-version 2

# Validate (manifest, sizes, counts, checksums; on v2 dirs also the
# sampled re-verification of the stored run statistics against occ.bin):
mix corpus.validate --packed-dir data/corpus-packed-broadcast

# Serve the packed backend (games/moves still come from the PG tables):
PACKED_CORPUS=1 PACKED_DIR=data/corpus-packed-broadcast mix phx.server
```

The book aggregate (`/api/book`) is precomputed into `book.bin` at pack
time — the packed-mode `:book` route never fans out per-occurrence. In
PG coexistence mode (the current default) the SQL aggregate stays.

Other measurement/verification tasks: `corpus.parity` (PG oracle),
`corpus.broadcast_parity` (artifact oracle), `corpus.he_parity` (product
parity on the reference positions), `corpus.bench` (storage/stride/latency).

### Loading the corpus into production

The corpus source is the **Lichess Broadcast Database** (ADR-0036) — the
monthly `.pgn.zst` files under `https://database.lichess.org/broadcast/`
(2020-01 → present), concatenated and filtered to standard-chess games
(drop `[Variant]`≠Standard and any `[SetUp]` game), then
`mix corpus.extract --games <n> --corpus <filtered.pgn>`. Extraction emits
each game's initial position at ply 0 and skips non-standard games.

**Prod serves the broadcast corpus (1.17M games) from the packed backend**
(ADR-0037, live since 2026-09-03). The occurrence layer is the packed binary
index; games/moves/metadata stay in prod PG (`corpus_games`/`corpus_moves`,
COPY-loaded). The PG occurrence tables are **not** loaded in prod — the
packed index replaced them (the 94M-row COPY/index build OOM'd the
shared-cpu Postgres and filled the volume into read-only mode; that path is
abandoned, see ADR-0036). Prod layout:

- `fly.toml` `[env]` sets `PACKED_CORPUS=1` and
  `PACKED_DIR=/data/corpus-packed-broadcast`.
- The packed dir lives on the **per-region `blunderfest_data` volumes**
  (one per machine/region — each region needs its own copy; they are not
  shared). Ship with `flyctl ssh sftp put --machine <id> -R
  data/corpus-packed-broadcast /data/corpus-packed-broadcast`, then verify
  on-machine: `sha256sum` the four segment bins against `manifest.json`
  (boot fails truthfully on a corrupt/missing dir — never silent PG
  fallback). Volumes are 20GB (extended from 2GB; `flyctl volumes extend`).
  The dir also carries the **anchor sidecars**
  (`seg-*/{occ,pos,bucket,book}.bin.anchors-256`, ~17 MB total) — boot
  loads them in one read (~240 ms on prod; Spike 09 Phase 1); a fresh dir
  without sidecars rebuilds them once on first open (chunked sequential
  scan) and persists them, so shipping them is an optimization, not a
  correctness requirement. When rebuilding the corpus, keep them out of
  stale state: delete the old dir's sidecars or ship the freshly built
  ones with the new bins.
- Games/moves into prod PG: export from the local docker corpus
  (`COPY corpus_games TO STDOUT` / `corpus_moves`), then `COPY ... FROM
  STDIN` through `flyctl proxy 15432:5432 -a blunderfest-db`. ~1.2M rows
  load in under a minute each.

For a future corpus refresh: rebuild the packed dir locally, ship to each
region's volume, reload games/moves in PG, redeploy. Boot fails safe if the
dir is absent mid-ship.

The prod load lessons (all fought the hard way, 2026-08-25 and 2026-08-30 — the PG occurrence-load path, now superseded by packed):

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
- **Read-only recovery (2026-08-30):** when the volume fills, the cluster
  flips to read-only (`transaction_read_only = on`, everything fails with
  `cannot execute … in a read-only transaction`). Recovery: extend the volume
  past the threshold (`flyctl volumes extend`), then `rm /data/readonly.lock`
  via `flyctl ssh console -a blunderfest-db`, then `flyctl machine restart`.
  Fly volumes only grow — there is no shrink; the broadcast-load volume is at
  64GB (extended during the failed reload) and stays there until the packed
  index replaces PG.
- **Temporary scale-up for big loads:** the shared-cpu-1x/1GB box OOMs on the
  94M-row index build; it was scaled to shared-cpu-4x/8GB for the attempt and
  back down after (`flyctl machine update <id> -a blunderfest-db --vm-cpus N
  --vm-memory M --yes`). Not a fix — even 8GB could not build the occurrences
  key index; the corpus has outgrown PG for this shape.
- Machine-side `bin/blunderfest rpc` is for quick probes; the app's pool
  needs a few minutes after a machine start before it is reliable
  (boot-time DNS/network settling).

### Corpus occurrences include ply 0

Since 2026-08-30 the extraction emits each game's initial position (`ply 0`),
so the start position has occurrences and first-move W/D/B stats. A future
full reload via `mix corpus.extract` + `corpus.load` reproduces this; a
targeted backfill of an existing corpus is a pair of idempotent inserts
(every corpus game starts at the standard start):

```sql
INSERT INTO corpus_occurrences (key, gid, ply)
SELECT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', gid, 0
FROM corpus_games ON CONFLICT DO NOTHING;
INSERT INTO corpus_positions (key, pawn_hash, first_gid, first_ply)
SELECT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -',
       7637200972616230768, min(gid), 0
FROM corpus_games ON CONFLICT (key) DO NOTHING;
```

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
