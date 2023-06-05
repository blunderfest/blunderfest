import { useMachine } from "@xstate/solid";
import { createContext, useContext } from "solid-js";
import { createMachine } from "xstate";

export const WebsocketContext = createContext();

export function WebsocketProvider(props) {
	const [current, send] = useMachine(machine);

	return (
		<WebsocketContext.Provider value={[current, send]}>
			{props.children}
		</WebsocketContext.Provider>
	);
}

const connect = () => {
	return new Promise((resolve, reject) => {
		console.log("Beginning deletion...");
		setTimeout(() => {
			console.log("Done deleting");
			if (Math.random() < 0.8) {
				resolve();
			} else {
				reject();
			}
		}, 1000);
	});
};

const machine = createMachine({
	predictableActionArguments: true,
	initial: "offline",
	states: {
		offline: {
			on: { CONNECT: "connecting" },
		},
		connecting: {
			invoke: {
				src: () => connect(),
				onDone: "online",
				onError: "error",
			},
		},
		online: {
			on: {
				CONNECT: "offline",
			},
		},
		error: {},
	},
});

export function useWebsocket() {
	const [current, send] = useContext(WebsocketContext);

	return [current, send];
}
