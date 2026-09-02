# OpenChessLab Brand Migration — Phase 1 Audit & Token Proposal

## 1. Current theme architecture

**Stack:** Tailwind CSS v4 (`@tailwindcss/vite`), no SCSS/CSS-in-JS/theme objects/ThemeProvider. Everything is CSS custom properties + utility classes.

- **Token source of truth:** `assets/src/app/app.css` — a single `@theme` block (Tailwind v4) defining `--color-*`, `--text-*` (type scale), `--radius-*`, `--shadow-*`, `--font-*`, `--ease-*`, `--animate-*` + keyframes. Utilities (`bg-gold`, `text-ink`, `rounded-panel`…) are generated from these.
- **Light/dark:** dark is the `:root` default (`color-scheme: dark`); `:root[data-theme="light"]` (app.css:139) overrides the *same token names* with daylight values. Board/piece tokens are deliberately **not** overridden (theme-independent).
- **Theme switching:** `assets/src/lib/theme.ts` — `localStorage['blunderfest.theme']` (`light|dark|system`), applied to `<html data-theme>`, with a `prefers-color-scheme` watcher; a pre-paint inline script in `assets/index.html:8-17` prevents flash.
- **Component layer:** primitives centralized in `assets/src/components/ui.ts` (`panel`, `panelHeader`, `button`, `input`, `textarea`, `chip`, `statusDot`, `listRow`) via `tailwind-variants` (`createTV` with a custom font-size class group). Feature components otherwise use token utilities directly; a handful of hardcoded hexes remain (charts, eval bar, dialog shadows — §3/§5).
- **Spec docs:** `design/DESIGN.md` (frozen v0 spec, §3 palette) and `design/DESIGN-SYSTEM.md` (component spec). Note: the specs use names `--color-brand/--color-accent/surface-0..3/ink-2/ink-3`; the implementation mapped them onto `gold/gold-hi`, `void/surface/panel/raised/overlay`, `ink/muted/faint`. app.css is the live truth; both docs would need updating in Phase 2.

## 2. Branding inventory

**User-visible:**

| Occurrence | Location |
|---|---|
| `<title>Blunderfest</title>` | `assets/index.html:7` |
| Favicon: gold rounded tile + black knight | `assets/public/favicon.png` (64×64) |
| Logo: gold tile (knight+“?” knock-out) + wordmark "Blunderfest" (single-color `text-ink`) | `assets/src/components/Logo.tsx` (tile `bg-gold text-[#20180a]`, wordmark:45) |
| `app.name` = "Blunderfest", `app.tagline` = "Collaborative chess analysis.", `update.available` = "A new version of Blunderfest is available." | `assets/src/i18n/locales/en.json:3-4,520` |
| Header logo link `aria-label={t('app.name')}`; Home `sr-only` h1 + tagline | `App.tsx:189`, `Home.tsx:142-147` |

No web manifest, no OG/meta description, no `theme-color` meta.

**Technical (visible-adjacent):**

- Lichess OAuth `client_id` defaults to `"blunderfest.org"` — **shown on the Lichess consent screen** (`lib/blunderfest/lichess.ex:59-60`, config-overridable).
- localStorage keys: `blunderfest.theme`, `.device`, `.eval-scale`, `.engine`, `.hints`, `.engineLines`, `.timelineActiveLayer`, `.chesscom-user`; DOM event `blunderfest:device-rehealed` (`api.ts:115`).
- `assets/package.json` name `blunderfest-assets`; Elixir OTP app `:blunderfest` / `Blunderfest.*` modules (backend namespace, not UI); domain `blunderfest.org` (PHX_HOST), fly app, repo/docs.

## 3. Color / token inventory

**Global tokens (app.css) — dark / light:**

