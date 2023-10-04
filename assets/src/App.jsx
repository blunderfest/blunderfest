import { BiSolidCompass } from "solid-icons/bi";
import { TbBrandSolidjs } from "solid-icons/tb";
import {
	WebsocketProvider,
	useWebsocket,
} from "./connectivity/use-websocket.jsx";
import { I18nProvider, useI18n } from "./i18n/18n.jsx";

import { css } from "../styled-system/css";

export const styledKeyboard = css({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
});

export const testStyle = css({
	backgroundColor: "red.200",
	fontSize: "2xl",
});

function Body() {
	const [current, send] = useWebsocket();
	const [c2] = useWebsocket();
	const [i18n, changeLanguage] = useI18n();

	return (
		<div>
			<header class={testStyle}>
				<BiSolidCompass size={24} color="#000000" />
				<p>
					Edit <code>src/App.jsx</code> and save to reload.
				</p>
				<div class={css({ fontSize: "2xl", fontWeight: "bold" })}>
					Hello 🐼!
				</div>
				<TbBrandSolidjs />
				<button onClick={() => send("CONNECT")}>
					{current.value} - websocket
				</button>
				<p>{c2.value}</p>

				<button onClick={() => changeLanguage("en")}>EN</button>
				<button onClick={() => changeLanguage("nl")}>NL</button>

				<h1>{i18n.t("title")}</h1>

				<p>{i18n.t("messages_count", { count: 1 })}</p>
				<p>{i18n.t("messages_count", { count: 2 })}</p>
				<p>{i18n.t("messages_count", { count: 100 })}</p>

				<div class={styledKeyboard}>Keyboard</div>
			</header>
		</div>
	);
}

export function App() {
	return (
		<I18nProvider>
			<WebsocketProvider>
				<Body />
			</WebsocketProvider>
		</I18nProvider>
	);
}
