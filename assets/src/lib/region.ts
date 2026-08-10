/** Fly region codes seen in the wild; unknown codes render as-is. */
const KNOWN_REGIONS: Record<string, { name: string; flag: string }> = {
  ams: { name: 'Amsterdam', flag: '🇳🇱' },
  ord: { name: 'Chicago', flag: '🇺🇸' },
};

/**
 * Human-readable server region: friendly name + flag when known, the raw
 * Fly region code otherwise, "Local" in dev, null when unknown yet.
 */
export function formatRegion(code: string | null | undefined): string | null {
  if (code === null || code === undefined || code === '') {
    return null;
  }
  if (code === 'local') {
    return 'Local';
  }
  const known = KNOWN_REGIONS[code];
  return known !== undefined ? `${known.flag} ${known.name}` : code;
}
