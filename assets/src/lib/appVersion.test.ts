import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasNewVersion, loadInitialVersion } from '@/lib/appVersion';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('appVersion', () => {
  it('reads the beacon with cache bypass', async () => {
    fetchMock.mockResolvedValue(
      new Response('1756\n', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    expect(await loadInitialVersion()).toBe('1756');
    expect(fetchMock).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
  });

  it('returns null when the beacon is missing (dev without a build)', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));

    expect(await loadInitialVersion()).toBeNull();
    expect(await hasNewVersion(null)).toBe(false);
  });

  it('detects a changed beacon', async () => {
    fetchMock.mockResolvedValue(
      new Response('9999\n', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );

    expect(await hasNewVersion('1000')).toBe(true);
    expect(await hasNewVersion('9999')).toBe(false);
  });
});
