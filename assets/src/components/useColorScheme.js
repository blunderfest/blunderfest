import { useEffect, useState } from "react";

const localStorageKey = "prefers-dark-color-scheme";
const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");

export function useColorScheme() {
  const [prefersDark, setPrefersDark] = useState(matchMedia.matches);

  /**
   * @param {boolean} prefersDark
   */
  function switchScheme(prefersDark) {
    document.documentElement.dataset.mode = prefersDark ? "dark" : "light";
    localStorage.setItem(localStorageKey, String(prefersDark));
    setPrefersDark(prefersDark);
  }

  useEffect(() => {
    /**
     * @param {MediaQueryListEvent} event
     */
    function onMediaChange(event) {
      switchScheme(event.matches);
    }

    matchMedia.addEventListener("change", onMediaChange);

    const initialPreference = (localStorage.getItem(localStorageKey) ?? String(matchMedia.matches)) === "true";
    switchScheme(initialPreference);

    return () => matchMedia.removeEventListener("change", onMediaChange);
  }, []);

  return {
    prefersDark,
    switchScheme: () => switchScheme(!prefersDark),
  };
}
