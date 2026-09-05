# OpenChessLab — Packed Corpus v2
## Production Cutover: Phase 3 Runtime + HE CPU Optimizations

### Objective

Deploy the already validated Packed Corpus v2 runtime together with the
semantics-preserving Historical Evidence CPU optimizations.

This is an operational production cutover.

Do NOT redesign anything.
Do NOT optimize anything further.
Do NOT change product semantics.
Do NOT change PostgreSQL topology.
Do NOT change Fly region placement.
Do NOT change the Corpus GenServer architecture.

The implementation and benchmark work are complete.

---

# Required source material

Read completely before doing anything:

1. `docs/packed-corpus-phase3-runtime-cutover.md`
2. `docs/technical-spike-he-product-cpu.md`
3. `docs/packed-corpus-phase2-format-v2.md`
4. ADR-0038
5. current `fly.toml`
6. current deployment scripts / documented production workflow
7. current runtime configuration for:
   - `PACKED_CORPUS`
   - `PACKED_DIR`
   - Fly regions
   - volumes
   - health checks

Use current repository state as the final authority if documentation is stale.

---

# Proven preconditions

The following are already proven and must NOT be re-investigated:

## Packed Corpus v2

- format v2 validated
- full broadcast artifact validated
- checksums valid
- position metadata exact
- bounded occurrence reads exact
- multi-segment behavior tested
- v1 rollback compatibility retained

## Phase 3 runtime

- `position_stats/1` metadata-backed on v2
- `first_occurrence/1` bounded
- `occurrences/2` true bounded prefix reads
- Historical Evidence cut over
- independent-game support corrected
- DTO parity preserved
- all relevant tests green

## HE CPU optimizations

The accepted implementation includes exactly these four
semantics-preserving changes:

1. precomputed Jaccard frequency maps
2. union-by-rank
3. request-local member index
4. exact connected-pair skip in the single-linkage sweep

Measured warm start-position result:

```text
median total: ~160 ms
peak memory:  ~146 MB
````

Acceptance gates:

```text
< 1,000 ms  PASS
< 300 MB     PASS
```

No semantics changed.

Do not reopen these conclusions.

---

# Mission

Perform the production cutover in this order:

1. verify repository state
2. verify the existing v2 artifact
3. verify rollback readiness
4. upload v2 corpus to each production volume
5. verify uploaded corpus on each machine
6. verify anchor sidecars
7. switch runtime configuration to v2
8. deploy current application code
9. verify health
10. run mandatory Historical Evidence production probes
11. verify both regions
12. inspect memory/restarts/logs
13. either:

    * declare cutover successful; or
    * rollback immediately

Do not mix in unrelated work.

---

# 1. Repository verification

Before touching production, record:

```text
git status
git rev-parse HEAD
git log -1 --oneline
```

The working tree must be clean unless the deployment workflow explicitly
requires generated files.

Run:

```text
mix precommit
```

Expected current baseline:

```text
480 tests
no warnings
```

Also run the relevant final checks if not already part of the current commit:

```text
mix corpus.he_parity
mix corpus.he_bench
mix corpus.he_cpu --compare
```

Do not deploy if any correctness gate fails.

---

# 2. Record exact deployment version

Record in the deployment report:

```text
commit SHA
branch
timestamp
Fly app
current production image/version
current PACKED_DIR
target PACKED_DIR
configured regions
machine IDs
volume IDs where relevant
```

Do not rely on memory or previous report values if current production differs.

---

# 3. Verify local v2 artifact

Use the existing validated artifact.

Expected conceptual path:

```text
data/corpus-packed-broadcast-v2
```

Do NOT rebuild the corpus.

Verify:

* manifest exists
* version = 2
* expected segment(s) exist
* all four `.bin` files exist
* anchor sidecars exist
* checksums match manifest
* artifact size is plausible (~13.1 GiB total)
* validation succeeds

Run the existing validation command, e.g.:

```text
mix corpus.validate \
  --packed-dir data/corpus-packed-broadcast-v2 \
  --sample 32
```

If validation fails:

STOP.

Do not upload or rebuild automatically.

---

# 4. Verify rollback readiness before deployment

Before changing production, prove that rollback remains possible.

Confirm:

* existing v1 corpus still exists on each production volume
* current v1 path is known exactly
* current application revision is known
* rollback configuration is known
* no command in this deployment deletes or overwrites v1

Record the rollback target explicitly.

Expected conceptual rollback:

```text
PACKED_DIR=/data/corpus-packed-broadcast
```

but use the actual current production value.

Rollback must be possible without rebuilding data.

---

# 5. Upload v2 artifact to each production volume

Upload the complete existing v2 directory to every machine/volume that needs
local corpus access.

Conceptually:

```sh
flyctl ssh sftp put --machine <machine-id> -R \
  data/corpus-packed-broadcast-v2 \
  /data/corpus-packed-broadcast-v2
