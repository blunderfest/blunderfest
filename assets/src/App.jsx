import { BiSolidCompass } from "solid-icons/bi";
import { TbBrandSolidjs } from "solid-icons/tb";
import { styledKeyboard } from "./app.css.ts";
import {
	WebsocketProvider,
	useWebsocket,
} from "./connectivity/use-websocket.jsx";
import { I18nProvider, useI18n } from "./i18n/18n.jsx";
import { testStyle } from "./test.css.ts";

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
				<TbBrandSolidjs />
				<button onClick={() => send("CONNECT")}>{current.value}</button>
				<p>{c2.value}</p>

				<button onClick={() => changeLanguage("en")}>EN</button>
				<button onClick={() => changeLanguage("nl")}>NL</button>

				<h1>{i18n().t("title")}</h1>

				<p>{i18n().t("messages_count", { count: 1 })}</p>
				<p>{i18n().t("messages_count", { count: 2 })}</p>
				<p>{i18n().t("messages_count", { count: 100 })}</p>

				<div class={styledKeyboard} />
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
