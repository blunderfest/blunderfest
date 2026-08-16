const STORAGE_KEY = 'blunderfest.tourSeen';

/**
 * Whether the guided tour has already run on this device. When storage is
 * unreadable (private mode et al.) we answer "seen" — never nag.
 */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — the tour simply shows again next visit.
  }
}
