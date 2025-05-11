import { dir,use as i18nUse } from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

const i18n = i18nUse(initReactI18next).init({
  resources,
  lng: "en", // TODO: if you are not supporting multiple languages or languages with multiple directions you can set the default value to `en`
  fallbackLng: "en",
  compatibilityJSON: "v4", // By default React Native projects does not support Intl

  // allows integrating dynamic values into translations.
  interpolation: {
    escapeValue: false, // escape passed in values to avoid XSS injections
  },
});

// Is it a RTL language?
export const isRTL: boolean = dir() === "rtl";

export default i18n;
