# Phase 2A Report — Minimal Visual Validation Slice

## Files changed

- `assets/src/app/app.css` — new `brand*/accent*/accent-muted/warn*` tokens, both themes (gold family and all other tokens untouched)
- `assets/src/components/ui.ts` — `button` primary → brand navy; `statusDot` warn → `bg-warn`
- `assets/src/components/Logo.tsx` — tile → `bg-brand text-brand-ink`; wordmark → "OpenChessLab"
- `assets/src/features/analysis/MoveList.tsx` — current move → accent tokens
- `assets/src/features/analysis/SidebarTabs.tsx` — active tab → `text-ink` + `bg-brand-hi` underline
- `assets/src/features/room/GameRail.tsx` — active game row → restrained accent
- `assets/src/i18n/locales/en.json` — `app.name`, `app.tagline`, `update.available`
- `assets/index.html` — `<title>OpenChessLab</title>`
- `assets/src/app/App.test.tsx`, `assets/src/components/UpdateBanner.test.tsx` — brand-string assertions only

## Semantic mapping implemented

| Role | Concrete element | Treatment |
|---|---|---|
| Brand / primary action | Logo tile + wordmark (header, home); "Create a room" CTA | `brand` navy fill, `brand-ink` text |
| Analytical focus / current position | MoveList current move | `bg-accent-muted text-accent ring-accent/50` |
| Selected analytical context | GameRail active game row | `border-accent/40 bg-accent-muted` + 2px `accent` inset bar |
| Active navigation | SidebarTabs active tab | `text-ink` + `brand-hi` underline (deliberately **not** cyan) |
| Warning / status | `statusDot` warn (engine thinking, reconnecting, listening) | `bg-warn` (amber; values = old gold, look preserved) |

## Final theme values

| Token | Dark | Light |
|---|---|---|
| brand | `#35507e` | `#1c3663` |
| brand-hi | `#46639a` | `#24447c` |
| brand-ink | `#f4f6fb` | `#ffffff` |
| accent | `#45c4e9` | `#0b7285` |
| accent-hi | `#7ad6f2` | `#085a69` |
| accent-muted | `rgb(69 196 233 / 0.16)` | `rgb(11 114 133 / 0.12)` |
| warn | `#c9a227` | `#8a6d10` |
| warn-hi | `#d4b13c` | `#8a6d10` |

## Deviations

- Dark `brand` deepened `#3a5a94 → #35507e` (and `brand-hi → #46639a`): the proposal read as medium blue; adjusted conservatively toward navy while keeping ~8:1 white-text contrast and visibility on `void`. Light values as proposed.
- Light `warn-hi` = `warn` (`#8a6d10`); Phase 1 gave one light warn value and the light gold family already used a single AA value.
- Active navigation uses neutral ink + brand underline, not cyan, per the Phase-1 refinement.
- Everything else gold (switch-on, timeline active layer, opening name, Checkmate status, demo chip, focus rings, charts, board) is intentionally unchanged.

## Temporary branding assets

- **Logo: temporary.** Existing knight tile recolored to navy as a validation vehicle; final OpenChessLab mark pending.
- **Favicon: unchanged old gold tile** — temporary, replacement pending.

## Verification

- `pnpm lint` (biome): clean. `pnpm typecheck`: clean. `vitest run --pool=forks`: **60 files / 640 tests passed**.
- No backend/Elixir changes; localStorage keys, domains, API contracts untouched.
- Self-check screenshots saved: `screenshots/phase2a-{home,analyzer}-{dark,light}.png` (both themes verified).

## Visual review checklist

Inspect these four screenshots (already captured at the paths above):

1. **Home — dark**: navy logo tile + wordmark, navy "Create a room" CTA, tagline.
2. **Home — light**: deep-navy CTA/logo on cool paper; white text contrast.
3. **Analyzer — dark**: current MoveList move (`17. Rd8#`, cyan wash/ring); selected GameRail row (restrained cyan inset bar, not a bright block); active "Moves" tab (ink text + navy underline — compare against the cyan focus states); engine switch + timeline active layer still gold (unchanged by design); "Checkmate" status still gold.
4. **Analyzer — light**: same five elements; check accent contrast on white and navy underline visibility.

Also verify interactively if desired: engine **thinking** dot (amber, unchanged hue), keyboard focus rings (still gold this phase), and header wordmark width at narrow viewports.
