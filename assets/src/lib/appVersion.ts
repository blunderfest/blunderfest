/**
 * The version beacon: the built app ships `/version.json` (a build
 * timestamp written by the Docker build). Open tabs poll it so a deploy
 * can offer a reload instead of silently running the old bundle.
 */

async function fetchVersion(): Promise<string | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const body = (await response.text()).trim();
    return body === '' ? null : body;
  } catch {
    // Dev (Vite) has no beacon — no update checking there.
    return null;
  }
}

/** The version this tab started with (null when there is no beacon). */
export async function loadInitialVersion(): Promise<string | null> {
  return fetchVersion();
}

/** True when the beacon now carries a different version than at load. */
export async function hasNewVersion(initial: string | null): Promise<boolean> {
  if (initial === null) {
    return false;
  }
  const current = await fetchVersion();
  return current !== null && current !== initial;
}
