import { styledKeyboard } from "./app.css";
import { WebsocketProvider, useWebsocket } from "./connectivity/use-websocket";
import { testStyle } from "./test.css";
import i18n from "./i18n/config";
import { onMount, createSignal } from "solid-js";
import { Show } from "solid-js";
import i18next from "i18next";
import { I18nProvider } from "./i18n/18nProvider";
import { createI18n, useI18n } from "./i18n/context";

function Body() {
	const [current, send] = useWebsocket();
	const [c2] = useWebsocket();
	const i18n = useI18n();

	return (
		<div>
			<header class={testStyle}>
				<p>
					Edit <code>src/App.jsx</code> and save to reload.
				</p>
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
