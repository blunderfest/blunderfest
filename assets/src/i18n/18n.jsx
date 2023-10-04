import i18next from "i18next";
import {
	Show,
	createContext,
	createSignal,
	onMount,
	useContext,
} from "solid-js";
import { i18n } from "./config.js";

/**
 * @type {import('solid-js').Context<[import("solid-js").Accessor<I18n>, (lang: "nl" | "en") => void] | undefined>}
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
 * @returns
 */
export function I18nProvider(props) {
	const [loaded, setLoaded] = createSignal(false);
	const [i18nStore, updateStore] = createSignal(i18next);

	onMount(async () => {
		await i18n;

		updateStore({ ...i18next });
		setLoaded(true);
	});

	const changeLanguage = (/** @type {"nl" | "en"} */ lang) => {
		// eslint-disable-next-line import/no-named-as-default-member
		i18next.changeLanguage(lang).then(() => {
			updateStore({ ...i18next });
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
