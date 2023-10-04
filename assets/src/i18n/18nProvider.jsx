import { I18nContext } from "./context";

export function I18nProvider(props) {
	return (
		<I18nContext.Provider value={props.i18n}>
			{props.children}
		</I18nContext.Provider>
	);
}
