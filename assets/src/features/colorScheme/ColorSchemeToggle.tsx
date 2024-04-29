import { useTranslation } from "react-i18next";
import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useColorScheme } from "./useColorScheme";

export function ColorSchemeToggle() {
  const { prefersDark, switchScheme } = useColorScheme();
  const { t } = useTranslation();

  return (
    <label aria-label={t("colorscheme.switch", { color: prefersDark ? t("colorscheme.light") : t("colorscheme.dark") })}>
      <input type="checkbox" checked={prefersDark} onChange={() => switchScheme()} className="sr-only" />
      {prefersDark && <MdLightMode className="cursor-pointer text-3xl text-amber-400" />}
      {!prefersDark && <MdDarkMode className="text-sky-400-400 cursor-pointer text-3xl" />}
    </label>
  );
}
