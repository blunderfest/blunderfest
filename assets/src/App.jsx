import logo from "./logo.svg";
import styles from "./App.module.css";

import { WebsocketProvider, useWebsocket } from "./connectivity/use-websocket";
import { styledKeyboard } from "./app.css";

function Body() {
	const [current, send] = useWebsocket();
	const [c2] = useWebsocket();

	return (
		<div class={styles.App}>
			<header class={styles.header}>
				<img src={logo} class={styles.logo} alt="logo" />
				<p>
					Edit <code>src/App.jsx</code> and save to reload.
				</p>
				<button onclick={() => send("CONNECT")}>{current.value}</button>
				<p>{c2.value}</p>

				<div class={styledKeyboard}></div>
			</header>
		</div>
	);
}

function App() {
	return (
		<WebsocketProvider>
			<Body />
		</WebsocketProvider>
	);
}

export default App;
