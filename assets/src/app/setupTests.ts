import '@testing-library/jest-dom/vitest';
import '@/i18n';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

declare module 'vitest' {
  interface Assertion<T> {
    toHaveNoViolations(): void;
  }
}

// Node 26 defines an experimental `localStorage` on the global, which makes
// vitest skip copying jsdom's own localStorage onto the test global. Provide
// an in-memory one so the identity code is exercised as in a real browser.
const store = new Map<string, string>();

const localStorageMock: Storage = {
  get length() {
    return store.size;
  },
  clear() {
    store.clear();
  },
  getItem(key: string) {
    return store.get(key) ?? null;
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
  removeItem(key: string) {
    store.delete(key);
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

// jsdom has no matchMedia; the theme code listens to it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
