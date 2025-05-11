import { dir, use } from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

const i18n = use(initReactI18next).init({
  resources,
  keySeparator: ".",
  lng: "en", // TODO: if you are not supporting multiple languages or languages with multiple directions you can set the default value to `en`
  fallbackLng: "en",
  // allows integrating dynamic values into translations.
  interpolation: {
    escapeValue: false, // escape passed in values to avoid XSS injections
  },
});

// Is it a RTL language?
export const isRTL: boolean = dir() === "rtl";

export default i18n;