- Surfaces: `void #141619/#f2f3f5`, `surface #1b1e23/#fafbfc`, `panel #22262d/#fff`, `raised #22262d/#fff`, `overlay #2a2f38/#fff`
- Borders: `line #2e333b/#e2e5e9`, `line-strong #3d434e/#c6ccd4`
- Text: `ink #e9ebee/#1c1f24`, `muted #a6adb8/#4d545e`, `faint #8e96a3/#626a76` (≥4.5:1 floor)
- **Gold family:** `gold #c9a227` (both), `gold-hi #d4b13c/#8a6d10`, `gold-text #d4b13c/#8a6d10`, `gold-dim #7a641a` (**defined but unused**)
- Status: `ok #58a86c/#2c7a43`, `ok-hi`, `bad #d96c66/#b23e38`, `bad-hi`, `info #6ba3d6/#2b6cb0`, `silver #b6bdcc/#6b7688`
- Board (theme-independent): `board-light #e8d9b7`, `board-dark #a97e50`, `move-from #cdd26a`, `move-to #aaa23a`, `select #6ea8fe`, `check #e05a4e`
- Misc: `clock-w #f4f6fb/#4d5768`, `tray #475069/#dde3ec`, `shadow-panel`/`shadow-board` (per-theme)

**Hardcoded in components (not tokens):** on-brand ink `#20180a` (primary btn, logo, promotion picker, checkbox tick, engine white badge); chart series `#6ea8fe`/`#b6bdcc`/`#f4f6fb`; eval bar `#f4f6fb→#c9cedb` gradient + `#1a1d24`; W/D/B bars `#e8e6df/#7a8499/#2e3442` (ReferencePanel, EngineReadout); board selected squares `#cfe0ff/#7f93b8`; draw colors `#3b82f6/#4caf50/#a855f7/#e05a4e` (`board.ts:205`); dialog/popover shadows `rgba(0,0,0,.9/.8/.72)`; presence avatar `hsl(hue …)`.

**Gold's current semantic roles** (full table §4): brand/identity, primary action, focus ring, current-position/selection, active tab/tool, links, hover affordance, **and** warning/status (thinking, reconnecting, mistakes `?`, partial-import alert) — i.e. gold is doing ~6 different jobs, which is exactly why a blind swap would fail.

## 4. Gold usage analysis

Treatment key: **cyan** = focus / position-being-explored / active selection / interactive accent; **navy** = brand fill & primary action; **neutral** = demote to text/border tokens; **keep** = board or data-viz; **status** = separate semantic warning color.

| Location (file:line) | Current role | Color | Recommended role | Treatment | Rationale |
|---|---|---|---|---|---|
| Logo tile + favicon | brand identity | `#c9a227` | brand.primary | **navy** | Old mark; new identity carries navy (knight glyph reusable) |
| `ui.ts` button primary (:53) | primary action | gold fill | interaction.primary | **navy** | CTA = brand; cyan stays reserved for focus/exploration |
| `Switch.tsx:24` on | control active | gold | interaction.primary | **navy** | Persistent enabled state, not focus |
| Global `:focus-visible` (app.css:215) + all `outline-gold-hi` (ui.ts, inputs, MoveList, listRow) & Board square focus ring (Board.tsx:17) | focus | gold-hi | interaction.focus | **cyan** | Brand direction: cyan = focus |
| MoveList current move (:16) | position being explored | gold wash | interaction.selected | **cyan** | The core "now" semantic |
| Chart current-position markers: GameFlow:343, ActivityFlow:170, MaterialFlow:274, ClocksFlow:155+171, RemainingClocksFlow:191; GameFlow ply ring :484 | position being explored | gold | interaction.selected | **cyan** | Same "now" semantic on charts |
| SidebarTabs active (:59-66); TimelineBand active layer (:225-232) | active navigation | gold-hi | interaction.selected | **cyan** | Active context |
| Selection/active-tool: GameRail active row :208, listRow selected (ui.ts:136), EvidenceDialog selected :441, ImportDialog cards/checkbox :881-892, CommentPopup NAG :91, BoardColumn eraser/palette :229/:431, EngineBox arrows :114 | selection / active tool | gold | interaction.selected | **cyan** | Consistent selected-state language |
| Presenter ring/chip (PresenceStrip:31,159; GameRail:244) | room's current focus | gold | interaction.focus/selected | **cyan** | Presenter = shared focus point |
| Links/interactive text: EngineReadout retry :98, PositionContext view :260, RoomCodeChip hover :37, GameRail add/new hover :291/:299 | interactive accent/hover | gold-hi | interaction.hover/primary-text | **cyan** | DESIGN.md's "accent = interactive text" role, re-colored |
| Tour spotlight outline (Tour.tsx:132) | focus | gold | interaction.focus | **cyan** | Literal focus |
| CommentPopup move label :75; EvidenceCard headline :202 | about-current-position accent | gold-hi | interaction.selected | **cyan** | Labels the explored position/verdict |
| statusDot warn: engine thinking, reconnecting, engine paused (EngineBox:144), viewer listening (RoomView:713); EvalBar sweep :54; TimelineBand analyze progress :266 | processing / warning | gold | status.warning | **status** | Gold doubles as "busy/warn"; must not read as cyan focus |
| ImportDialog partial-skip alert :716-729 | warning | gold | status.warning | **status** | Alert semantics |
| Mistake `?` marks: GameFlow:395/480, MoveList:90, CriticalMoments:133, GameReport:12/79, Board dragMark :608 | move-quality status | gold-hi | status.warning | **status** | Chess annotation ladder (`?`/`??`), not brand |
| ChatPanel author name :66 | identity accent | gold-hi | text.secondary | **neutral** | Presence hues already encode identity; brand overuse |
| BoardColumn opening name :114 | metadata accent | gold-hi | text.secondary | **neutral** | Metadata, not focus |
| BoardColumn terminal result :332 | neutral outcome | gold-hi | text.primary | **neutral** | Result isn't warning or brand |
| Demo chip (RoomCodeChip:77) | mode badge | gold chip | status.info | **status** (info) | Informational, not brand |
| Board last-move `move-from/to` (Board.tsx) | board-related | `#cdd26a/#aaa23a` | board | **keep** | Board explicitly out of scope |
| W/D/B bars, eval gradient, chart series, presence hues | data-viz neutrals | hardcoded | data-viz | **keep** | Not brand gold |
| `gold-dim` token | unused | `#7a641a` | — | drop/repurpose | Dead token |

