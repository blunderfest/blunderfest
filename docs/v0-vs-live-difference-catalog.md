# v0 vs live — visual difference catalog

Fresh, visuals-only comparison of the v0 wireframe app
(`/home/jeroen/Downloads/blunderfest` — Next.js, `components/wireframe/*`) against the
live app (`assets/src`). Behavior and features are out of scope except where they change
what is visible. v0 file/line references point at the wireframe; live ones at `assets/src`.

Conventions: **v0** = the wireframe; **live** = our app. Sizes in px are computed CSS
(`h-7` = 28px etc.). "Deliberate" marks differences a repo doc/ADR already records as a
decision — they're still listed, because they're visible.

> **Resolved 2026-08-29 (ADR-0034):** §1.1 and §1.2 (the room frame is now full-bleed
> hairline regions, not cards), §5.1's title size (compact `text-lead` heading), §3.5
> (RegionChip is now borderless), and §7 wholesale (the timeline is a single tabbed chart —
> Eval · Material · Activity · Clocks — replacing the layered/stacked/spotlight model). The
> timeline row still lists the *original* difference for the record, but the live side has
> since moved to tabs (neither v0's overlay nor the old stacked cards).

---

## 1. Frame & page layout

| # | v0 | live |
|---|---|---|
| 1.1 | Full-bleed frame: header/rail/dock touch the viewport edges; regions separated by hairlines only (`analysis-room.tsx` root has no padding). | Padded canvas: the room renders inside `p-3 gap-3` (RoomView) with `gap-6` between rail / board / dock — 12px of void around everything. |
| 1.2 | Regions are square-cornered fills with hairline borders, no shadows (DESIGN.md §1 rule 2 "regions, not cards"). | Regions are floating **cards**: `panel()` = `rounded-panel` (10px) + border + `bg-panel` + `shadow-panel` — rail, sidebar tabs content, timeline band are all boxed panels. |
| 1.3 | Desktop breakpoint **lg (1024px)**. | Desktop breakpoint **xl (1280px)** — a 1024–1280px window gets desktop chrome in v0, stacked layout live. |
| 1.4 | Root is `lg:h-svh` — the app is a fixed viewport-height shell. | `min-h-screen` with stable scrollbar gutter; same goal, but page-level structure differs (fixed heights per region derive from `--board-size`). |
| 1.5 | Board column max width 580px, capped by `100svh − 300px`. | `--board-size`: `min(100vw − 4.75rem, 34rem)`; at xl height-driven up to 46rem; sidebar height derives from it. |
| 1.6 | Dock width fixed 400px (`lg:w-[400px]`). | Sidebar 360px at xl, 420px at 2xl. |
| 1.7 | Rail width 224px (`lg:w-56`). | Rail width 260px (`xl:w-[260px]`). |
| 1.8 | Board sizing cap is `580px`; eval bar included in the row's flow. | Board cap 46rem (736px); eval bar out of flow (see §4). |

## 2. Tokens, typography, iconography

Palette values themselves are converged (surfaces, line, ink, gold `#c9a227`, accent
`#d4b13c`, board squares `#e8d9b7/#a97e50`) — the differences left are these:

| # | v0 | live |
|---|---|---|
| 2.1 | Sans = **Inter** (`--font-inter`). | Sans = **Open Sans Variable**. Mono is JetBrains Mono on both. *(Deliberate: PROJECT.md 2026-08-29 — "the mock's Inter is deliberately not adopted".)* |
| 2.2 | Type scale: 2xs 11/16 · xs 12/16 · sm 13/20 · base 14/22 · lg 16/24 · xl 18/26 · 2xl 22/30 · 3xl 28/36. | Scale: micro 11/16 · note 12/18 · ui 13/20 · body 14/22 · lead 16/24 · display 24/30 · hero 36/40. Display is 24 vs 22; hero 36 vs 28; note/ui line-heights slightly taller. |
| 2.3 | Icons: **lucide-react** everywhere (ChevronsLeft, RefreshCw, Eraser, Search, Plus, Sun/Moon, HelpCircle, Map, Keyboard, Download, Bookmark, MessageSquare(Plus), BookOpen, ChevronDown, Radio, GitBranch…). | Icons: hand-rolled inline SVGs for some (nav polygons, import/new, export, bookmark, search-plus, engine arrow) and **text/emoji glyphs** for others: `⇅` flip, `💬` comment, `✎` edit, `⌫` clear/eraser, `×` delete/close, `⚠`, `⏳`. |
| 2.4 | Tooltips: custom CSS tooltips (`.tip`/`data-tip`) — styled surface-3 chip, 11px, 350ms delay, positioned above/below. | Native `title` attributes almost everywhere (browser chrome); only HelpPopover is a styled popover. |
| 2.5 | Focus ring: 2px accent ring, 2px offset. | Same idea (`outline-gold-hi` 2px/2px + chip radius). Converged. |
| 2.6 | Presence hues: fixed 6-hue palette, avatars are **solid hue fill + dark initials**; self is always brand gold. | Per-member hash-derived HSL: **dark-tinted bg + light same-hue text**; self not specially colored. |
| 2.7 | `accent-muted` wash token (`gold/14%`) drives selected states. | No single token; selection expressed ad hoc as `bg-gold/10`, `bg-gold/20`, `bg-gold/25`, `bg-gold/12` per component. |

## 3. Top bar / chrome

| # | v0 | live |
|---|---|---|
| 3.1 | Fixed `h-12` bar, `px-3 gap-3`, no wrap. | `py-2 px-4`, `flex-wrap`, height grows with content/wrap (~49px+). |
| 3.2 | Logo: 28px gold tile with the **bN.svg piece image**, wordmark "Blunderfest" in one ink color, `text-sm font-semibold`, hidden under `sm`. Not a link. | Logo: 24px tile with the custom knight-? SVG, **two-tone wordmark** ("Blunder" ink + "fest" gold), text-ui, always visible. It's the home link. |
| 3.3 | Room title in the bar: "Thursday study hall · 3 boards" (ink-2 + ink-3 count), after a hairline divider. | No room/game title in the bar. Instead: **room code chip** (mono, bordered, copies on click, copy→✓ animation) + "Boards · N" text-note subtitle. *(Deliberate: ADR-0032.)* |
| 3.4 | Gold **"Share room"** primary button (h-7, hover brightness). | None — the code chip is the share affordance. |
| 3.5 | Connection telemetry: **borderless** mono text `● AMS→CHI 96ms` (11px, ink-3), "→" separator, no "ms" spacing. | RegionChip: **bordered chip** (rounded-chip border-line), uppercase, "↔" separator, lag as faint suffix "96 ms", dot 6px. |
| 3.6 | Presence stack: 20px avatars, 3 shown + "+1" **circle** (surface-2), border surface-1, not interactive in the mock. | PresenceStrip: 28px avatars, 4 shown + "+N" plain text, border-line, presenter gets gold ring + `ring-gold/35`; the whole strip is a button opening a popover. |
| 3.7 | Theme toggle: borderless `tb-btn` (28px), lucide Sun/Moon, dark↔light only. | Bordered rounded-lg 7×7 button, custom SVGs, **three states** (system → light → dark; monitor icon for system). |
| 3.8 | Help menu: borderless icon button; menu items have **icons** (Map, Keyboard) and a trailing `kbd` `?` chip. | Bordered rounded-lg button; menu items are plain text, no icons, no kbd. |
| 3.9 | No account affordance in the bar. | AccountMenu: the fun name as a quiet text button (hidden under md) opening the identity menu. |
| 3.10 | No update banner. | UpdateBanner: fixed bottom-center panel toast when a deploy lands. |
| 3.11 | (DESIGN.md §2.3: read-only demo = 32px banner under the bar — not built in the wireframe either.) | Demo badge = gold chip next to the code chip. |

## 4. Games rail

| # | v0 | live |
|---|---|---|
| 4.1 | Rail bg = canvas (`surface-0`), only a right hairline; no card. | Rail = panel card (rounded, border, bg-panel). |
| 4.2 | Header: "BOARDS · N" 10px uppercase + one **plus** button (add/import). | Header: "BOARDS · N" 11px uppercase + **two** icon buttons (import + new game). |
| 4.3 | Row: rounded-**8px** bordered card on every row (border-line, bg-surface-1); active = **accent border** + surface-2 + **2px gold left-edge bar**. | Row: rounded-6px, inactive rows **borderless** (transparent); active = `border-gold-hi/60` + `bg-gold/10`; **no left bar**. |
| 4.4 | Row shows live **eval** (mono 10px, good/bad/ink-2 colored) top-right. | No eval; result **chip** (outline, uppercase) bottom-right when the game is finished. |
| 4.5 | Sub-line: "Giuoco Pianissimo · move 11" (10px ink-3). | Sub-line: Opening or ECO header only (11px faint). |
| 4.6 | Position games: `position` chip = tiny filled surface-3 tag, 9px. | Position chip = outline-style uppercase chip (bigger). |
| 4.7 | Rows show **viewer avatars** (16px overlapping circles) for who's on each board. | No per-game viewers; only a **presenter initials** circle (gold text, 16px, border). *(Live presenter marker was added in the convergence pass.)* |
| 4.8 | No per-row management affordances. | Hover **× remove** button (top-right, reserved slot), double-click inline **rename** input. |
| 4.9 | Mobile strip: one dashed "Add game" tile (w-28, plus icon + label). | Mobile strip: **two** dashed tiles (Add game, New game), w-28 each. |
| 4.10 | Empty rail: nothing specced (list just short). | Empty rail: "No games yet" hint text (desktop). |

## 5. Board column

| # | v0 | live |
|---|---|---|
| 5.1 | Game header is a **compact 36px row** (h-9, border-b): 13px semibold label + 12px muted sub. | Title row is a **big display heading**: `text-display` (24px) bold "White – Black". |
| 5.2 | Header right: "3 watching this board / only you here" (11px ink-3), hairline, then **labeled** buttons "⬇ PGN" / "🔖 Save" (11px semibold, labels hidden below xl). | Title row right: side-to-move chip, result text, then **icon-only** ghost buttons (export, bookmark). No watcher count anywhere. |
| 5.3 | No side-to-move indicator. | STM **chip** in the title row (bordered, uppercase micro, white/black dot) **plus** an STM **edge strip**: a 4px white/ink line on the mover's board edge. |
| 5.4 | No opening line under the header (the sub in the header row carries "Giuoco Pianissimo · move 11", ink-3). | Dedicated meta line under the title: `ECO · Opening · 5... d6` in **gold** semibold (fixed height). |
| 5.5 | Board: rounded-**4px**, `border-line-strong`, no shadow. | Board: rounded-**6px**, border-board-edge, **`shadow-board`** (large soft drop shadow). |
| 5.6 | Last-move: **gold wash** (`rgb(201 162 39/.45)`) over both squares. | Last-move: **solid lichess-style fills** — from `#cdd26a`, to `#aaa23a` (greenish). |
| 5.7 | Selected square: gold wash (`.65`). | Selected: solid blue-ish fills (`#cfe0ff`/`#7f93b8`) + blue inset ring (`--color-select #6ea8fe`); keyboard focus ring is gold inset. |
| 5.8 | Check: flat red wash (`.60`). | Check: **radial red gradient** blob. |
| 5.9 | Coordinates: 9px mono, one brown tone (`rgb(60 42 20/.55)`) on both shades. | Coordinates: 10px semibold sans, **shade-contrasting** (dark-square color on light squares and vice versa). |
| 5.10 | Eval bar: **16px** wide, in flow beside the board, flat halves (`#e8e6df` / `#3a3d44`), rounded-4 border, score "+0.4" in 8.5px mono **under** the bar, in the bar's column. Always rendered in the mock. | Eval bar: **24px** wide, absolutely positioned **outside** the board's left edge (slot reserved by margin), white half is a **gradient** (`#f4f6fb→#c9cedb`), black `#1a1d24`, hairline midline, score badge **floats at the split point** inside the bar (10px, panel-chip with backdrop blur), gold sweep animation while thinking, dimmed "?" on error. Only rendered when the engine is on. |
| 5.11 | Toolbar: one centered row **directly under the board**, width = board: nav cluster ⏮ ◀ `70/70` ▶ ⏭, hairline dividers, flip, divider, 4 draw swatches + eraser, divider, find-examples. All 28px borderless `tb-btn`s. Ply counter is **mono 11px**. | Toolbar: full-width row (`max-w board+3.25rem`), `justify-center gap-x-3`: nav cluster = **bordered secondary 32px** buttons + ply counter "ply N/M" in **sans 13px muted**; board controls = ghost 32px buttons with text glyphs (`⇅ 💬 ✎` + custom search-plus SVG); draw swatches 20px solid circles; **no hairline dividers** between groups. Terminal status ("Checkmate" etc.) rides the row in gold. |
| 5.12 | Draw colors = presence palette + red: `#5f9edb / #58a86c / #c77fce / #d96c66`. | Draw colors: `#3b82f6 / #4caf50 / #a855f7 / #e05a4e`. (Nearly the same idea, different hexes; v0's green/purple are the presence hues.) |
| 5.13 | Swatch picked state: `scale-110` + 2px **ink** ring, 1px offset. Eraser = eraser **icon**. | Picked state: `scale-110` + 2px ink ring, 2px offset. Clear = `⌫` glyph. |
| 5.14 | **Annotation strip**: a fixed-height (44px) always-reserved slot under the toolbar showing the current move's comment — author avatar + name + 2-line clamp text + edit button; empty state = ghost "Comment on this move" affordance. | No strip. A comment renders as a **panel bubble** under the toolbar only when one exists (no avatar/author). Editing opens the CommentPopup **modal** (NAG picker + textarea), also on `c`. |

## 6. Dock / sidebar

| # | v0 | live |
|---|---|---|
| 6.1 | Dock = surface-1 region, left hairline, square corners; tabs Moves · Review · Chat · **Room**. | Sidebar = panel card; tabs Moves · Review · Chat — **no Room tab**. *(Deliberate: ADR-0032; v0 kept it.)* |
| 6.2 | Tab bar: 36px row, labels **12px** uppercase 600 `tracking-wide`; active = accent text + 2px accent **underline inset by 8px**; inactive ink-2. | Tab bar: auto height (`py-2`), labels **11px** uppercase `tracking-[0.11em]`; active = gold-hi text + full-width 2px **bottom border** gold; bar bg `surface/70`. |
| 6.3 | Chat unread badge: **brand-gold pill** with dark mono number. | Chat unread badge: **info-blue** chip (`bg-info/15 text-info`). |
| 6.4 | Tab contents presumably remount (mock). | All tab contents stay mounted/hidden (no visual difference at rest). |
| 6.5 | **Engine box**: separate raised card (`rounded-10 border surface-2`, m-2) pinned above the moves. Header: "ENGINE" + warn pulsing dot + "Depth 21" + static mono "PV 3" text + 16×28px switch (knob surface-1). | Engine box: **not a card** — a section of the Moves panel with hairline below. Header: "ENGINE" + status dot (green/amber pulse/red/idle) + "· Depth 21" + **lines `<select>` (1–3)** + hint-arrows toggle button + 20×36px switch (gold when on, white knob). |
| 6.6 | Engine lines: mono 13px rows, score badge = **tinted translucent** (green/red 15%), hover reveals ↗ icon. | Engine lines: 28px rows, score badge = **solid** near-white/near-black chip with border; PV in sans with tabular-nums (not mono); no ↗ icon (whole PV is the click target). |
| 6.7 | No WDL bar. | **WDL bar** under the lines (6px, 3 segments white/gray/dark) when the engine reports it. |
| 6.8 | Engine off: body shows "Engine off" note row. | Engine off: body renders **nothing** (header only). |
| 6.9 | No analyze action in the engine box (it's all in the timeline header). | "Analyze line / Re-analyze" quiet block button at the box's bottom when applicable. |
| 6.10 | **Move list**: strict two-column **table** — number column (w-8) + white/black cells at fixed 50%, 32px rows, mono 13px; current move = accent-muted fill + semibold; NAG glyphs colored; comment = trailing MessageSquare **icon**; sticky "Mainline" breadcrumb row (28px mono) on top. | Move list: **flowing flex rows** — white+black pairs wrap inline, numbers inline in faint, current move = `bg-gold/20` + **gold text + gold ring**; per-move **eval values** (micro faint) after each move; comment = **blue dot** marker + the comment itself rendered as an italic full-width line; book-exit info icon; no breadcrumb row — instead a "← path" **back-to-mainline pill** appears above the list only when off-mainline. |
| 6.11 | Variations: nested block, 2px line rail, muted 12px, depth ≥3 collapses to "(+2 more)" accent link. | Variations: nested bordered blocks (line-strong → line), indent **capped at one level** (deeper nests share it); no collapse link. |
| 6.12 | **Book**: phase-aware boxed card above the moves — "OPENING BOOK · 96 563 games" collapsible header; rows = move + variation name + game count + **W/D/B percentage bar** (3 segments with % labels); middlegame = one quiet "Out of book since move 9" line; endgame = endgame book with win/draw/loss outcome chips. | **Position context** section under the move list (fixed h-64, sticky "POSITION CONTEXT" header): book rows = SAN + "ECO · name" only — **no counts, no W/D/B bars, no phase awareness, no endgame book**; out of book = find-historical-evidence CTA / remembered DecisionMenu summary + "View →". |
| 6.13 | **Review** sub-tabs: Moments | Report | Game info (11px uppercase, accent underline). Moments = bordered cards (rounded-10 surface-2) with **56px** mini board, move+NAG, swing "+0.3 → +0.7" mono, label line, "Best:" line in green. | Same three nested tabs (same tab styling as the top level). Moments = **borderless rows** (hover bg-raised) with **88px** live mini boards (same Board component), move+mark, swing faint, best move muted. |
| 6.14 | Report: accuracy cards = gap-px grid cells (surface-2), big mono % colored per tone (green 91% / warn 84%), tally mono 10px; mistakes = **table** with Move/NAG/Best columns. | Report: accuracy cards = bordered surface boxes, name line + **gold** 16px % + tally micro; mistakes = **list rows** (move+mark · swing · best right-aligned). Header line "1-0 · C57 · Two Knights" above. |
| 6.15 | Game info: dl `[auto 1fr]` — labels ink-3, values **mono** ink-2; includes **Source** row. | Game info: 2-column dl — labels faint, values **sans** ink; no Source row. |
| 6.16 | **Chat**: avatar (20px hue circle) + name 12px semibold + **timestamp** mono 10px + text 13px/20; input = lone 32px rounded-6 field (border line-strong, bg surface-0), Enter to send, no Send button. | Chat: **no avatars, no timestamps** — gold name inline + text 13px; input row = field (transparent bg) + **Send button** (secondary sm); viewer state = "read-only" note. |
| 6.17 | **Room tab**: "4 IN THIS ROOM" + member rows (24px avatars, owner = 1.5px accent ring + Radio icon, viewer = 55% opacity, role text right) + connection footer "you: Amsterdam · room: Chicago · 96 ms" (mono, dot). | No Room tab. Members = the header **presence popover**: 28px avatars, role shown as **cburnett piece icons** (king/knight/pawn), "Presenting" gold chip, Follow / make-presenter `⇢` / promote-demote buttons. Connection detail lives in the RegionChip tooltip. |

## 7. Timeline

| # | v0 | live |
|---|---|---|
| 7.1 | Strip bg surface-1, top hairline — part of the frame. | Strip = panel card (rounded, border, shadow). |
| 7.2 | Header row: chevron + **"Timeline" label**, hairline, then state area. | Header row: chevron **icon button only**, no "Timeline" label. |
| 7.3 | Layer toggles are **inline chips always visible** once analyzed: label + layer-colored swatch line; active = accent-muted bg + accent text; **multi-select**, toggling never changes height. | Toggles hidden in a **"Layers" popover** (checkbox chips, bordered); collapsed strip instead shows **radio dots** (one per layer, fixed order) picking the single charted "spotlight" layer. |
| 7.4 | Expanded chart: **one** SVG (96px) with all active layers **overlaid** on a shared ±1 scale, transparent background, midline hairline. | Expanded: **stacked** layers, each its own chart at **144px** with a caption row (dot + uppercase label + legend); each chart is a **dark boxed card** (`#1a1d24` bg, border, rounded-6). |
| 7.5 | Layer hues: Eval = **green** (`--bf-good`) area+line · Material = **blue** dashed · Activity = **purple** · Clocks = **gray** solid/dashed lines. | Layer hues: Eval = **near-white** `#f4f6fb` area · Material = **silver** `#b6bdcc` · Activity = **blue** `#6ea8fe` · Clocks = white/silver per-side **bars**. |
| 7.6 | Collapsed: the row keeps an **inline 24×96px sparkline button** in the header (eval line + blunder dots + cursor). | Collapsed: a 40px strip chart **below** the header (p-2 body), spotlight layer only. |
| 7.7 | Blunder dots (red) always on the chart; **comment ticks** (blue) along the bottom edge; phase shading via ink washes. | No blunder dots on charts (marks live in tooltips/move list); no comment ticks; phase shading present (info/10 opening, white/5 endgame) + dashed endgame boundary; **capture markers** (piece images at the top edge, exchanges ringed) — v0 mock has none. |
| 7.8 | Current-ply readout "5...d6" mono at the row's right + "· Re-analyze" as an **accent text link**. | No ply readout in the strip; "Re-analyze" = quiet xs **button**, right side. |
| 7.9 | Pre-analysis: inline "Not analyzed yet" + gold accent "Analyze game" chip in the row; expanded area shows a **dashed placeholder** with CTA; progress = "Analyzing…" + 112px bar + mono %. | Pre-analysis: eval layer wears a small gold dot marker; analyze action = quiet button in header; progress = 64px fill bar, no %; placeholders are plain centered text. |
| 7.10 | No help affordance. | HelpPopover "?" in the strip header. |

## 8. Find-examples dialog

| # | v0 | live |
|---|---|---|
| 8.1 | **List + detail** layout: 880px dialog; left results list (280px, scrollable) + right detail pane. | **Carousel**: 640px dialog; one candidate at a time (board + card), prev/next footer. *(Live is ADR-0030's carousel; v0's list+detail is the deliberate redesign of it — DESIGN.md §12.2.)* |
| 8.2 | Header: book icon + "Historical examples" 13.5px + help button + mono meta "17 examples · 876 ms" right + X. | Header: "Historical examples" 16px + HelpPopover + X; counts + ms on a centered line **below** the header. |
| 8.3 | Result rows: players + ECO + **colored result** (1-0 green / 0-1 red / ½ gray) + **tier badge** ("Same position" accent / "Same route" info / "Similar" neutral) + "N games · N plies"; active row = gold left border + surface-2. | No list, no tier badges, no result coloring (ECO · result in muted mono in the card header). |
| 8.4 | Detail: 128px mini board beside the facts; **Position comparison table** with green ✓ on exact rows / warn on off rows; Continuation plans White/Black mono rows; "Comparison details" disclosure (typed differences bullet list + per-side similarity mono lines). | Detail: 220px board **above** the card; card = gold uppercase **headline sentence**; Position facts as same/different rows (no ✓ marks); extra **Route** section; Continuation per side **with verdict lines** ("followed the most common continuation"); Historical count line; details disclosure with left-border indent. |
| 8.5 | Footer of the detail pane: **primary gold "Add as variation"** + secondary "Add to room" + explainer note right. | Actions inside the card, **both secondary** (fixed-width labels, active state = gold-wash when added). |
| 8.6 | Pager in detail footer: "‹ Prev · 3 of 12 (mono) · Next ›". | Pager as the dialog's bottom bar: bordered sm buttons "← Previous / Next →" + counter. |
| 8.7 | No decision menu (predates product experiment 01). | **DecisionMenu** ("What did White play here?" + move/count rows + "Show N more") between header and carousel. |
| 8.8 | Scrim: `black/50` + 2px backdrop blur; dialog surface-1, radius-14, shadow-2xl. | Scrim: `black/60`, no blur; dialog bg-surface, radius-**10**, `shadow-panel`. |

## 9. Import dialog

| # | v0 | live |
|---|---|---|
| 9.1 | Sources: **Paste PGN · Fetch games · Position** — tab row with **icons** (ClipboardPaste, Globe, LayoutGrid), accent underline. | Sources: **Paste · My Lichess studies · Lichess games · Chess.com** (tabs only render when Lichess-linked) — **chip-style** bordered buttons, no icons. No Position/FEN source (position setup is the in-room editor). |
| 9.2 | 560px wide, max-h 560px, radius-14, surface-1. | 640px wide, max-h viewport−32px, radius-14, **bg-overlay**, top-aligned (mt-16) rather than centered. |
| 9.3 | Pasted/fetched games = **checkbox checklist** (custom accent checkboxes, result colored) — pick which become boards; footer "Add N boards". | Paste path imports **everything parsed** (multi-game preview is a plain list, no per-game pick); Lichess/Chess.com lists use **native checkboxes**. Footer: Cancel + primary "Import". |
| 9.4 | "Remove on import" strip options (checked = strip; default strips engine annotations only) as checkbox cards. | "Keep on import" cards (checked = **keep**; default keeps all but evaluations) — inverted labels, custom gold checkboxes, only rendered for applicable content. |
| 9.5 | No preview card — the checklist is the preview. | Single-game **preview panel**: players with color swatches, result, event·date, plies/nodes/variations stats, source chip ("pgn"/"lichess"/…), "Valid" ok-chip. |
| 9.6 | Footer note: "Each picked game becomes a board on the wall" (right side). | Footer note: "shared with the room · Esc to cancel" + kbd (left side). |
| 9.7 | No sample. | "Use sample" ghost button fills a demo PGN. |
| 9.8 | Scrim black/50 + blur; header 44px with 13.5px title + X icon button. | Scrim void/75 + blur; header py-3 with 16px title + upload icon + ✕ ghost. |

## 10. Smaller dialogs & overlays

| # | v0 | live |
|---|---|---|
| 10.1 | Comment editing: not implemented in the mock (the annotation strip's edit button is inert); DESIGN.md specifies a modal with NAG picker titled with the move. | CommentPopup modal: header + **gold move label**, NAG row, textarea, Save/Cancel. Matches the spec shape; styling is live's overlay language (bg-overlay, radius-14, top-offset mt-24). |
| 10.2 | Shortcuts dialog: not implemented in the mock; DESIGN.md §6.6: two-column table, keys as level-2 mono chips. | Implemented: two groups (Global/Board), action left / kbd chips right, divide-y rows. |
| 10.3 | Guided tour: DESIGN.md §2.3 only (spotlight + accent ring). | Implemented Tour overlay. |
| 10.4 | No help popovers (only a static help icon in the examples header). | HelpPopover "?" components (timeline, evidence dialog) — portaled, z-60/70. |
| 10.5 | Menus/popovers: radius-10, surface-3, `shadow-lg`. | Popovers: radius-**6** (rounded-control), bg-overlay, heavy custom shadow `0 24px 48px`. |

## 11. Mobile / narrow layout

| # | v0 | live |
|---|---|---|
| 11.1 | Dock on mobile: content area `h-80` + **sticky bottom tab bar** (56px, underline on top of active tab). | Sidebar on mobile: a fixed-height panel (`h-[52dvh]` → 46dvh) **with tabs on top**, stacked below the timeline; no bottom bar. |
| 11.2 | Mobile order: rail strip → game header → board(+toolbar, comment strip) → timeline → dock panel → bottom tabs. | Mobile order: rail strip → title/meta → board → toolbar → comment → timeline → sidebar. |
| 11.3 | (DESIGN.md §2.2: horizontal move strip above the toolbar — not implemented in the mock.) | No move strip either. Converged by omission. |
| 11.4 | Mobile add tile: one dashed tile. | Two dashed tiles (Add game / New game). |
| 11.5 | Header on mobile: condensed but single-row (elements hidden responsively). | Header wraps (flex-wrap) — chips/presence can wrap to a second line. |

## 12. Room states

| # | v0 | live |
|---|---|---|
| 12.1 | Empty room: **start position on the board at 60% opacity** + a dock panel ("No game yet", Import primary, blank-board quiet). | Empty room: no board — centered CTA **card** (pawn in a circle, "No game yet" display heading, Import primary + New game secondary) + slim chat-only sidebar. |
| 12.2 | Joining: skeleton board (shimmering squares) + disabled tabs + spinner row. | Joining: centered "Connecting…" line with pulsing warn dot (no skeleton board). |
| 12.3 | Not found: full-screen, mascot, room code in mono, "This room doesn't exist" + Create primary / Go home quiet. | Not found: centered card — ⚠ in a circle, heading, the code in a tracking-[0.5em] box, one secondary "Back home" button. |
| 12.4 | Demo room: (spec'd banner, not built). | Gold "demo" chip next to the code chip; editing controls hidden/disabled. |

## 13. Home screen (spec-only in v0)

The wireframe app has **no Home** (`page.tsx` renders the analysis room directly); DESIGN.md
§6.1 specifies one. Comparing that spec to live Home:

| # | v0 spec | live |
|---|---|---|
| 13.1 | One centered column, max-w **560px**: wordmark row (tile + "Blunderfest" 28px + tagline) → **single primary panel** (Create full-width + "No account needed" + hairline + 5-slot mono code input with auto-advance + Join inline) → import box (textarea + detected-format chip) → quiet links row (demo · Library · Sign in with Lichess) → status footer. | Hero (lg logo + tagline) → **two panels side by side** (Create / Join, max-w-3xl) → library panel (only when entries exist) → status line → demo button. No import box on Home; no 5-slot code input (single mono input, 0.5em tracking); no Lichess sign-in link. |

---

## What already matches (no action needed)

- Dark/light palette values: surfaces, lines, inks, brand `#c9a227`, accent `#d4b13c`, semantics, board squares (2026-08-29 token convergence).
- Three-region IA: rail left, board center, dock right; rail header with count; tabbed dock with chat badge; timeline strip under the board owning the analyze job (incl. progress fill); Reference folded into Moves.
- Region chip + tooltip telemetry; room code as header chrome; presence as header chrome.
- Modal grammar (scrim + Esc + backdrop close, radius-14 dialogs), NAG colors, W/D/B bar concept in the book rows vs WDL bar in engine box.
