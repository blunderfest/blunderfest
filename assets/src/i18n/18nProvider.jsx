import { I18nContext } from "./context";

/**
 * @param {{ i18n: import("i18next").i18n; children: import("solid-js").JSX.Element }} props
 */
export function I18nProvider(props) {
	return (
		<I18nContext.Provider value={props.i18n}>
			{props.children}
		</I18nContext.Provider>
	);
}
