import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en/translation.json";
import nl from "@/locales/nl/translation.json";

export const defaultNS = "translation";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    ns: ["translation", "piece"],
    defaultNS,
    resources: {
      en: {
        translation: en,
      },
      nl: {
        translation: nl,
      },
    },
  });

export default i18n;
