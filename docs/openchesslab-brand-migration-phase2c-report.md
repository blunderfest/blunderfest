# Brand migration — Phase 2C: production asset integration

Status: complete. Color system, tokens, layout, typography, theme architecture untouched.

## Files changed

- `assets/src/components/Logo.tsx` — rewritten: header mark is now the approved native-size
  micro asset (24px box → 24px asset, 32px box → 32px asset), theme-aware via CSS.
- `assets/src/features/home/Home.tsx` — hero uses the approved full mark (light/dark) with
  "OpenChessLab" and the tagline as real text.
- `assets/index.html` — favicon declarations (svg + sized pngs + ico fallback).
- `assets/biome.json` — excludes `public/brand` and `public/favicon.svg` from lint, same
  treatment as the existing `public/pieces` design assets (assets are immutable; a11y is
  handled by `alt=""`/`aria-hidden` at the use site).
- `lib/blunderfest_web.ex` — `static_paths/0`: added `brand`, `favicon.svg`,
  `favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`; dropped `favicon.png`.
- `assets/public/favicon.png` — deleted (temporary gold-era tile).
- `priv/static/` — rebuilt with `pnpm build`; stale built `favicon.png` removed.
- `screenshots/phase2c-*.png` — verification captures.

## Assets installed

- `assets/public/brand/openchesslab-micro-{light,dark}-{48,32,24,16}.svg` — byte-identical
  copies of the approved micro marks (`cmp`-verified against `design/brand/`).
- `assets/public/brand/openchesslab-mark-light.png` (162×196) and
  `openchesslab-mark-dark.png` (109×129) — the approved full marks
  (`design/white_knight.png` / `design/dark_knight.png`) with only the flat outer background
  flood-fill matted to transparency; all other pixels untouched. Mapping documented because
  the supplied full marks are rasters with baked backgrounds, not SVGs.
- `assets/public/favicon.svg` — navy `#0D1B3D` tile + dark 48px micro mark, 6px safe margin,
  uniform group transform only (path data unchanged).
- `assets/public/favicon-16x16.png` / `-32x32.png` / `-48x48.png` — each rendered from its own
  native micro mark (16/32/48) on the navy tile; never scaled from one source.
- `assets/public/favicon.ico` — 16+32+48 layers.

## Runtime mapping

| Slot        | Asset                                    |
| ----------- | ---------------------------------------- |
| Header light | `/brand/openchesslab-micro-light-24.svg` (24px box) |
| Header dark  | `/brand/openchesslab-micro-dark-24.svg`  |
| Home light   | `/brand/openchesslab-mark-light.png`     |
| Home dark    | `/brand/openchesslab-mark-dark.png`      |
| favicon 16   | `favicon-16x16.png` (from micro 16)      |
| favicon 32   | `favicon-32x32.png` (from micro 32)      |
| favicon 48   | `favicon-48x48.png` / `favicon.svg` (from micro 48) |

`Logo` keeps an `md` size mapped to the 32px assets for any future ≥28px use; the header
renders `sm` (24px).

## Theme implementation

Unchanged architecture: `index.html`'s inline script and `src/lib/theme.ts` resolve
`blunderfest.theme` (key untouched) to `<html data-theme="light|dark">` before first paint.
Logo and Home render both variants stacked in a grid cell; the Tailwind arbitrary variant
`[[data-theme=dark]_&]:hidden` / `:block` selects the visible one purely in CSS. Because
`data-theme` exists pre-paint, the first paint shows the correct asset — no flash, no JS
subscription, no CSS filters, no second theme system. OS flips under "system" go through the
existing `watchSystemTheme`, and the CSS follows automatically.

## Accessibility

- Header: mark wrapper `aria-hidden="true"`, imgs `alt=""`; the logo link keeps
  `aria-label={t('app.name')}`; "OpenChessLab" beside the mark is real text.
- Home: `h1` = aria-hidden mark + visible real-text name; tagline real text. Accessible name
  remains "OpenChessLab" (existing role tests pass unchanged).
- No accessible text duplicated inside any SVG; favicons are decorative.

## Verification

- `pnpm lint`, `pnpm typecheck` clean; `vitest run --pool=forks` 640/640.
- `mix precommit` clean (437 tests).
- `pnpm build` clean; `priv/static` refreshed.
- Screenshots: `phase2c-home-{light,dark}.png`, `phase2c-analyzer-{light,dark}.png`,
  `phase2c-favicon-sheet.png` (favicon set at 1:1: 48/32/24/16).

## Remaining brand work

- Full mark is raster-only (162×196 / 109×129). A vector full-mark SVG for large/retina
  placements is still outstanding — not invented here per the phase brief.
- No PWA manifest introduced (none existed).
- Phase 3 polish not started.
