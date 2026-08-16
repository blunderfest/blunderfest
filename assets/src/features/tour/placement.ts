/** Breathing room between the spotlight and the tooltip card. */
export const TIP_GAP = 12;
/** Minimum distance from any viewport edge. */
export const TIP_MARGIN = 8;

export type Spot = { top: number; left: number; width: number; height: number };
export type TipSize = { width: number; height: number };
export type Viewport = { width: number; height: number };

/**
 * Tooltip placement, guaranteed inside the viewport: docked below the
 * spotlight when it fits, above when it fits there, otherwise docked
 * inside the viewport on the roomier side (overlapping the spotlight —
 * the card is opaque and shadowed, so overlap reads fine). Zoomed viewports
 * and oversized targets can therefore never push the buttons off-screen.
 */
export function placeTooltip(
  spot: Spot,
  tip: TipSize,
  viewport: Viewport,
): { top: number; left: number } {
  const below = viewport.height - (spot.top + spot.height);
  let top: number;
  if (below >= tip.height + TIP_GAP) {
    top = spot.top + spot.height + TIP_GAP;
  } else if (spot.top >= tip.height + TIP_GAP) {
    top = spot.top - TIP_GAP - tip.height;
  } else {
    // Neither side fits: dock inside on the roomier side.
    top = below >= spot.top ? viewport.height - tip.height - TIP_MARGIN : TIP_MARGIN;
  }
  top = Math.min(Math.max(TIP_MARGIN, top), viewport.height - tip.height - TIP_MARGIN);

  const centerX = spot.left + spot.width / 2;
  const left = Math.min(
    Math.max(TIP_MARGIN, centerX - tip.width / 2),
    viewport.width - tip.width - TIP_MARGIN,
  );

  return { top, left };
}
