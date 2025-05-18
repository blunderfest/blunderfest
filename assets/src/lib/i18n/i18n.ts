import { dir, use } from "i18next";
import { initReactI18next } from "react-i18next";

import { store } from "~/app/store";

import { resources } from "./resources";

const i18n = use(initReactI18next).init({
  resources,
  keySeparator: ".",
  lng: store.getState()["user-preferences"].language,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export const isRTL = dir() === "rtl";

export default i18n;
