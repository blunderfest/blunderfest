# Phase 2B Report — Complete Semantic Brand Rollout

## 1. Files changed

**Tokens / primitives**
- `assets/src/app/app.css` — global `:focus-visible` → `accent`; removed dead `gold`, `gold-hi`, `gold-dim`, `gold-text` tokens (both themes)
- `assets/src/components/ui.ts` — button/input/textarea/listRow focus rings → `accent`; button `active` variant → brand; `chip` gold tone replaced by `accent` + `warn` tones; `listRow` selected → accent
- `assets/src/components/Switch.tsx` — on-state → `brand`
- `assets/src/components/Board.tsx` — square keyboard focus ring → `accent`; drag mistake badge `?` → `bg-warn-hi text-void`

**Analysis**
- `MoveList.tsx` — focus ring → accent; `?` mark → `warn-hi`
- `GameFlow.tsx` — current-position marker → `accent`; current-ply ring → `accent`; `?` dots/cells → `warn-hi`
- `ActivityFlow.tsx`, `MaterialFlow.tsx`, `ClocksFlow.tsx`, `RemainingClocksFlow.tsx` — current-position markers → `accent`; current clock bar → `accent`
- `TimelineBand.tsx` — active analytical layer → `accent` (text + underline); analyze progress fill → `warn`
- `BoardColumn.tsx` — opening name → neutral `muted`; terminal result → neutral `ink`; eraser/palette active tools → brand
- `PositionContext.tsx` — view-evidence link → `accent`
- `GameReport.tsx` — `?` → `warn-hi`; accuracy headline → neutral `ink`
- `CriticalMoments.tsx` — `?` → `warn-hi`
- `CommentPopup.tsx` — move label → `accent`; selected NAG → accent
- `EngineBox.tsx` — hint-arrows active tool → brand; engine-paused text → `warn-hi`
- `EngineReadout.tsx` — retry link → neutral `ink`
- `EvalBar.tsx` — thinking sweep → `warn`

**Evidence / import**
- `HistoricalEvidenceDialog.tsx` — selected row border → `accent`; exact-tier badge → accent
- `HistoricalEvidenceCard.tsx` — headline → `accent`
- `ImportDialog.tsx` — header icon → neutral; source tabs active → brand; selected study row → accent; partial-skip alert → `warn`; selected cards/checkboxes/focus → accent (check glyph `text-void` for theme-adaptive contrast)

**Room / shell / tour**
- `PresenceStrip.tsx` — presenter ring → `accent`; presenting chip → accent tone
- `RoomView.tsx` — listening chip → warn tone
- `RoomCodeChip.tsx` — hover → neutral; demo chip → `info` tone
- `ChatPanel.tsx` — author name → neutral `muted`
- `GameRail.tsx` — presenter initials → `accent`; add/new hover → neutral
- `Tour.tsx` — spotlight outline → `accent`

**Tests (only migration-affected)**
- `GameFlow.test.tsx` (`ring-gold` → `ring-accent`), `ClocksFlow.test.tsx` (`fill-gold-hi` → `fill-accent`), `RoomView.test.tsx` (comment wording)

## 2. Completed semantic migration table

