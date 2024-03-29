import { Box } from "@/design-system/jsx";
import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Box aria-describedby="language-picker-description">
      <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="nl">Nederlands</option>
      </select>
    </Box>
  );
}

// <div>
//   {(["en", "nl"] as const).map((lng) => (
//     <button
//       key={lng}
//       style={{ fontWeight: i18n.resolvedLanguage === lng ? "bold" : "normal" }}
//       type="submit"
//       onClick={() => {
//         i18n.changeLanguage(lng);
//       }}>
//       {lngs[lng].nativeName}
//     </button>
//   ))}
// </div>
