import { describe, expect, it } from 'vitest';
import { placeTooltip, TIP_GAP, TIP_MARGIN } from '@/features/tour/placement';

const VIEWPORT = { width: 1000, height: 600 };
const TIP = { width: 288, height: 200 };

describe('placeTooltip', () => {
  it('docks below the spotlight when it fits', () => {
    const spot = { top: 100, left: 200, width: 300, height: 100 };
    const pos = placeTooltip(spot, TIP, VIEWPORT);
    expect(pos.top).toBe(spot.top + spot.height + TIP_GAP);
  });

  it('docks above the spotlight when only there it fits', () => {
    const spot = { top: 350, left: 200, width: 300, height: 200 };
    const pos = placeTooltip(spot, TIP, VIEWPORT);
    expect(pos.top).toBe(spot.top - TIP_GAP - TIP.height);
  });

  it('docks inside the viewport when neither side fits (tall target, zoomed viewport)', () => {
    // The 120% case: a 500px target near the top of a 600px viewport.
    const spot = { top: 100, left: 200, width: 300, height: 500 };
    const pos = placeTooltip(spot, TIP, VIEWPORT);
    expect(pos.top + TIP.height).toBeLessThanOrEqual(VIEWPORT.height - TIP_MARGIN);
    expect(pos.top).toBeGreaterThanOrEqual(TIP_MARGIN);
  });

  it('docks at the top when there is more room above', () => {
    // A target covering the lower viewport without leaving room above either.
    const spot = { top: 150, left: 200, width: 300, height: 440 };
    const pos = placeTooltip(spot, TIP, VIEWPORT);
    expect(pos.top).toBe(TIP_MARGIN);
  });

  it('clamps horizontally into the viewport, wide targets included', () => {
    const wide = { top: 100, left: -50, width: 2000, height: 100 };
    const pos = placeTooltip(wide, TIP, VIEWPORT);
    expect(pos.left).toBeGreaterThanOrEqual(TIP_MARGIN);
    expect(pos.left + TIP.width).toBeLessThanOrEqual(VIEWPORT.width - TIP_MARGIN);
  });

  it('never leaves the viewport across a sweep of spot positions', () => {
    for (let top = -200; top <= 800; top += 50) {
      for (let height = 20; height <= 800; height += 130) {
        const pos = placeTooltip({ top, left: 100, width: 300, height }, TIP, VIEWPORT);
        expect(pos.top).toBeGreaterThanOrEqual(TIP_MARGIN);
        expect(pos.top + TIP.height).toBeLessThanOrEqual(VIEWPORT.height - TIP_MARGIN);
      }
    }
  });
});
