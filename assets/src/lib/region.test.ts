import { describe, expect, it } from 'vitest';
import { formatRegion } from '@/lib/region';

describe('formatRegion', () => {
  it('maps known Fly regions to flag + friendly name', () => {
    expect(formatRegion('ams')).toBe('🇳🇱 Amsterdam');
    expect(formatRegion('ord')).toBe('🇺🇸 Chicago');
  });

  it('falls back to the raw code for unknown regions', () => {
    expect(formatRegion('syd')).toBe('syd');
  });

  it('renders local as Local', () => {
    expect(formatRegion('local')).toBe('Local');
  });

  it('is null when the region is not known yet', () => {
    expect(formatRegion(null)).toBeNull();
    expect(formatRegion(undefined)).toBeNull();
    expect(formatRegion('')).toBeNull();
  });
});
