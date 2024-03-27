import { css } from "@design-system/css";
import { visuallyHidden } from "@design-system/patterns/visually-hidden";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useColorScheme } from "./useColorScheme";

export function ColorSchemeToggle() {
  const { prefersDark, switchScheme } = useColorScheme();

  return (
    <label aria-label={prefersDark ? "Switch to light mode" : "Switch to dark mode"}>
      <input type="checkbox" checked={prefersDark} onChange={() => switchScheme()} className={visuallyHidden()} />
      {prefersDark && (
        <MdLightMode
          className={css({
            fontSize: "3xl",
            cursor: "pointer",
            color: "gray.dark.12",
          })}
        />
      )}
      {!prefersDark && (
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
