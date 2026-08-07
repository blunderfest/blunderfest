# Blunderfest Design System

> A collaborative chess analysis web app — "lichess/chess.com analysis board
> meets Google Docs." One person starts a game, shares a 5-letter room code,
> and everyone analyses the same board together in real time: moves, nested
> variations, comments, cursors, and a chess-engine eval bar, all synced live.

---

## Table of Contents

1. [Visual Direction](#1-visual-direction)
2. [Typography](#2-typography)
3. [Spacing, Radii, Elevation](#3-spacing-radii-elevation)
4. [Logo & Wordmark](#4-logo--wordmark)
5. [Screen Designs](#5-screen-designs)
6. [Component Specs](#6-component-specs)
   - [Buttons](#buttons)
   - [Inputs & Textareas](#inputs--textareas)
   - [Chips & Status Dots](#chips--status-dots)
   - [Board Squares](#board-squares)
   - [Eval Bar](#eval-bar)
   - [Engine Readout](#engine-readout)
   - [Move List](#move-list)
   - [List Rows](#list-rows)
   - [Panels](#panels)
   - [Avatars](#avatars)
   - [Comment Editor](#comment-editor)
   - [Import Dialog](#import-dialog)
7. [Micro-Interactions](#7-micro-interactions)
8. [Layout & Extensibility](#8-layout--extensibility)
9. [Accessibility Contract](#9-accessibility-contract)
10. [Token Reference Table](#10-token-reference-table)

---

## 1. Visual Direction

### Philosophy

Blunderfest is playful in name but calm and precise. Chess-study energy:
focused, a little nerdy, collaborative. The fun lives in small places (generated
player names, a mascot-ish knight in the logo), never in the analysis surface.

**The board is the hero.** It is the only element allowed high-chroma,
high-value colour. Everything else is neutral panels, one gold accent for
"this is active / this is yours", blue for "someone else is here", and
red/green reserved for evaluation and errors.

### Colour Palette

All tokens are declared via Tailwind v4 `@theme` in `globals.css` and available
as utilities (`bg-panel`, `text-muted`, `border-line`, etc.).

#### Surfaces (elevation steps, dark → light)

| Token           | Hex       | Role                              |
| --------------- | --------- | --------------------------------- |
| `void`          | `#0b0d11` | Page backdrop behind everything   |
| `surface`       | `#14161b` | App surface, header               |
| `panel`         | `#191c23` | Panel fill, +1 step               |
| `raised`        | `#1f232c` | Rows, inputs, hover fill, +2 step |
| `overlay`       | `#232833` | Dialogs / popovers, +3 step       |

#### Hairlines

| Token          | Hex       | Role                            |
| -------------- | --------- | ------------------------------- |
| `line`         | `#262a33` | Default 1px panel border        |
| `line-strong`  | `#363c48` | Dividers that must read at a glance |

#### Ink (text)

| Token    | Hex       | WCAG on `surface` | Role                              |
| -------- | --------- | ------------------ | --------------------------------- |
| `ink`    | `#e8eaf0` | 14.4:1             | Primary text                      |
| `muted`  | `#9aa1b0` | 6.9:1              | Secondary text                    |
| `faint`  | `#737b8b` | 4.1:1              | Tertiary / metadata ≥16px or non-essential |

#### Brand + Semantics

| Token     | Hex       | Role                                       |
| --------- | --------- | ------------------------------------------ |
| `gold`    | `#c9a227` | Accent: owner, brand, active               |
| `gold-hi` | `#e8c14f` | Accent text on dark (7.6:1)                |
| `gold-dim`| `#7a641a` | Muted gold for gradients                   |
| `ok`      | `#4caf50` | Positive / saved                           |
| `ok-hi`   | `#7ed081` | Lighter ok                                 |
| `bad`     | `#e05a4e` | Negative / errors                          |
| `bad-hi`  | `#ff8a7d` | Lighter bad                                |
| `info`    | `#6ea8fe` | Presence / links / "someone else did this" |
| `silver`  | `#b6bdcc` | Collaborator role icon                     |

#### Board

| Token          | Hex       | Role                        |
| -------------- | --------- | --------------------------- |
| `board-light`  | `#f0d9b5` | Light square                |
| `board-dark`   | `#b58863` | Dark square                 |
| `board-edge`   | `#2a2e38` | Outer board border          |
| `move-from`    | `#cdd26a` | Last move, light square     |
| `move-to`      | `#aaa23a` | Last move, dark square      |
| `select`       | `#6ea8fe` | Selected square ring        |
| `check`        | `#e05a4e` | King in check glow          |

#### Colour Rules

- **Gold** is rationed: exactly one gold fill per surface (current move in the
  list, primary button). The board keeps all the chroma.
- **Blue** (`info`) means "someone else did this" — presence dots, remote
  cursors, author attribution.
- **Green** and **red** are reserved for the eval bar and errors/validation.
- Elevation is always border + fill, never shadow-only: panel = 1px `line` +
  `bg-panel` + a 1px inset top highlight; dialogs add a long soft drop shadow
  and `bg-overlay`. No coloured glows near the board.

---

## 2. Typography

**Font:** Open Sans, weights 400 / 600 / 700. Loaded via `next/font/google` with
`display: "swap"`. CSS variable: `--font-open-sans`.

**Monospace fallback:** `ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace`
(used for PGN fields, room codes, eval numbers).

| Name     | Size   | Line Height | Weight     | Utility  | Use                                 |
| -------- | ------ | ----------- | ---------- | -------- | ----------------------------------- |
| `hero`   | 36px   | 40px        | 700        | `text-hero` | Home wordmark only                |
| `display`| 24px   | 30px        | 700        | `text-display` | Screen titles                  |
| `lead`   | 16px   | 24px        | 600        | `text-lead` | Panel headings, eval readout     |
| `body`   | 14px   | 22px        | 400        | `text-body` | Comments, prose, inputs          |
| `ui`     | 13px   | 20px        | 400–600    | `text-ui` | Dense UI default, move list, rows |
| `note`   | 12px   | 18px        | 400        | `text-note` | Metadata, activity feed          |
| `micro`  | 11px   | 16px        | 600 caps   | `text-micro` | Panel titles, chips, role labels |

Notation always uses **tabular figures** (`font-variant-numeric: tabular-nums`,
utility: `.tnum`) so move numbers and evals never jitter while updating.

---

## 3. Spacing, Radii, Elevation

### Spacing Scale

```
4 · 6 · 8 · 12 · 16 · 24
(gap-1 … gap-6 in Tailwind)
```

- Panel gutter: 12px
- Room grid gap: 12px
- Panel padding: 10–12px
- Dialog padding: 16px

### Radii

| Name      | Value  | Tailwind    | Use                                       |
| --------- | ------ | ----------- | ----------------------------------------- |
| `chip`    | 4px    | `rounded-chip`    | Chips, small badges, variation parens  |
| `control` | 6px    | `rounded-control` | Buttons, inputs, move tokens, rows     |
| `panel`   | 10px   | `rounded-panel`   | Panels, cards, sections                |
| `dialog`  | 14px   | `rounded-dialog`  | Import dialog, modals                 |

### Elevation

Panels use **two shadow layers** for subtle depth:
```
shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]
```
- Inset 1px top highlight: barely visible but creates materiality.
- Drop shadow: long, soft, dark — creates separation from the void backdrop.

Dialogs add:
```
shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]
```

The board itself has:
```
shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]
```
and a `border-board-edge` outer border.

**No coloured glows anywhere near the board.**

---

## 4. Logo & Wordmark

### Mascot

A **gold knight tile** with a small red **"?!"** badge in the top-right corner.
The mascot is a knight caught mid-blunder — the badge drops below 20px rendering.

- Tile alone = the favicon/app icon.
- Tile + wordmark = the full logo.

### Wordmark

"**Blunder**" in `ink` + "**fest**" in `gold-hi`. Sizes:

| Size  | Tile  | Text     | Use              |
| ----- | ----- | -------- | ---------------- |
| `sm`  | 24px  | `text-ui` (13px) | Header       |
| `md`  | 32px  | `text-lead` (16px) | Panel header |
| `lg`  | 48px  | `text-hero` (36px) | Home page   |

---

## 5. Screen Designs

### 5.1 Home (`/`)

```
┌─────────────────────────────────────────────────────────┐
│ [Knight?!] Blunderfest              [Library] [Design]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Knight?!] Blunderfest                                 │
│  Analyse chess together in real time. One board, one    │
│  variation tree, everyone's cursor — plus an engine     │
│  that never stops second-guessing you.                  │
│                                                         │
│  [Shared variation tree] [Per-move comments] [Engine] … │
│                                                         │
│  ┌─ Start a study ─────────┐  or  ┌─ Join with a code ─┐│
│  │ Creates a room, makes   │      │ Someone shared five ││
│  │ you the owner, hands    │      │ characters? Drop    ││
│  │ you a code to share.    │      │ them in.            ││
│  │                         │      │                     ││
│  │ [ Create a room     ]   │      │ Room code           ││
│  │ ⌘ No account needed.   │      │ [ qh4nx        ]    ││
│  └─────────────────────────┘      │ 5/5 characters      ││
│                                   │ [ Join room      ]   ││
│                                   └─────────────────────┘│
│                                                         │
│─────────────────────────────────────────────────────────│
│ You are [Brave Otter 42] ♘ anonymous ·  [●] backend ✓  │
└─────────────────────────────────────────────────────────┘
```

- Room code: exactly 5 lowercase chars from `abcdefghjkmnpqrstuvwxyz23456789`
  (no `i`, `l`, `o`, `0`, `1`). Live character counter. Error state shows
  which characters are disallowed and why.
- Anonymous identity: cookie-minted `bf_uid` + `bf_name` by middleware.
  Displayed with a collaborator glyph. Remembered on this device.

### 5.2 Room (`/room/[code]`) — Desktop ≥1280px

Three-column layout, **no page scroll**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [K] Blunderfest │ Untitled study · Carlsen – Nepo │ Library │ code qh4nx ⧉ │ 🟢 Brave Otter 42 ♔ │
├────────┬──────────────────────────────────────────┬──────────────────────────┤
│        │                                          │ Comment                  │
│ Games  │    ┌─ eval bar ─┐                        │ 4. Nc6                   │
│ (2)    │    │            │  ┌──────────────────┐  │ ┌──────────────────────┐ │
│────────│    │  ▓▓▓▓▓▓▓▓▓ │  │                  │  │ Write your thoughts  │ │
│● Carls…│    │            │  │                  │  │ about this position… │ │
│  vs Ne…│    │  +1.25     │  │     ♔ ♕ ♖ ♗ ♘ ♙ │  │                      │ │
│  136 pl│    │            │  │                  │  │ └──────────────────────┘ │
│  +16 n │    │  ░░░░░░░░░ │  │     ♟ ♞ ♝ ♜ ♛ ♚ │  │ Saved for everyone    │
│────────│    │  (white)   │  │                  │  ├──────────────────────────┤
│ Members│    └────────────┘  │                  │  │ Moves (23 nodes)        │
│ 3/3    │                    │                  │  ├──────────────────────────┤
│ ♔ Brave│    🟡 Thinking…    │                  │  │ 1. e4 e5 2. Nf3 Nc6    │
│  presenting                  │ 3. Bb5 a6 4. Ba4 │  │ 3. Bb5 a6 4. Ba4 Nf6   │
│ ♘ Sneaky│   Depth 12   +0.45│  Nf6 5. O-O Be7  │  │ 5. O-O Be7 6. Re1 b5  │
│  collaborator                 │ 6. Re1 b5 7. Bb3 │  │ 7. Bb3 O-O 8. h3       │
│ ♙ Patient│                   │  O-O 8. h3       │  │  (8... Bb7 9. d3 d6)  │
│  viewer   │                   │                  │  │ 9. Nxe5 Nxb3 10. axb3 │
│────────│    ┌─ navigation ─────────────────────┐  │ 10. axb3 Bb7 1-0      │
│ Activity│   │ ⏮ ◀ ply 16/20 ▶ ⏭  ⇅ Flip     │  ├──────────────────────────┤
│────────│   │ ◉ Present  ⇢ Following  ♟ Engine  │  │ Game Info               │
│📥 Brave │   └──────────────────────────────────┘  │ Event  WCh 2021        │
│  import…│                                        │ Date   2021.12.03       │
│♟ Sneaky │                                        │ Result 1-0              │
│  8... Na│                                        │ Opening C88 Ruy Lopez   │
│💬 Sneaky │                                       │ Plies   20 main · 23    │
│  commen…│                                        │ Source  lichess          │
│👤 Brave  │                                       │              [Export PGN]│
└────────┴──────────────────────────────────────────┴──────────────────────────┘
```

- **Left rail** (236px): Games panel → Members panel → Activity panel. Each
  scrolls independently (`.scroll-y`).
- **Center**: Board with eval bar to its left, engine readout below, nav
  controls at the bottom.
- **Right sidebar** (340px): Comment editor → Move list → Game info. Moves panel
  flex-grows; all panels match the board column height via `xl:grid-rows` on the
  left rail.
- The header carries brand, room title, room code (copy button, owner only),
  and user identity.

### 5.3 Room — Mobile (<1280px)

Stacks vertically: board first, then engine/controls, comment, moves (max-h
45vh), then rail panels below. Page scrolls normally. Header collapses Library
into overflow.

### 5.4 Import Dialog

Modal overlay (`bg-void/75 backdrop-blur-[2px]`), 640px max-width:

```
┌─────────────────────────────────────────────────────────┐
│ Import a game                                     [✕]  │
│ Paste PGN, or drop a Lichess game URL.                  │
├─────────────────────────────────────────────────────────┤
│ PGN or Lichess URL                                      │
│ ┌───────────────────────────────────────────────────┐   │
│ │ 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6                   │   │
│ │ 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5                 │   │
│ │ 7. Bb3 O-O 8. h3 Na5 (8... Bb7 9. d3 d6)       │   │
│ └───────────────────────────────────────────────────┘   │
│ ✓ Parsed: Carlsen vs Nepo · 20 ply · 23 nodes  [Use sample] │
│                                                         │
│ ┌─ Preview ─────────────────────────────────────────┐   │
│ │ Carlsen, Magnus vs Nepo, Ian [1-0] [lichess]     │   │
│ │ Event: WCh 2021 · Date: 2021.12.03               │   │
│ │ Opening: C88 Ruy Lopez · Size: 20 ply · 23 nodes │   │
│ └───────────────────────────────────────────────────┘   │
│                                                         │
│─────────────────────────────────────────────────────────│
│ Imports are shared with everyone.       [Cancel] [Import]│
└─────────────────────────────────────────────────────────┘
```

- Pasting previews automatically. Variations and `{comments}` are preserved.
- Error state: inline explanation, "Nothing was imported," clear call-to-action.
- Lichess URLs fetch server-side (keeps the user's Lichess token out of the
  browser if they have one).

### 5.5 Empty & Error States

**Room with no game (owner):**
```
┌─────────────────────────────────┐
│         Empty room              │
│                                 │
│  Import a PGN or a Lichess     │
│  game, or start from the       │
│  initial position and just     │
│  play.                         │
│                                 │
│  [Import a game] [Fresh board]  │
└─────────────────────────────────┘
```

**Room with no game (viewer):**
```
┌─────────────────────────────────┐
│    Nothing to analyse yet       │
│                                 │
│  Waiting for the owner to      │
│  share a game. You'll see it   │
│  appear here the moment they   │
│  do.                           │
│                                 │
│  🟡 listening for updates      │
└─────────────────────────────────┘
```

**Room not found:**
```
┌─────────────────────────────────┐
│        [K] Blunderfest          │
│                                 │
│         Room not found          │
│                                 │
│  No room answers to [xxxxx].   │
│  Codes are 5 characters and    │
│  never contain i, l, o, 0      │
│  or 1 — it may have been       │
│  mistyped, or the room expired.│
│                                 │
│  [Back to home] [Design system] │
└─────────────────────────────────┘
```

---

## 6. Component Specs

All component variants are defined in `src/ui/variants.ts` using
`tailwind-variants`. Below is the full spec for every component, every state.

---

### Buttons

**Base:** `inline-flex items-center justify-center gap-1.5 rounded-control border
font-semibold transition-[background,border-color,color,box-shadow] duration-150
focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-hi
disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`

#### Intents

| Intent     | Default                          | Hover                          | Active                     |
| ---------- | -------------------------------- | ------------------------------ | -------------------------- |
| `primary`  | `bg-gold text-[#20180a] border-gold/70` | `bg-gold-hi border-gold-hi` | `bg-gold translate-y-px` |
| `secondary`| `bg-raised text-ink border-line-strong` | `bg-overlay border-[#454c5b]` | `translate-y-px` |
| `ghost`    | `bg-transparent text-muted border-transparent` | `bg-raised text-ink` | `translate-y-px` |
| `danger`   | `bg-bad/12 text-bad-hi border-bad/50` | `bg-bad/22 border-bad/70` | — |
| `quiet`    | `bg-transparent text-muted border-line` | `border-line-strong text-ink` | — |

#### Sizes

| Size     | Height | Padding   | Text     |
| -------- | ------ | --------- | -------- |
| `xs`     | 24px   | 8px       | `micro`  |
| `sm`     | 32px   | 12px      | `note`   |
| `md`     | 36px   | 14px      | `ui`     |
| `lg`     | 44px   | 20px      | `body`   |
| `icon`   | 32×32  | 0 (square)| `ui`     |
| `iconLg` | 40×40  | 0 (square)| `lead`   |

#### Additional Variants

| Variant   | Class applied                  |
| --------- | ------------------------------ |
| `active`  | `border-gold/60 bg-gold/15 text-gold-hi hover:bg-gold/20` |
| `block`   | `w-full`                       |

**Disabled:** `cursor-not-allowed opacity-40 shadow-none` — visually dimmed,
keyboard-focusable but inert.

---

### Inputs & Textareas

#### Input

**Base:** `w-full rounded-control border bg-surface text-ink
placeholder:text-faint transition-[border-color,box-shadow] duration-150
focus:border-gold/60 focus:outline-none
focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi
disabled:cursor-not-allowed disabled:opacity-50`

| Size  | Height | Padding  | Text    |
| ----- | ------ | -------- | ------- |
| `sm`  | 32px   | 10px     | `note`  |
| `md`  | 40px   | 12px     | `body`  |
| `lg`  | 48px   | 16px     | `lead`  |

| State     | Border             | Focus ring        | Text colour |
| --------- | ------------------ | ----------------- | ----------- |
| Default   | `border-line-strong hover:border-[#454c5b]` | `border-gold/60` | `ink` |
| Invalid   | `border-bad/70`    | `focus:border-bad` | `bad-hi`   |

| Variant | Class                                |
| ------- | ------------------------------------ |
| `mono`  | `font-mono tracking-[0.28em]` (room codes, PGN) |

#### Textarea

**Base:** `w-full resize-none rounded-control border bg-surface p-2.5 text-body
leading-[1.45] text-ink placeholder:text-faint
focus:border-gold/60 focus:outline-none
focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold-hi`

| State   | Border             |
| ------- | ------------------ |
| Default | `border-line-strong` |
| Invalid | `border-bad/70`    |

---

### Chips & Status Dots

#### Chip

**Base:** `inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-micro
font-semibold uppercase tracking-[0.08em]`

| Tone      | Class                              | Use                        |
| --------- | ---------------------------------- | -------------------------- |
| `neutral` | `bg-raised text-muted`             | Default, generic           |
| `gold`    | `bg-gold/15 text-gold-hi`          | Presenting badge, brand    |
| `ok`      | `bg-ok/15 text-ok-hi`              | Saved confirmation         |
| `bad`     | `bg-bad/15 text-bad-hi`            | Blunder flags              |
| `info`    | `bg-info/15 text-info`             | Lichess source, remote     |
| `outline` | `border border-line-strong text-muted` | Result (1-0), generic tag |

#### Status Dot

**Base:** `inline-block h-1.5 w-1.5 shrink-0 rounded-full`

| Tone   | Colour       | Use                        |
| ------ | ------------ | -------------------------- |
| `ok`   | `bg-ok`      | Connected, online, saved   |
| `bad`  | `bg-bad`     | Error, unreachable         |
| `warn` | `bg-gold`    | Thinking, reconnecting     |
| `idle` | `bg-faint`   | Default, muted             |

`pulse: true` → `animation: bf-pulse 1400ms ease-in-out infinite`

---

### Board Squares

Each square is a `<button>` in a `role="grid"`, with roving tabindex.

**Base:** `relative flex items-center justify-center aspect-square select-none
focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-hi`

#### States

| State       | Light square         | Dark square          | Notes                                 |
| ----------- | -------------------- | -------------------- | ------------------------------------- |
| `default`   | `bg-board-light`     | `bg-board-dark`      | No overlay                            |
| `lastMove`  | `bg-move-from` (#cdd26a) | `bg-move-to` (#aaa23a) | Smooth transition via CSS          |
| `selected`  | `bg-[#cfe0ff] ring-2 ring-inset ring-select` | `bg-[#7f93b8] ring-2 ring-inset ring-select` | 2px inset blue ring |
| `check`     | colspan 2: `bg-[radial-gradient(circle,rgba(224,90,78,0.95)_10%,rgba(224,90,78,0.55)_45%,transparent_72%)]` | | Red glow on king's square |

#### Legal Target Affordance

- **Quiet move** (no capture): small filled circle, 28% of square width,
  `bg-[rgba(20,22,27,0.3)]`, centred.
- **Capture**: ring around the corner, `border-[5px] border-[rgba(20,22,27,0.35)]`,
  inset 6%.

#### Coordinate Labels

- **File letters** (`a`–`h`): on rank 1 (bottom), positioned `bottom-px right-[3px]`.
- **Rank numbers** (`1`–`8`): on file a (left), positioned `left-[3px] top-px`.
- Colour: `text-board-dark` on light squares, `text-board-light` on dark squares.
- Lichess convention: flipped with the board.

#### Board Container

```
grid grid-board  (grid-template-columns: repeat(8, minmax(0, 1fr)))
overflow-hidden rounded-[6px] border border-board-edge
shadow-[0_18px_40px_-24px_rgba(0,0,0,0.95)]
```

Container query: `container-type: inline-size` so piece glyphs scale via
`10.4cqi` (≈ 10.4% of the board width, scales perfectly at any board size).

#### SVG Overlay (Reserved for Drawable Arrows)

An `<svg viewBox="0 0 8 8">` overlays the board grid. Defined:
- `<marker id="bf-arrow">` — triangular arrowhead.
- `<line>` elements for arrows (16% width stroke, 85% opacity, gold/info/ok/bad).
- `<rect>` elements for square highlights (35% opacity fill).

No rendering logic — the protocol is in place, the UI will arrive.

#### Keyboard Model

| Key        | Action                                  |
| ---------- | --------------------------------------- |
| `Arrow`    | Move cursor (respects board orientation)|
| `Home`     | Cursor to first file of current rank    |
| `End`      | Cursor to last file of current rank     |
| `Enter`/`Space` | Select piece, or play if target     |
| `Escape`   | Clear selection                         |

Each square announces via `aria-label`:
- Empty: `"Empty square e4"`
- Piece: `"White knight on g1"`
- Legal target: `"White pawn on e5. Legal move: e4"`

---

### Eval Bar

**Dimensions:** 24px wide (`w-7`), full board height, `rounded-[5px]`.

**Structure:**
```
┌──────┐
│ ▓▓▓▓ │  ← white share (gradient: #f4f6fb → #c9cedb)
│ ▓▓▓▓ │     height = whiteShare × 100%
│──────│  ← 1px line-strong tick at 50%
│ ░░░░ │  ← black fill: bg-[#1a1d24] (remaining)
│ ░░░░ │
└──────┘
```

White's share is drawn from the **top** per spec. Value sits inside the bar
on the leading side (`+1.25`, `M3`, etc.).

#### States

| State          | Bar appearance                                   | Label          |
| -------------- | ------------------------------------------------ | -------------- |
| **Ready**      | Full colour, value rendered                      | `+1.25`        |
| **Thinking**   | Gold sweep overlay (`bf-sweep`), last value kept | `M3`           |
| **Unavailable**| 18% opacity, `?` glyph centred                  |                |
| **Equal**      | 50/50 split, label crosses the tick              | `0.00`         |

**Animation:** Height transitions 420ms `cubic-bezier(0.22, 0.61, 0.36, 1)`.
Never a spring, never a bounce.

**ARIA:** `role="img"` with `aria-label` describing the eval in words:
`"White is better by 1.25 pawns"`, `"Mate in 3 for White"`, `"Equal position"`.

---

### Engine Readout

A 36px-tall bar below the board:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🟢 Depth 14  [+1.25]  3. Nf3 Nc6 4. Bb5                          │
└─────────────────────────────────────────────────────────────────────┘
```

| Element     | Style                                                  |
| ----------- | ------------------------------------------------------ |
| Status dot  | `ok` when ready, `warn+pulse` when thinking, `bad` when unavailable |
| Depth label | `text-micro font-semibold uppercase text-faint` → `text-muted` for the number |
| Eval badge  | White bg + dark text when ≥ 0; dark bg + ink text when < 0 |
| PV line     | `text-ui text-muted tnum`, truncated with ellipsis      |

**Unavailable state:**
```
│ 🔴 Engine unavailable — this browser blocks WebAssembly threads. [Retry] │
```

---

### Move List

Scrolls inside its panel (`.scroll-y h-full`). Current move scrolls into view.

#### Rendering Rules

1. **Main line:** `text-ui font-semibold text-ink` — each SAN is a `<button>`.
2. **Variations:** `text-note font-normal text-muted`, wrapped in `(` `)`,
   indented with a 2px left `border-line-strong` on the outermost level.
3. **Move numbers:** Shown for every White move (`1.`, `2.`, …). For Black:
   only at line starts, after comments, or after variations (`2...`, `4...`).
4. **Comment markers:** 9px blue dot (`text-info`) after the SAN when a comment
   exists. Main-line comments break onto an indented block below the move.
5. **Presence dots:** Up to 3 coloured dots after the SAN indicating other
   users' cursors sit on that node.

#### States

| State        | Class                                        |
| ------------ | -------------------------------------------- |
| Main line    | `text-ui font-semibold text-ink`             |
| Variation    | `text-note font-normal text-muted hover:text-ink` |
| **Current**  | `bg-gold/20 text-gold-hi ring-1 ring-gold/50 hover:bg-gold/25` |
| **Arrived**  | `anim-arrive` (1.2s info-blue flash)         |
| **Hover**    | `bg-raised`                                  |
| **Focus**    | `outline-2 outline-offset-1 outline-gold-hi` |

The current move is the **only gold fill in the sidebar** — the only gold fill
on the right side of the entire room screen.

---

### List Rows

Used for: game list, member list, activity feed.

**Base:** `group flex w-full items-center gap-2 px-3 py-2 text-left text-ui
transition-colors duration-100
focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-hi`

| State      | Style                                                   |
| ---------- | ------------------------------------------------------- |
| `default`  | `text-muted hover:bg-raised hover:text-ink`             |
| `selected` | `bg-gold/12 text-ink shadow-[inset_2px_0_0_var(--color-gold)] hover:bg-gold/16` |
| `muted`    | `text-faint` (offline / away members)                   |
| `arrived`  | `anim-arrive` (for activity feed entries)               |

Selected is marked by a **2px gold inset bar** on the left edge plus a 12%
gold wash — never colour alone.

---

### Panels

**Base:** `rounded-panel border border-line bg-panel
shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_24px_-16px_rgba(0,0,0,0.9)]`

**Header:** `flex h-9 shrink-0 items-center justify-between gap-2 border-b
border-line bg-surface/70 px-3`

**Title:** `text-micro font-semibold uppercase tracking-[0.11em] text-muted`

Padding: `pad` variant — `none` (default, flush), `sm` (8px), `md` (12px), `lg`
(16px).

---

### Avatars

**Base:** `grid shrink-0 place-items-center rounded-full border text-micro
font-bold uppercase`

Background: `hsl(${hueOf(userId)} 45% 22%)`, text: `hsl(${hueOf(userId)} 80% 78%)`.

| Variant     | Style                                             |
| ----------- | ------------------------------------------------- |
| `size=md`   | 28×28px                                           |
| `presenting`| `border-gold ring-2 ring-gold/35`                 |
| `away`      | `opacity-45 grayscale` (kept in list for 45s)     |

The hue is deterministic from the user ID — each member gets a stable, distinct
presence colour.

#### Role Icons

| Role           | Glyph | Colour  | ARIA label                  |
| -------------- | ----- | ------- | --------------------------- |
| Owner          | ♔     | `gold-hi` | "Owner — controls the room" |
| Collaborator   | ♘     | `silver`  | "Collaborator — can play and comment" |
| Viewer         | ♙     | `faint`   | "Viewer — can watch and navigate" |

---

### Comment Editor

Panel header shows the current move (e.g., `4. Nc6`) or "no move selected".

| State      | Content                                              |
| ---------- | ---------------------------------------------------- |
| No selection | `"Select a move to write a note about it."`       |
| Can edit   | `<textarea>` + `[Clear]` `[Save]` buttons, ⌘↵ shortcut, dirty indicator |
| Read-only  | Bordered display of the comment text                 |

**Dirty indicator:** Below the textarea: "Unsaved · ⌘↵ to save" or "Saved for
everyone".

**Remote edit:** If the move changes (switching nodes) and there is no local
unsaved text, the editor resets. If you have unsaved text, it stays until you
explicitly discard or save — remote updates do not clobber your draft.

---

### Import Dialog

- Modal: `fixed inset-0 z-50 bg-void/75 backdrop-blur-[2px]`
- Dialog: `w-full max-w-[640px] rounded-dialog border border-line-strong bg-overlay
  shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]`
- Entry animation: `anim-pop` (160ms scale 0.86→1)
- Esc to close, backdrop click to close, focus lands in the textarea.
- Pasting auto-previews. Source shown as chip (`pgn` / `info` for lichess).
- Preview panel: players with optional Elo, event, date, opening, size, warnings.
- "Use sample" ghost button seeds a game with variations and comments for
  quick demo.

---

## 7. Micro-Interactions

### Live Updates

| Scenario                                    | Animation                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Move arrives from someone else**          | New SAN token gets `anim-arrive`: `background-color: info at 40%` → transparent over 1.2s with `ease-calm`. Board only advances if you are following/presenting; otherwise nothing under your hands moves. |
| **Presence joins**                          | Avatar pops in: `scale(0.86) → scale(1)` over 160ms (`bf-pop`). Activity feed row prepends with the same `anim-arrive` flash. |
| **Presence leaves**                         | Avatar fades to 45% opacity + grayscale for 45s rather than being removed. Prevents the list from jumping. |
| **Eval bar updates**                        | Height transitions 420ms `cubic-bezier(0.22,0.61,0.36,1)`. Number cross-fades only when the rounded value changes. Tabular figures keep the width stable. |
| **Engine thinking**                         | Gold sweep travels the bar every 1.6s (`bf-sweep`). Status dot pulses. Readout label switches "Depth" → "Thinking". Last eval value stays visible at 85% opacity — the bar never flickers to `0.00`. |
| **Engine unavailable**                      | After two failed inits: bar goes flat at 18% opacity with `?` glyph. Readout becomes an explanatory line with Retry. All collaboration keeps working. |
| **Comment saved**                           | Button label → "Saved for everyone" beneath the field. Move's blue comment dot scales in. ⌘↵ saves without leaving the keyboard. |
| **Copy room code**                          | Icon swaps to green `✓` for 1.6s. Live region announces: "Room link for qh4nx copied". |
| **Reconnecting**                            | Header dot turns gold and pulses. Room stays interactive; moves queue. No modal, no blocking spinner. |
| **`prefers-reduced-motion: reduce`**        | All animations collapse to ~0.001ms. Arrivals then rely on the persistent presence dot and activity feed row, not the flash. |

### Keyframes Reference

| Name          | Duration | Timing        | Effect                                         |
| ------------- | -------- | ------------- | ---------------------------------------------- |
| `bf-arrive`   | 1200ms   | `ease-calm`   | `bg-info at 40%` → transparent                 |
| `bf-pulse`    | 1400ms   | `ease-in-out` | Opacity 0.35 ↔ 1, infinite                     |
| `bf-sweep`    | 1600ms   | `linear`      | `translateY(-100%)` → `translateY(200%)`, infinite |
| `bf-pop`      | 160ms    | `ease-calm`   | `scale(0.86) opacity(0)` → `scale(1) opacity(1)` |

---

## 8. Layout & Extensibility

### Room Layout (Desktop ≥1280px)

```
xl:grid-cols-[236px_minmax(560px,1fr)_340px]  gap-3  p-3
```

- **Left rail** (236px): 3-row grid (`xl:grid-rows-[0.85fr_1fr_1.15fr]`):
  Games → Members → Activity. Each panel scrolls independently.
- **Center**: Board column, flex-col: board → engine readout → nav controls.
  Board width: `min(100%, calc(100vh - 11.5rem))` — fills available space
  without exceeding viewport height.
- **Right sidebar** (340px): Comment → Moves (flex-grow, capped at 45vh on
  mobile, `xl:max-h-none` on desktop) → Game info.
- **No page-level scrolling.** `xl:h-screen xl:overflow-hidden` on the body.
  Only the panels scroll.

### Mobile Layout (<1280px)

Single column, `grid-cols-1`. Page scrolls normally.

Order: board → engine/controls → comment → moves (max-h 45vh) → rail panels
(games, members, activity). Header keeps brand + code + name; Library moves
into an overflow menu.

### Extensibility Slots (Designed For, Not Yet Built)

| Feature                | Docked where                                     |
| ---------------------- | ------------------------------------------------ |
| **Engine lines**       | Under the Moves panel in the right sidebar. Insertable as variations. Collapses to a single 28px header when empty. |
| **Opening / ECO / Masters reference** | Shares the right sidebar stack with Engine lines. Single-header collapse when empty. |
| **Whole-game eval curve + blunder report** | Horizontal band below the board, between the engine readout and the nav controls. |
| **Game library**       | `/library` route, linked from the header of every screen. |
| **Position search**    | Marquee feature — accessed from the library, results in the room's left rail. |
| **Text chat**          | Bottom of the left rail, below Activity (shares the "stream" behaviour). |
| **Move voting / polls**| Below Activity in the left rail, same stream-like rendering. |
| **PGN export**         | Button in the Game info panel header ("Export PGN"). |
| **Drawable arrows**    | Board's SVG overlay layer — protocol in place, UI pending. |
| **Private rooms / optional sign-in** | Header right side — account menu slot already reserved. |

---

## 9. Accessibility Contract

### Focus Management

- **Every interactive element** shows a 2px `gold-hi` outline at 2px offset,
  including squares, move tokens, and rows. The board never loses its focus
  indicator on dark or light squares.
- Dialogs: Esc closes, backdrop click closes, focus restores to trigger,
  focus traps nothing the user cannot escape from.

### Keyboard Navigation

**Board** (`role="grid"`, roving tabindex):

| Key        | Action                                       |
| ---------- | -------------------------------------------- |
| Arrow keys | Move cursor (respects board orientation)     |
| Home       | Cursor to first file of current rank          |
| End        | Cursor to last file of current rank           |
| Enter/Space| Select piece (first press), play move (second)|
| Escape     | Clear selection                               |

**Room-level shortcuts** (suppressed inside `<input>`, `<textarea>`, `[role="grid"]`):

| Key    | Action                              |
| ------ | ----------------------------------- |
| ← →    | Move through the main line          |
| Home   | Jump to start position              |
| End    | Jump to last move                   |
| F      | Flip board orientation              |

### Screen Reader Support

- `aria-live="polite"` regions:
  - Engine readout (eval changes)
  - Activity feed (new entries)
  - Board announcements ("Nf3 played", "Knight on g1 selected, 3 legal moves")
  - Copy confirmation
- `aria-label` on all board squares (piece, colour, square name, legal moves).
- `aria-current="true"` on the selected member, game, and move.
- `aria-pressed` on toggle buttons (Present, Follow, Engine).
- Role icons carry `title` + `aria-label` — roles are never icon-only.

### Contrast

| Text colour | Ratio on `surface` | Level |
| ----------- | ------------------ | ----- |
| `ink`       | 14.4:1             | AAA   |
| `muted`     | 6.9:1              | AA    |
| `gold-hi`   | 7.6:1              | AA    |
| `faint`     | 4.1:1              | AA Large (≥16px or non-essential metadata) |

### State Indicators

State is **never colour-only**:
- Selected rows add a gold inset bar + gold wash (not just a background colour).
- Roles add text labels via `title` + `aria-label` (not just glyphs).
- Errors add an ⚠ glyph and text (not just a red border).
- Online/offline uses both a dot colour and text ("active" / "away").

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

Arrivals rely on the persistent presence dot and activity feed row, not the flash.

---

## 10. Token Reference Table

### Surface Tokens

| Token          | Utility class    | CSS variable              |
| -------------- | ---------------- | ------------------------- |
| void           | `bg-void`        | `--color-void`            |
| surface        | `bg-surface`     | `--color-surface`         |
| panel          | `bg-panel`       | `--color-panel`           |
| raised         | `bg-raised`      | `--color-raised`          |
| overlay        | `bg-overlay`     | `--color-overlay`         |

### Border Tokens

| Token          | Utility class    | CSS variable              |
| -------------- | ---------------- | ------------------------- |
| line           | `border-line`    | `--color-line`            |
| line-strong    | `border-line-strong` | `--color-line-strong`  |

### Text Tokens

| Token          | Utility class    | CSS variable              |
| -------------- | ---------------- | ------------------------- |
| ink            | `text-ink`       | `--color-ink`             |
| muted          | `text-muted`     | `--color-muted`           |
| faint          | `text-faint`     | `--color-faint`           |

### Accent Tokens

| Token          | Utility class    | CSS variable              |
| -------------- | ---------------- | ------------------------- |
| gold           | `bg-gold`        | `--color-gold`            |
| gold-hi        | `text-gold-hi`   | `--color-gold-hi`         |
| gold-dim       | `bg-gold-dim`    | `--color-gold-dim`        |
| ok             | `bg-ok`          | `--color-ok`              |
| ok-hi          | `text-ok-hi`     | `--color-ok-hi`           |
| bad            | `bg-bad`         | `--color-bad`             |
| bad-hi         | `text-bad-hi`    | `--color-bad-hi`          |
| info           | `bg-info`        | `--color-info`            |
| silver         | `text-silver`    | `--color-silver`          |

### Board Tokens

| Token          | Utility class          | CSS variable               |
| -------------- | ---------------------- | -------------------------- |
| board-light    | `bg-board-light`       | `--color-board-light`      |
| board-dark     | `bg-board-dark`        | `--color-board-dark`       |
| board-edge     | `border-board-edge`    | `--color-board-edge`       |
| move-from      | `bg-move-from`         | `--color-move-from`        |
| move-to        | `bg-move-to`           | `--color-move-to`          |
| select         | `ring-select`          | `--color-select`           |
| check          | —                      | `--color-check`            |

### Typography Tokens

| Name     | Utility class   | CSS variable          | Size  | Line |
| -------- | --------------- | --------------------- | ----- | ---- |
| micro    | `text-micro`    | `--text-micro`        | 11px  | 16px |
| note     | `text-note`     | `--text-note`         | 12px  | 18px |
| ui       | `text-ui`       | `--text-ui`           | 13px  | 20px |
| body     | `text-body`     | `--text-body`         | 14px  | 22px |
| lead     | `text-lead`     | `--text-lead`         | 16px  | 24px |
| display  | `text-display`  | `--text-display`      | 24px  | 30px |
| hero     | `text-hero`     | `--text-hero`         | 36px  | 40px |

### Radius Tokens

| Name   | CSS variable      | Value | Tailwind      |
| ------ | ----------------- | ----- | ------------- |
| chip   | `--radius-chip`   | 4px   | `rounded-chip`    |
| control| `--radius-control`| 6px   | `rounded-control` |
| panel  | `--radius-panel`  | 10px  | `rounded-panel`   |
| dialog | `--radius-dialog` | 14px  | `rounded-dialog`  |

### Motion Token

| Name      | CSS variable    | Value                                  |
| --------- | --------------- | -------------------------------------- |
| ease-calm | `--ease-calm`   | `cubic-bezier(0.22, 0.61, 0.36, 1)`  |

---

*This document is a living spec. It maps directly to the Tailwind v4 theme
tokens in `src/app/globals.css`, the `tailwind-variants` definitions in
`src/ui/variants.ts`, and every component file in `src/components/`. Every
class named here is a real utility available to developers — no mockup values,
no unreachable specs.*
