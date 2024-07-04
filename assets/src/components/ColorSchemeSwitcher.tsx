import { useLocalStorage } from "react-use";
import { MdOutlineLightMode, MdDarkMode } from "react-icons/md";
import { Button } from "./Button";
import { useTranslation } from "react-i18next";

export function ColorSchemeSwitcher() {
  const [scheme, setScheme] = useLocalStorage("color-scheme", "dark", { raw: true });
  const { t } = useTranslation();

  const isDarkMode = scheme === "dark";

  const handleClick = () => {
    const newMode = isDarkMode ? "light" : "dark";

    if (newMode === "light") {
      window.document.documentElement.classList.remove("dark");
    } else {
      window.document.documentElement.classList.add("dark");
    }

    setScheme(newMode);
  };

  return (
    <Button
      aria-label={t("colorscheme.switch", { color: isDarkMode ? t("colorscheme.light") : t("colorscheme.dark") })}
      color="secondary"
      onClick={handleClick}
      size="md">
      {isDarkMode ? <MdOutlineLightMode /> : <MdDarkMode />}
    </Button>
  );
}
