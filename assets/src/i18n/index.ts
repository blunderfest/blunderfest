import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

// i18n for the user-facing UI. The server never returns prose: the JSON API
// answers with structured error codes, and the React app owns all copy.
//
// English is the source-of-truth locale; further locales are added by
// dropping a `locales/<code>.json` file and registering it below.
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
