import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { initReactI18next } from "react-i18next";

import enBoard from "./en/board.json";
import enTranslations from "./en/translations.json";
import nlBoard from "./nl/board.json";
import nlTranslations from "./nl/translations.json";

const i18n = i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .init(
    {
      resources: {
        en: {
          translations: enTranslations,
          board: enBoard,
        },
        nl: {
          translations: nlTranslations,
          board: nlBoard,
        },
      },
      fallbackLng: "en",
      supportedLngs: ["en", "nl"],
      ns: "translations",
      defaultNS: "translations",
      fallbackNS: false,
      debug: true,
      detection: {
        order: ["querystring", "navigator", "htmlTag"],
        lookupQuerystring: "lang",
      },
    },
    (err) => {
      if (err) {
        return console.error(err);
      }
    },
  );

export default i18n;
