import { useLocalStorage } from "react-use";
import { MdOutlineLightMode, MdDarkMode } from "react-icons/md";

export function ColorSchemeSwitcher() {
  const [scheme, setScheme] = useLocalStorage("color-scheme", "dark", { raw: true });
  console.log(scheme);
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
    <button
      className="flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-700"
      onClick={handleClick}
      aria-label={`Toggle ${isDarkMode ? "light" : "dark"} mode`}>
      {isDarkMode ? <MdOutlineLightMode /> : <MdDarkMode />}
    </button>
  );
}
