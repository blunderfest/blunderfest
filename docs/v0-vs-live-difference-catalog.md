# Live vs v0 mockup — difference catalog

Enum catalog of the remaining differences between the deployed app
(`blunderfest.org`, post-token convergence) and the v0 wireframe
(`design/DESIGN.md`, the frozen spec; live at the .v0.build URL). Marked as
**gap** (ours is behind v0) or **deviation** (ours differs from v0 on
purpose). Grouped by theme. This is a decision aid only — nothing here was
implemented.

## Layout

- **L1 (deviation, to consider)** — ours centers the rail+board+dock block
  with left/right whitespace; v0 is **full-width**: rail and dock attach to
  the viewport edges. At ≥1500 the block floats with big gutters; the v0
  fills the frame.
- **L2 (gap)** — our title row shows only "? – ?" for untitled games;
  v0 shows "Marmot vs Heron · Giuoco Pianississmo · move 11" in the title
  row and also carries room title in the header subtitle ("Thursday study
  hall · 3 boards"). Ours has no room title subtitle.
- **L3 (gap)** — v0's title row embeds "3 watching this board" + per-game
  avatar initials; ours only has presenter dot + per-way avatar strip in the
  header. This is a deviation, not a gap.
- **Mobile** — ours: rail-as-horizontal-strip with import/new tiles at the
  end (v0 does this too); parity holds, its empty room is centered,
  correct.

## Timeline

- **T1 (gap)** — ours: a collapsed strip that shows the sparkline only,
  with layer dots (Eval/Material/Activity/Clocks) hidden; v0 renders the
  eval chart **on by default** and still carries the collapsed strip. Its
  expand chevron stacks the layers *inside the sparkline itself* (the layer
  fills stack visually about the midline). Deviation.
- **T2 (gap)** — v0's analyze job renders a **progress bar inside the
  timeline header** (fill sweeps across the layer chips as it runs; pre-run
  "Analyze game" CTA sits on the chip row; the Re-analyze link lives up
  there too). Ours: a bare "Analyze game" button, no progress fill, an
  off-target `?` helper. Deviation.
- **T3 (gap)** — v0's pre-analysis idle becomes the CTA on the chip row,
  not a centered placeholder; ours writes placeholder text centered in the
  collapsed strip area.
- **T4 (gap)** — our band caption only lists the current state (the layer
  being shown); v0's header includes a per-player line + a Re-analyze link
  visible even when idle.

## Header / room chrome

- **H1 (deviation, accepted)** — our header carries the room-code chip +
  region chip + theme/help/account. v0 carries the gold **Share room**
  primary (+the transfer-admitted "Room" tab) + status dot. We deleted the
  share button on purpose (code chip is enough). v0's header text: "AMS↔CHI
  96ms" mid-header. Ours: left of presence.
- **H2 (gap)** — our header has no room-title subtitle; v0's header shows
  "Thursday study hall · 3 boards" — a room title with game count. (Our
  header subtitle is where to put it if adopted.)
- **H3 (gap)** — our code chip uses helper text "Click to copy the room
  code"; v0's share button label says "Share room" outright. Deviation.

## Games rail

- **G1 (deviation, accepted)** — ours: text rows (title + eval + opening +
  watchers); v0: same. Chips differ: we mark `position` for setup games;
  v0 marks `position` chip too. Parity.
- **G2 (gap)** — our rail header on mobile is hidden (end tiles) while v0
  keeps the +/- header; both inspect as end tiles on <xl. Ours uniform.
- **G3 (gap)** — ours lists presenter markers as a warn dot on the row's
  title row; v0 shows tiny avatar initials on each game's sub row.
  Deviation.

## Dock / tabs

- **D1 (deviation, accepted)** — ours: Moves · Review · Chat. v0: also
  Moves · Review · Chat · Room (we deleted Room). Post-ADR-0032 v0 wasn't
  re-generated; the team IA exists as always-to-be-watched.
- **D2 (gap)** — our engine box header: "ENGINE ● · DEPTH 14 · PV 3 4 ↗
  toggle" with a toggler and a lines select. v0: same. Parity.
- **D3 (gap)** — our opening-book block: "a3 …A00 · Anderssen's Opening"
  per row (no game counts). v0 shows counts + per-color percentages with
  tiny bars by row — we cannot carry counts until the corpus lands
  (Spike 03/08-gated). Gap deferred by design.

## Misc

- **M1 (deviation, accepted)** — our light theme converged on cool-paper
  near-white with border-only elevation; v0 does this too. Parity.
- **M2 (gap)** — ours: gold means the active tab/current move/primary.
  v0's convention identical. Parity.

## To price before any adoption pass

1. L1 — full-width frame.
2. L2/T4 — title row + subtitle carries the game meta.
3. T1–T4 — timeline behavior.
4. H2 — a room title subtitle (optional).
5. G3/D3 — under critiqer enrichment/roadmap.

Note the screenshots (desktop 1500×950, mobile 390×844) live in commit
history's HEAD for the tour — they were removed from the tree.
