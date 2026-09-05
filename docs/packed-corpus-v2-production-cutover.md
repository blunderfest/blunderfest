# Packed Corpus v2 — Production Cutover: Phase 3 Runtime + HE CPU Optimizations

> Date: 2026-09-05 · Assignment:
> `docs/production-cutover-phase3-runtime-hecpu-optimizations.md`
> Deploys the validated Packed Corpus **v2** runtime together with the
> semantics-preserving Historical Evidence CPU optimizations
> (`docs/technical-spike-he-product-cpu.md`). Operational cutover only — no
> redesign, no further optimization, no semantics change.

## Executive result

```text
CUTOVER SUCCESSFUL
```

Both production regions (ams, ord) now serve the packed **v2** corpus with the
Phase 3 bounded Corpus API and the four HE CPU optimizations. All 15 success
criteria in the assignment are met. v1 remains intact on every volume for
immediate rollback.

## Version

| Field | Value |
|---|---|
| Commit (deployed) | `94ec7e50` (config flip) on top of `8e1c0ab2` (HE CPU opts) + `30b75cbc` (Phase 3) |
| Branch | `main` |
| Deployment timestamp | 2026-09-05 ~15:57–16:00 UTC |
| Fly app | `blunderfest` |
| Image | `registry.fly.io/blunderfest:deployment-01M1S4NWA3SS7V53SGV40SJ1VR` (113 MB) |
| Machine version | 513 (pre) → **516** (post) |
| Regions | `ams` (primary), `ord` |
| Machines | ams `2874763ead9608` (autumn-rain-2399) · ord `7811de03c23638` (muddy-forest-8040) |
| Volumes | ams `vol_r682ykl52y1md514` · ord `vol_4ql3kj780wdwoonr` (`blunderfest_data`, mounted `/data`) |
| Corpus path | `/data/corpus-packed-broadcast-v2` |
| Manifest | `version: 2`, `pos_version: 2`, 1 segment (`seg-000001`), 1,174,661 games / 94,257,050 occurrences / 72,393,592 positions |

## Preflight

* **Repository** — `mix precommit`: 480 tests, no warnings. HE parity gates
  re-run on the exact deploy code: `mix corpus.he_parity` (broadcast v1↔v2)
  9/9 identical; `mix corpus.he_bench` start-position gate **PASS** (median
  160 ms, peak 146 MB); `mix corpus.he_cpu --compare` 9/9 DTO parity vs the
  pre-change snapshot.
* **Artifact validation** — `mix corpus.validate --packed-dir
  data/corpus-packed-broadcast-v2 --sample 32`: checksums verified, v2 stats
  verified on 32 sampled positions. Manifest present, `version=2`, single
  segment, all four `.bin` + four `.anchors-256` sidecars present, size
  ~13.12 GiB (runtime files; pack-time `.tsv` intermediates excluded).
* **Rollback readiness** — v1 corpus present on both volumes before any
  change; rollback path recorded (see Rollback state). No command in this
  deployment deletes or overwrites v1.

### Capacity (discovered + resolved)

The existing **20 GB** volumes could not hold v1 (~13 G) **and** v2
(13.12 GiB). ams had 6.6 G free, ord 5.3 G — both short. Volumes were
extended (grow-only, data preserved):

* ams `vol_r682ykl52y1md514`: 20 GB → **32 GB**
* ord `vol_4ql3kj780wdwoonr`: 20 GB → **40 GB**

ord needed the larger size because it also carries a stale 1.3 G
`/data/corpus` (100k-era extraction `.tsv` artifacts, superseded by the
broadcast corpus). Per the assignment's "do not change corpus files", that
directory was **left untouched**; the extra space was provided by the
extension instead. After extension: ams 32 G / ord 40 G, ample room for v1+v2.

## Upload

* Shipped the **runtime artifact only** (manifest + 4 segment bins + 4 anchor
  sidecars, 13.12 GiB) to each volume via `flyctl ssh sftp put`; the pack-time
  `.tsv` intermediates were **not** shipped. v1 was never overwritten.
* **Byte-size verified** for every file on upload, then **SHA-256 verified**
  for all four bins against `manifest.json` on **both** machines — identical:

```text
occ.bin     6411739a987b4666bc13babbb3cb2ba0cfd33fe65156bb29c17e7dfa5ad261fc
bucket.bin  10cf8d6062e206573a0f079ee10d6a390af5164dace457590c7264bcde4f5df0
book.bin    66264f685054cf82d07aebf97e1e33d60a729edbaa11daf430f45a40a8569dde
pos.bin     7398608a6b1473bc2b3e58617bb7b7b119e273c2e311dc8b79bb197edd5490d1
```

* Operational notes (fought and documented): machines auto-stop when idle and
  kill background jobs / clear `/tmp`; long transfers and hashes were run with
  autostop temporarily disabled and outputs written to `/data`. `flyctl ssh
  console -C` does not shell-parse compound commands (wrap in `sh -c`), and
  `flyctl sftp` refuses to overwrite (partials were removed before retry).

## Configuration

```diff
 [env]
   PACKED_CORPUS = '1'
-  PACKED_DIR = '/data/corpus-packed-broadcast'
+  PACKED_DIR = '/data/corpus-packed-broadcast-v2'
```

Confirmed live on both machines (`printenv PACKED_DIR` →
`/data/corpus-packed-broadcast-v2`, `PACKED_CORPUS=1`). Committed as
`94ec7e50`.

