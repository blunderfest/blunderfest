import { css } from "@blunderfest/design-system/styled-system/css";
import { visuallyHidden } from "@blunderfest/design-system/styled-system/patterns/visually-hidden";
import { useCallback, useLayoutEffect, useState } from "react";
import { MdDarkMode, MdLightMode } from "react-icons/md";

const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");

const localStorageKey = "prefers-dark-color-scheme";
const initialPrefersDark =
  localStorage.getItem(localStorageKey) !== null ? localStorage.getItem(localStorageKey) === "true" : matchMedia.matches;

export function ColorSchemeToggle() {
  const [darkMode, setDarkMode] = useState(initialPrefersDark);

  const onMediaQueryChanged = useCallback((/** @type {MediaQueryListEvent}  */ event) => {
    const matches = event.matches;
    setColorTheme(matches);
  }, []);

  const setColorTheme =
    /**
     * @param {boolean} dark
     */
    (dark) => {
      document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
      localStorage.setItem(localStorageKey, String(dark));
      setDarkMode(dark);
    };

  useLayoutEffect(() => {
    matchMedia.addEventListener("change", onMediaQueryChanged);

    setColorTheme(initialPrefersDark);

    return () => matchMedia.removeEventListener("change", onMediaQueryChanged);
  }, [onMediaQueryChanged]);

  return (
    <label aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
      <input type="checkbox" checked={darkMode} onChange={(e) => setColorTheme(e.target.checked)} className={visuallyHidden()} />
      {darkMode && (
        <MdLightMode
          className={css({
            fontSize: "3xl",
            cursor: "pointer",
            color: "gray.dark.12",
          })}
        />
      )}
      {!darkMode && (
        <MdDarkMode
          className={css({
            fontSize: "3xl",
            cursor: "pointer",
            color: "gray.light.12",
          })}
        />
      )}
    </label>
  );
}
