import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div aria-describedby="language-picker-description">
      <select value={i18n.language} onChange={(e) => i18n.changeLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="nl">Nederlands</option>
      </select>
    </div>
  );
}
