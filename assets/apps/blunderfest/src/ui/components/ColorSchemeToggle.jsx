import { css } from "@blunderfest/design-system/styled-system/css";
import { visuallyHidden } from "@blunderfest/design-system/styled-system/patterns/visually-hidden";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useColorScheme } from "storev2/useColorScheme";

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
