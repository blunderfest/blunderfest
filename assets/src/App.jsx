import i18next from "i18next";
import { BiSolidCompass } from "solid-icons/bi";
import { TbBrandSolidjs } from "solid-icons/tb";
import { Show, createSignal, onMount } from "solid-js";
import { styledKeyboard } from "./app.css";
import { WebsocketProvider, useWebsocket } from "./connectivity/use-websocket";
import { I18nProvider } from "./i18n/18nProvider";
import i18n from "./i18n/config";
import { createI18n, useI18n } from "./i18n/context";
import { testStyle } from "./test.css";

function Body() {
	const [current, send] = useWebsocket();
	const [c2] = useWebsocket();
	const i18n = useI18n();

	return (
		<div>
			<header class={testStyle}>
				<BiSolidCompass size={24} color="#000000" />
				<p>
					Edit <code>src/App.jsx</code> and save to reload.
				</p>
				<TbBrandSolidjs />
				<button onclick={() => send("CONNECT")}>{current.value}</button>
				<p>{c2.value}</p>

				<h1>{i18n.t("title")}</h1>

				<p>{i18n.t("messages_count", { count: 1 })}</p>
				<p>{i18n.t("messages_count", { count: 2 })}</p>
				<p>{i18n.t("messages_count", { count: 100 })}</p>

				<div class={styledKeyboard}></div>
			</header>
		</div>
	);
}

export function App() {
	const [loaded, setLoaded] = createSignal(false);
	const [i18nStore, updateStore] = createI18n(i18next);

	onMount(async () => {
		await i18n;

		updateStore(i18next);
		setLoaded(true);
	});

	return (
		<Show when={loaded()}>
			<I18nProvider i18n={i18nStore}>
				<WebsocketProvider>
					<Body />
				</WebsocketProvider>
			</I18nProvider>
		</Show>
	);
}
