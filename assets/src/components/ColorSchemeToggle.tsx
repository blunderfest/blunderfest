import { css } from "design-system/css";
import { visuallyHidden } from "design-system/patterns";
import { useTranslation } from "react-i18next";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useColorScheme } from "./useColorScheme";

export function ColorSchemeToggle() {
  const { prefersDark, switchScheme } = useColorScheme();
  const { t } = useTranslation();

  return (
    <label aria-label={t("colorscheme.switch", { color: prefersDark ? t("colorscheme.light") : t("colorscheme.dark") })}>
      <input type="checkbox" checked={prefersDark} onChange={() => switchScheme()} className={visuallyHidden()} />
      {prefersDark && (
        <MdLightMode
          className={css({
            fontSize: "3xl",
            cursor: "pointer",
            color: "radix.amber.11.dark",
          })}
        />
      )}
      {!prefersDark && (
        <MdDarkMode
          className={css({
            fontSize: "3xl",
            cursor: "pointer",
            color: "radix.sky.11.light",
          })}
        />
      )}
    </label>
  );
}
