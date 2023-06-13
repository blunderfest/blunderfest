import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import enSystem from "./i18n/en/system.json";

const resources = {
    en: {
        system: enSystem,
    },
};

i18n.use(initReactI18next)
    .use(LanguageDetector)
    .init({
        resources,
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
        debug: true,
        react: { useSuspense: false },
    });

export default i18n;
