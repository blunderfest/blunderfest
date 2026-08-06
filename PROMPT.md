# Prompt for UI design AIs

Paste everything below the line into a UI design AI (v0, Figma AI, Galileo, a
design-focused LLM, etc.).

---

You are designing the UI for **Blunderfest**, a **collaborative chess analysis
web app**. Think "lichess/chess.com analysis board meets Google Docs": one
person imports or starts a game, shares a 5-letter room code, and everyone
analyzes the same board together in real time — moves, nested variations,
comments, cursors, and a chess-engine eval bar, all synced live.

## The product in one paragraph

Anyone can open the app and instantly get an anonymous identity (a fun
auto-generated name like "Brave Otter 42" — no accounts, no signup). From the
home screen you create a room or join one with a code. Inside a room there's a
shared analysis board: people play moves (they become a live variation tree),
write per-move comments, follow the room owner's cursor (presenter mode), and
watch the built-in Stockfish engine evaluate every position. Rooms hold
multiple imported games (PGN paste or Lichess URL). It's a power tool for
studying chess together, not a marketing site — density and clarity over
decoration.

## Screens to design

1. **Home** — app name + tagline, big "Create a room" action, and a join-by-code
   input (codes are exactly 5 lowercase chars, unambiguous alphabet: no
   i/l/o/0/1). Also shows the player's anonymous name and a tiny backend
   status indicator.
2. **Room (the core screen, 90% of the design effort)** — current desktop
   layout: a slim left column with the room's game list, member list (role
   icons: gold king = owner, silver knight = collaborator, pawn = viewer), and
   an activity feed; the center has the board with a vertical engine eval bar
   on its left, an engine readout line, and navigation controls
   (first/prev/next/last, flip, follow); a right sidebar with the current
   move's comment editor, the move list (variation tree with proper chess
   numbering), and game info (event, date, plies). The app header carries the
   brand, the room code + copy button (owner only), and the user's name.
3. **Import dialog** — paste PGN or drop a Lichess URL, with a preview of the
   parsed game (players, event, date, result, ply/node counts) and clear error
   states.
4. **Empty & error states** — room with no game yet ("waiting for the owner to
   share a game" for viewers), room-not-found screen, engine-unavailable hint.

## Hard constraints

- **Dark theme first.** Current palette (may be refined, not worshipped):
  surface `#14161b`, ink `#e8eaf0`, muted `#9aa1b0`, accent/gold `#c9a227`,
  ok `#4caf50`, bad `#e05a4e`. Board squares `#f0d9b5` / `#b58863`.
  Font: Open Sans.
- **The board is the hero.** Everything else orbits it and must not compete
  with it visually.
- **No page-level vertical scrolling on the room screen.** The move list and
  other long content scroll *inside* their panels; the sidebar matches the
  board's height.
- **Chess conventions are not negotiable**: algebraic notation, move-number
  rules (`2...` only at variation starts), variation parens, the eval bar
  (white share from the top, values like `+1.25` / `M3`).
- **It will be built in Tailwind (v4) + tailwind-variants** — deliver
  implementable specs: spacing, radii, typography scale, states
  (hover/focus/selected/disabled), not just pretty pictures.
- **Accessibility is a requirement, not a garnish**: visible focus states,
  keyboard-operable board and lists, WCAG AA contrast on the dark theme,
  live-region-friendly status text. The board itself is keyboard-playable.
- Responsive: the two-column room layout (board + right sidebar) applies from
  ~1280px up; below that it stacks (board first, sidebar content below).

## Personality

Blunderfest is playful in name but the tool is calm and precise. Chess-study
energy: focused, a little nerdy, collaborative. The fun lives in small places
(generated player names, maybe a mascot-ish touch in the logo), never in the
analysis surface. Reference points: lichess analysis/studies (density,
keyboard-first), chess.com game review (polish), Google Docs (presence and
"we're in this together" liveness).

## What to deliver

1. **Visual direction**: palette, typography scale, spacing/radius tokens,
   elevation/border treatment for panels, plus a small logo/wordmark idea.
2. **Screen designs** for the four screens above, at desktop width, with the
   room screen also shown stacked at mobile width.
3. **Component specs** with all states for: board squares (default / last
   move / selected / legal target / hint arrow), eval bar (including
   "thinking" state), move list (pairs, nested variations, current-move
   highlight), member list rows (role icons, presenting badge, promote/demote
   buttons), activity feed rows, game list rows, import form fields and
   errors, buttons and inputs.
4. **Micro-interactions**: how live updates should feel (a move arriving from
   someone else, presence joins/leaves, the eval bar animating to a new
   score), and empty/loading states for the engine.

If you produce code, make it semantic HTML + Tailwind classes that map to the
constraints above.
