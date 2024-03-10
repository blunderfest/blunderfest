import { css } from "@blunderfest/styled-system/css";
import { useCallback, useLayoutEffect, useState } from "react";
import { MdDarkMode, MdLightMode } from "react-icons/md";

const matchMedia = window.matchMedia("(prefers-color-scheme: dark)");

const localStorageKey = "prefers-dark-color-scheme";
const initialPrefersDark =
    localStorage.getItem(localStorageKey) !== null ? localStorage.getItem(localStorageKey) === "true" : matchMedia.matches;

export function ColorSchemeToggle() {
    const [themeToggle, setThemeToggle] = useState(initialPrefersDark);

    const onMediaQueryChanged = useCallback((event: MediaQueryListEvent) => {
        const matches = event.matches;
        setColorTheme(matches);
    }, []);

    const setColorTheme = (dark: boolean) => {
        document.documentElement.dataset.colorScheme = dark ? "dark" : "light";
        localStorage.setItem(localStorageKey, String(dark));
        setThemeToggle(dark);
    };

    useLayoutEffect(() => {
        matchMedia.addEventListener("change", onMediaQueryChanged);

        setColorTheme(initialPrefersDark);

        return () => matchMedia.removeEventListener("change", onMediaQueryChanged);
    }, [onMediaQueryChanged]);

    return (
        <div
            onClick={() => setColorTheme(!themeToggle)}
            className={css({
                _dark: {
                    color: "gray.dark.12",
                },
                _light: {
                    color: "gray.light.12",
                },
            })}>
            {themeToggle && (
                <MdLightMode
                    className={css({
                        fontSize: "x-large",
                        cursor: "pointer",
                    })}
                />
            )}
            {!themeToggle && (
                <MdDarkMode
                    className={css({
                        fontSize: "x-large",
                        cursor: "pointer",
                    })}
                />
            )}
        </div>
    );
}
