import { WebsocketProvider, useWebsocket } from "./connectivity/use-websocket";
import { styledKeyboard } from "./app.css";
import { testStyle } from "./test.css";

function Body() {
	const [current, send] = useWebsocket();
	const [c2] = useWebsocket();

	return (
		<div>
			<header class={testStyle}>
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
