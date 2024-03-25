import { useObservableState, useSubscription } from "observable-hooks";
import { BehaviorSubject, fromEvent, merge } from "rxjs";

const localStorageKey = "prefers-dark-color-scheme";
const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");

const browserPreference$ = fromEvent(
  matchMedia,
  "change",
  /**
   * @param {MediaQueryListEvent} event
   */
  (event) => event.matches
);

/**
 * @type {import "rxjs".BehaviorSubject<boolean>}
 */
const userOverride$ = new BehaviorSubject((localStorage.getItem(localStorageKey) ?? String(matchMedia.matches)) === "true");
const colorScheme$ = merge(browserPreference$, userOverride$);

export function useColorScheme() {
  const prefersDark = useObservableState(colorScheme$);

  useSubscription(colorScheme$, (value) => {
    document.documentElement.dataset.colorScheme = value ? "dark" : "light";
    localStorage.setItem(localStorageKey, value);
  });

  return {
    prefersDark,
    switchScheme: () => userOverride$.next(!prefersDark),
  };
}