## 5. Typography & visual primitives

- **Families (centralized, app.css `@theme`):** Open Sans Variable (`--font-sans`, all UI), JetBrains Mono Variable (`--font-mono`: moves, evals, depth, room codes, FEN/PGN, clocks, `kbd`).
- **Scale (centralized):** `micro 11/16, note 12/18, ui 13/20, body 14/22, lead 16/24, display 24/30, hero 36/40`.
- **Patterns (scattered but consistent):** uppercase labels `text-micro font-semibold uppercase tracking-[0.11em] text-muted` (panelHeader, repeated ad-hoc in ~10 files); chips `0.08em`; card headlines `0.06em`; room-code input `tracking-[0.5em]`; wordmark `font-bold tracking-[-0.01em]`. Weights: 600 dominant, 700 for wordmark/badges.
- **Radii (centralized):** `chip 4 / control 6 / panel 10 / dialog 14` + few arbitrary (`rounded-[4px]` checkbox, `rounded-lg` header btns, `rounded-xl` tour).
- **Shadows:** tokens `shadow-panel`/`shadow-board`; hardcoded dialog `0 40px 80px -24px rgb(0 0 0/.9)`, popover `0 24px 48px -16px /.8`, tour scrim `9999px /.72` (candidates for `shadow-dialog`/`shadow-popover` tokens later, not now).
- **Focus rings:** global 2px `gold-hi` outline @2px offset; board squares inset double-ring. **Icons:** inline SVG `currentColor`, no icon lib. **Motion:** `ease-calm` + arrive/pulse/sweep/pop, reduced-motion respected.

## 6. Proposed OpenChessLab token model