```

Use the actual supported Fly workflow in the repository/environment.

Important:

* do not overwrite v1
* do not partially reuse an old failed upload without verification
* include:

  * manifest
  * all bin files
  * anchor sidecars
  * any required segment metadata

If transfer is interrupted, verify completeness before proceeding.

---

# 6. Verify the uploaded corpus on every target

On every target machine/volume:

verify:

```text
manifest
file sizes
SHA-256 checksums
anchor sidecars
directory ownership/permissions
```

Compare the production checksums to the local validated artifact.

Do not proceed on checksum mismatch.

If practical, perform a lightweight corpus-open probe using the uploaded
directory before flipping production traffic.

Expected behavior:

* v2 opens in milliseconds / low tens of milliseconds with persisted anchors
* no multi-minute sparse-anchor rebuild
* no 1.21M-small-pread boot pattern

If sidecars are missing:

generate them using the established implementation before traffic reaches
the machine, or upload the validated sidecars.

Do not redesign the anchor mechanism.

---

# 7. Change runtime configuration

Switch the production corpus path to the uploaded v2 directory.

Expected conceptual value:

```text
PACKED_DIR=/data/corpus-packed-broadcast-v2
```

Keep:

```text
PACKED_CORPUS=1
```

unless current repository configuration uses an equivalent mechanism.

Do not change unrelated environment settings.

Do not remove the v1 directory.

Show the exact configuration diff in the report.

---

# 8. Deploy the current application code

Deploy the exact commit containing:

* Phase 3 bounded Corpus API
* Historical Evidence v2 cutover
* independent-game correction
* accepted HE CPU optimizations

Use the established deployment workflow.

Do not modify code during deployment.

Record:

```text
new image/version
deploy duration
machine restart/replacement events
health-check state
```

---

# 9. Initial health verification

Immediately after deployment, check:

```text
Fly deployment status
machine status
health checks
application logs
OOM/restart indicators
corpus-open logs/timing
```

Verify normal application health before sending hot Historical Evidence
requests.

If the application cannot boot cleanly:

ROLL BACK.

Do not debug broadly while production is unhealthy.

---

# 10. Mandatory production functional probes

Run at minimum:

## Health

```text
/api/health
```

## Normal room flow

Open/load a normal OpenChessLab room and verify basic API/UI operation.

## Historical Evidence

Probe these positions:

* A2 Ruy decision point
* Najdorf reference
* after 1.e4
* start position

The start position is mandatory.

Use the known FENs from the Phase 3 deployment report or existing benchmark
fixtures.

For each request record:

```text
HTTP status
total_ms
candidates_ms
menu_ms
evidence_ms
pg_ms
response size if useful
machine/region
```

Do not classify cross-region PG latency as a packed-corpus regression.

---

# 11. Verify both regions

The app currently uses multiple Fly regions.

Verify the request path in both configured regions where technically
possible.

At minimum, obtain one Historical Evidence probe from:

```text
ams
ord
```

or whatever the current configured regions actually are.

Force a region/machine using the established Fly method rather than assuming
normal routing hits both.

For each region record:

```text
total_ms
pg_ms
packed/local stage timings
machine health
```

Expected interpretation:

* packed-corpus stages should remain cheap in both regions
* `ord` may still show high `pg_ms` because PostgreSQL is in `ams`
* that is the known parked issue, not a reason to undo v2 if everything else
  is healthy

Do not attempt to solve the region issue during this task.

---

# 12. Memory / OOM verification

The original incident was an OOM on a 1 GB machine.

Therefore explicitly inspect memory during/after:

* start-position request
* after 1.e4
* at least one repeated hot request
* preferably a small n=2 concurrency probe if safe

Record:

```text
machine memory before
peak/observed memory during
memory after
OOM events
machine restarts
exit_code 137 indicators
```

Acceptance:

```text
no OOM
no machine restart caused by HE
no unbounded memory growth
```

Do not require production memory to equal local benchmark memory exactly.

The key requirement is that it stays safely below the machine limit.

---

# 13. Boot / anchor verification

Confirm the Phase 1 startup fix survived the v2 cutover.

Record the observed corpus-open time.

Acceptance:

```text
no multi-minute boot
no repeated anchor rebuild
sidecars loaded successfully
```

If a machine performs a slow anchor rebuild unexpectedly:

STOP and investigate the packaging/path problem.

Do not normalize that as acceptable production behavior.

---

# 14. Product correctness verification

For at least one production request, compare the returned Historical Evidence
shape against a known-good local v2 result where practical.

Check especially:

* card count
* ordering
* occurrence/game support
* same-game-only state
* family/menu shape
* no obvious missing evidence

Do not make product changes in response to subjective visual differences
during this task.

This is a deploy verification, not a UX review.

---

# 15. `book_counts` correctness sanity check

Because Phase 3 corrected the previous packed `book_games_count` proxy, verify
at least one hot production position where the old value was known to
diverge.

The start position is ideal.

Confirm that the product-facing independent-game support now reflects the
authoritative position `game_count`, not the book-sum proxy.

Do not change the continuation-specific book counts.

---

# 16. Success criteria

The cutover is successful only if all of these are true:

1. application deploy succeeds
2. health checks stay green
3. v2 corpus opens correctly
4. persisted anchors are used
5. checksums match
6. v1 remains intact
7. Historical Evidence succeeds for all mandatory probes
8. start-position request succeeds
9. no OOM
10. no machine restart caused by the probes
11. no unexplained DTO/product-semantic regression
12. packed/local stages remain cheap
13. independent-game support uses the corrected semantics
14. both regions are verified
15. rollback remains immediately available

---

# 17. Rollback triggers

Rollback immediately on any of:

* application fails to boot
* corpus cannot open
* checksum/artifact mismatch discovered
* health checks fail persistently
* start-position HE fails
* OOM
* machine restart/exit 137 due to HE
* unexplained correctness regression
* severe packed-corpus latency regression
* anchor behavior regresses to multi-minute startup

Do not wait for multiple failures.

---

# 18. Rollback procedure

Use the already retained v1 corpus.

Conceptually:

```text
PACKED_DIR=/data/corpus-packed-broadcast
```

Then redeploy the previously known-good application revision/configuration
as needed.

Record:

```text
reason
rollback start time
rollback completion time
restored image/version
restored PACKED_DIR
health status
```

After rollback, run:

```text
health
normal room
one known HE request
```

Do not delete the failed v2 directory during rollback.

Preserve it for diagnosis.

---

# 19. Do not optimize during the deployment

Explicitly forbidden:

* changing HE algorithms
* changing family implementation
* changing candidate caps
* changing thresholds
* changing query batching
* changing PG calls
* changing Fly regions
* changing machine sizes
* adding replicas
* changing Corpus GenServer
* changing corpus files
* repacking
* changing frontend code

If production reveals a new problem:

measure it, document it, and either:

* continue if it is clearly harmless and within acceptance criteria; or
* rollback.

Do not fix unrelated problems live.

---

# 20. Deployment report

Write:

`docs/packed-corpus-v2-production-cutover.md`

Include:

## Executive result

State exactly one:

```text
CUTOVER SUCCESSFUL
```

or:

```text
CUTOVER ROLLED BACK
```

No ambiguous verdict.

## Version

Record:

* commit
* image
* deployment timestamp
* regions
* machine IDs
* corpus path
* manifest/version

## Preflight

Record:

* repository checks
* artifact validation
* checksums
* rollback verification

## Upload

Record:

* target volumes/machines
* transfer result
* uploaded sizes
* checksum verification

## Configuration

Show old vs new `PACKED_DIR`.

## Boot

Record:

* boot time
* corpus-open time
* anchor-sidecar behavior

## Health

Record health-check results and any restart events.

## Historical Evidence production probes

Table:

```text
position | region | HTTP | total | candidates | menu | evidence | pg | memory | result
```

Include at least:

* A2
* Najdorf
* 1.e4
* start

## Memory

Record hot-position behavior and any OOM/restart evidence.

## Correctness

Record DTO/product sanity checks and independent-game count verification.

## Region comparison

Explicitly separate:

```text
local/product CPU
packed access
PG hydration
```

Do not present `ord → ams` latency as a v2 corpus failure.

## Rollback state

Confirm:

* v1 directory still exists
* exact rollback path
* previous image/revision known
* rollback not needed / rollback executed

## Remaining known issue

Carry forward:

```text
ord → ams PostgreSQL latency
```

Do not solve it here.

## Final verdict

Exactly one:

```text
CUTOVER SUCCESSFUL — v2 is now production
```

or:

```text
CUTOVER ROLLED BACK — v1 remains production
```

---

# Hard stop

Stop after:

* production cutover or rollback
* verification
* deployment report

Do NOT continue into:

* PostgreSQL batching
* cross-region latency work
* database replicas
* Fly topology
* GenServer concurrency
* further HE CPU optimization
* corpus v3
* UI work

The next task, only after a successful cutover, is the separately parked
cross-region PostgreSQL latency investigation.
