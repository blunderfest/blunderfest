import { useTranslation } from "react-i18next";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div aria-describedby="language-picker-description">
      <select className="bg-transparent" onChange={(e) => i18n.changeLanguage(e.target.value)} value={i18n.language}>
        <option value="en">English</option>
        <option value="nl">Nederlands</option>
      </select>
    </div>
  );
}