## Boot

Both regions opened the corpus from **persisted anchor sidecars** (the Phase 1
fix survives the v2 cutover) — no rebuild, no multi-minute startup:

```text
ams: packed corpus open in 202ms (1 segment(s), anchors: sidecar)
ord: packed corpus open in 212ms (1 segment(s), anchors: sidecar)
```

Endpoint up on both: `Running BlunderfestWeb.Endpoint with Bandit 1.12.5 at
:::8080 (http)`.

## Health

* `GET /api/healthz` → HTTP 200 `{"status":"ok","region":"ams"|"ord"}` in both
  regions. (Note: the actual health route is `/api/healthz`; the assignment's
  `/api/health` falls through to the SPA catch-all.)
* The `flyctl deploy` warning "not listening on 0.0.0.0:8080" was a **false
  positive** — boot logs show Bandit bound to `:::8080` and healthz responds.
* No OOM/restart indicators at boot; machines reached "good state".

## Historical Evidence production probes

Mandatory positions probed (HTTP 200 everywhere). Timings in ms
(candidates / menu / evidence / pg). ams reached via a `flyctl proxy` private
tunnel (colocated PG); ord via the public anycast path (cross-region PG).

| position | region | HTTP | total | cand | menu | evid | pg | cards | fam | occ / games |
|---|---|---|---|---|---|---|---|---|---|---|
| start | ams | 200 | 612 → 430 warm | 112 → 40 | 58 | 299 | 397 → 288 | 22 | 12 | 1,169,388 / 1,169,353 |
| after 1.e4 | ams | 200 | 488 | 82 | 39 | 265 | 333 | 22 | 6 | 569,153 / 569,149 |
| Najdorf | ams | 200 | 1,419 | 847 | 156 | 308 | 355 | 22 | 36 | 30,628 / 30,244 |
| A2 (Ruy) | ams | 200 | 584 | 191 | 23 | 253 | 340 | 22 | 8 | 7,655 / 7,655 |
| start | ord | 200 | 10,195 | 113 | 59 | 9,137 | 9,978 | 22 | 12 | 1,169,388 / 1,169,353 |
| after 1.e4 | ord | 200 | 9,644 | 86 | 40 | 9,124 | 9,485 | 22 | 6 | 569,153 / 569,149 |
| Najdorf | ord | 200 | 11,105 | 915 | 161 | 9,153 | 9,967 | 22 | 36 | 30,628 / 30,244 |
| A2 (Ruy) | ord | 200 | 10,225 | 193 | 23 | 9,116 | 9,981 | 22 | 8 | 7,655 / 7,655 |

## Memory

* ams machine: MemTotal ~962 MB, MemAvailable 231→283 MB across probes —
  comfortable. **No OOM** (`oom_killed=false`), **no exit 137**, **no
  HE-caused restart** on either machine.
* n=2 concurrent start probes (ams): both HTTP 200, internal totals ~788/807 ms
  each (wall ~2.5 s — the known single-GenServer serialization, out of scope),
  memory recovered to ~276 MB available. No OOM, no unbounded growth.

## Correctness

* **Production start DTO is byte-identical to the known-good local v2 DTO**
  (timings stripped) — cards, ordering, occurrence/game support, family/menu
  shape, same-game flags all match.
* Counts match expected across all four positions: start occ 1,169,388 / games
  1,169,353; e4 569,153 / 569,149; Najdorf 30,628 / 30,244; A2 7,655 / 7,655.
  Cards = 22 and families = 12/6/36/8 everywhere.
* **`book_counts` independent-game check (start):** `POST /api/book/counts`
  returns **1,169,353** — the authoritative position `game_count`, **not** the
  old book-sum proxy (1,082,089, which diverged by −87,264). The Phase 3
  correction is live.

## Region comparison

Separated as required:

* **Local/product CPU (`menu`)** — 23–160 ms in **both** regions (HE CPU
  optimizations working; was 861 ms+ before). Identical across regions.
* **Packed access (`candidates`)** — 38–915 ms in both regions (Najdorf's cold
  bucket scan is the outlier; warm is tens of ms). v2 reads cheap everywhere.
* **PG hydration (`pg`)** — ams **288–397 ms** (colocated) vs ord
  **9,485–9,981 ms** (cross-region ord→ams round trips). This is the known
  parked issue, **not** a v2 regression — the assignment explicitly says not to
  classify it as one.

## Rollback state

* v1 directory **still exists** on both volumes (`/data/corpus-packed-broadcast`),
  untouched.
* Exact rollback path: revert `fly.toml` `PACKED_DIR` to
  `/data/corpus-packed-broadcast` and `flyctl deploy` (or redeploy prior image
  v513). No data rebuild required.
* Previous image/revision known: v513
  (`blunderfest:deployment-4adabd5168e745a0eeb2de6e3926f28b`).
* **Rollback not needed.**

## Remaining known issue

```text
ord → ams PostgreSQL latency
```

`pg_ms` from ord is ~10 s (cross-region game/move hydration). Parked, out of
scope for this cutover — it is the separately parked cross-region PostgreSQL
investigation, the named next task after a successful cutover.

## Operational housekeeping

* Autostop was temporarily disabled during the uploads and **restored to
  `stop`** (scale-to-zero) on both machines afterward. Machines are v516.

## Final verdict

```text
CUTOVER SUCCESSFUL — v2 is now production
```
