import { useLocalStorage } from "react-use";
import { MdOutlineLightMode, MdDarkMode } from "react-icons/md";
import { Button } from "./Button";

export function ColorSchemeSwitcher() {
  const [scheme, setScheme] = useLocalStorage("color-scheme", "dark", { raw: true });
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
    <Button onClick={handleClick} color="secondary" size="md" aria-label={`Toggle ${isDarkMode ? "light" : "dark"} mode`}>
      {isDarkMode ? <MdOutlineLightMode /> : <MdDarkMode />}
    </Button>
  );
}
