/* eslint-disable import/no-named-as-default-member */

import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import {
	Show,
	createContext,
	createSignal,
	onMount,
	useContext,
} from "solid-js";
import { createStore } from "solid-js/store";

import en from "./en/translations.json";
import nl from "./nl/translations.json";

const i18n = i18next.use(LanguageDetector).init(
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

/**
 * @type {import('solid-js').Context<[I18n, (lang: Language) => void] | undefined>}
 */
const I18nContext = createContext();

export function useI18n() {
	const context = useContext(I18nContext);

	if (!context) {
		throw new ReferenceError("I18nContext");
	}

	return context;
}

/**
 * @param {{children: Children}} props
 */
export function I18nProvider(props) {
	const [loaded, setLoaded] = createSignal(false);
	const [i18nStore, updateStore] = createStore({
		...i18next,
		t: i18next.t.bind({}),
	});

	onMount(async () => {
		await i18n;

		updateStore({ ...i18next });
		setLoaded(true);
	});

	const changeLanguage = (/** @type Language */ lang) => {
		i18next.changeLanguage(lang).then(() => {
			updateStore({ ...i18next, t: i18next.t.bind({}) });
		});
	};

	return (
		<Show when={loaded()}>
			<I18nContext.Provider value={[i18nStore, changeLanguage]}>
				{props.children}
			</I18nContext.Provider>
		</Show>
	);
}