Keep the existing short semantic names for surfaces/text/borders (they're already semantic and pervasively used — renaming them would be churn without gain). **Replace the `gold*` family with three families** that mirror its shape (`base / -hi / text-or-ink / muted-wash`), so component edits stay mechanical:

```
brand        navy fill (logo tile, primary button, switch-on)   [brand.primary]
brand-hi     navy hover step
brand-ink    text/icons on brand fills

accent       cyan, AA text/icons on theme surfaces              [interaction.*]
accent-hi    cyan hover / markers
accent-muted cyan washes (selection fills, rings)

warn         amber — absorbs today's gold values                [status.warning]
warn-hi      (today's gold-hi) for marks on dark
```

Mapping to the requested scheme: `surface.*` = `void/surface/panel/raised/overlay`; `text.*` = `ink/muted/faint`; `border.*` = `line/line-strong`; `interaction.focus/selected/hover` = `accent(+hi/muted)`; `interaction.primary` = `brand`; `status.success/error` = existing `ok/bad`; `status.warning` = new `warn`; `status.info` = `info`. Focus ring → `accent`. `ok/bad/info/silver` and all board tokens unchanged.

## 7. Proposed dark palette (graphite surfaces unchanged)

| Token | Value | Notes |
|---|---|---|
| brand | `#3a5a94` | ~6.8:1 with white text; reads as fill on `void` |
| brand-hi | `#4a6ba8` | hover |
| brand-ink | `#f4f6fb` | on-fill text |
| accent | `#45c4e9` | ~8:1 on `surface` |
| accent-hi | `#7ad6f2` | markers/hover |
| accent-muted | `rgb(69 196 233 / 0.16)` | washes/rings |
| warn | `#c9a227` | = today's gold (look preserved) |
| warn-hi | `#d4b13c` | = today's gold-hi |
| surfaces/ink/lines/status/board | unchanged | |

## 8. Proposed light palette (cool paper unchanged)

| Token | Value | Notes |
|---|---|---|
| brand | `#1c3663` | deep navy, ~11:1 with white |
| brand-hi | `#24447c` | hover |
| brand-ink | `#ffffff` | |
| accent | `#0b7285` | ~5.6:1 on white (AA text) |
| accent-hi | `#085a69` | hover |
| accent-muted | `rgb(11 114 133 / 0.12)` | |
| warn | `#8a6d10` | = today's light gold-hi |
| everything else | unchanged | |

(Values are proposals; verify contrast + side-by-side with board colors before freezing.)

## 9. Recommended minimal Phase 2 scope

1. `app.css`: add `brand*/accent*/warn*` for both themes; delete `gold*` once re-pointed (or alias `gold→warn` for one commit).
2. Mechanical class re-point per §4 table: `ui.ts`, `Board.tsx`, `MoveList`, the five chart components, `SidebarTabs`, `TimelineBand`, `GameRail`, `PresenceStrip`, dialogs, `Switch`, `EngineBox`, `BoardColumn`, `ChatPanel` (→neutral), `Tour`.
3. Brand swap: `Logo.tsx` wordmark → "OpenChessLab" + tile → `brand`; `index.html` title; new favicon asset; `en.json` `app.name`/`app.tagline` ("Explore chess. Understand more.")/`update.available`.
4. Update tests asserting brand strings/gold classes (`App.test`, `UpdateBanner.test`, `Analysis.test`, `ClocksFlow.test`, `GameFlow.test`, `RoomView.test`).
5. Update `design/DESIGN.md`/`DESIGN-SYSTEM.md` token tables (docs only).
6. **Do not** rename localStorage keys (orphans user prefs — or add one-time fallback reads), Elixir modules, domains, or the Lichess `client_id` (separate decision; it's user-visible on the consent screen).

## 10. Risks / visual verification

- Navy primary button on dark `void`: affordance needs border/hover tuning — verify next to secondary buttons.
- Cyan volume: ~15 gold sites map to accent; re-check DESIGN-SYSTEM's "one accent fill per surface" rule still holds (move list, tabs, rail, markers can co-occur).
- `warn` amber may still read as "old brand" — optionally nudge toward `#d6a45c` (DESIGN.md's warn) during verification.
- Board's olive last-move squares (`#cdd26a`) sitting beside new cyan markers/selection — verify no clash (board stays unchanged per constraints).
- Light theme: cyan focus ring visibility on light board squares; accent link contrast.
- "OpenChessLab" wordmark is wider than "Blunderfest" — check header at narrow widths (logo `sm`).
- Screenshot pass: home, app bar, move list current move, timeline band, engine box, dialogs, switches, tour spotlight, both themes.
