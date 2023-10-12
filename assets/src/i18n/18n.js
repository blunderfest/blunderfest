import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import { initReactI18next } from "react-i18next";
import en from "./en/translations.json";
import nl from "./nl/translations.json";

const i18n = i18next
	.use(initReactI18next)
	.use(LanguageDetector)
	.init(
		{
			resources: {
				en: {
					translations: en,
				},
				nl: {
					translations: nl,
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