| Location | Old role | New role | Token | Rationale |
|---|---|---|---|---|
| Global `:focus-visible`, ui.ts button/input/textarea/listRow, MoveList, Board squares, ImportDialog cards | focus | focus | `accent` | Cyan = explicit focus; board selection/last-move untouched |
| Switch on | brand-ish active | persistent product control | `brand` | Enabled control, not analytical focus |
| Button `active` variant (Added ✓, Following, exists) | gold active | persistent state | `brand` | Stable product state |
| Eraser / palette / hint-arrows active, ImportDialog source tabs | gold active tool | generic tool active | `brand` | Tool-on is brand emphasis; icon stays `ink` for readability |
| SidebarTabs underline (2A) / TimelineBand active layer | gold nav | generic nav vs analytical layer | `brand` / `accent` | Tabs = navigation (navy); timeline layer = focused analytical context (cyan) |
| MoveList current move; chart markers; current clock bar; GameFlow ply ring | gold "now" | current explored position | `accent` | Core cyan semantic |
| GameRail selected row; EvidenceDialog selected + exact badge; ImportDialog selected cards/studies; CommentPopup NAG selected; listRow selected | gold selected | selected analytical context | `accent` | Restrained wash/inset/border, no bright fills |
| Presenter ring/chip/initials | gold | shared current focus | `accent` | Presenter = room's focus |
| PositionContext view link; EvidenceCard headline; CommentPopup move label | gold accent | about-current-position | `accent` | Labels the explored position |
| Tour spotlight | gold | explicit focus target | `accent` | Literal focus |
| statusDot warn; engine paused; EvalBar sweep; TimelineBand progress; ImportDialog partial alert; `?`/`??`-family markers (MoveList, GameFlow, CriticalMoments, GameReport, Board dragMark) | gold status | warning/processing/mistake | `warn`/`warn-hi` | Amber status semantics, never brand |
| ChatPanel author; opening name; terminal result; accuracy number; EngineReadout retry; ImportDialog header icon; RoomCodeChip + GameRail hovers | decorative gold | metadata/incidental | neutral (`ink`/`muted`) | No semantic reason for color |
| Demo chip | gold chip | informational | `info` | Mode badge is informational |
| Listening chip | gold chip | status | `warn` | Waiting/busy status |

## 3. Remaining gold usages

- **None in code.** `gold*` tokens are removed; `rg gold` over `assets/src` matches only a test asserting `bg-gold` absence (`Analysis.test.tsx:1000`).
- **Board olive tokens** `move-from #cdd26a` / `move-to #aaa23a` remain — chessboard last-move semantics, explicitly out of scope (not brand gold).
- **Favicon** `assets/public/favicon.png` is still the old gold knight tile — pending final asset (see §5).
- **Spec docs** `design/DESIGN.md` / `design/DESIGN-SYSTEM.md` still describe the gold palette — documentation update deferred (docs-only, no runtime effect).

## 4. Final token usage summary

- **brand** — logo tile, primary CTA, switch-on, active tools/tabs underline, button `active` variant, import source tabs.
- **accent** — all focus rings (incl. board squares), current move/position markers, selected analytical rows/cards, presenter/shared focus, timeline active layer, analytical links/headlines, tour spotlight, `accent` chip tone.
- **warn** — thinking/paused/reconnecting dots, eval sweep, analyze progress, import partial alert, mistake markers, `warn` chip tone.
- **neutral** — chat authors, opening metadata, terminal results, accuracy stat, retry link, utility hovers.
- **info/status** — demo chip (`info`); `ok`/`bad` unchanged.

## 5. Logo/favicon status

- **Logo: temporary** — Phase 2A treatment (existing knight tile recolored to `brand` navy + "OpenChessLab" wordmark). Final mark pending.
- **Favicon: pending** — old gold tile remains; no new image assets generated per constraints.

## 6. Verification

- `pnpm lint` (biome): clean. `pnpm typecheck`: clean.
- `pnpm exec vitest run --pool=forks`: **60 files / 640 tests passed**. No failures.
- No backend, localStorage, domain, or API changes.

## 7. Visual review checklist

Captured in `screenshots/` (both themes verified):

- `phase2b-home-dark.png` — navy logo/CTA + **cyan keyboard focus ring** on the CTA ✔
- `phase2b-home-light.png` — light brand/focus ✔
- `phase2b-analyzer-dark.png` — current move (cyan), selected GameRail row (cyan inset), active Moves tab (ink + navy underline), timeline active layer (cyan), engine switch + arrows tool (navy), opening name/result neutralized, demo chip info-blue ✔
- `phase2b-analyzer-light.png` — same set in light ✔
- `phase2b-import-dark.png` — dialog: navy Import CTA, cyan textarea focus border, **amber partial-skip warning box** ✔
- `phase2b-import-light.png` — same dialog in light ✔

Still worth a human pass (not easily automatable): engine **thinking** dot + reconnecting (warn, values unchanged), mistake `?` markers after running "Analyze game", keyboard focus **on board squares** over light/dark squares, presenter ring with two live users, tour spotlight, and the light-theme warn box contrast.
