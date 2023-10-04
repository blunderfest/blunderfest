import { createContext, createSignal, useContext } from "solid-js";

/**
 * @type {import("solid-js").Context<[import("solid-js").Accessor<string>, (event: keyof transitions) => void] | undefined>}
 */
export const WebsocketContext = createContext();

/**
 * @param {{children: import("solid-js").JSX.Element}} props
 */
export function WebsocketProvider(props) {
	return (
		<WebsocketContext.Provider value={[connectionStatus, update]}>
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
				resolve(null);
			} else {
				reject();
			}
		}, 1000);
	});
};

const states = {
	offline: "Offline",
	connecting: "Connecting",
	online: "Online",
	error: "Error",
};

const transitions = {
	Connect: {
		[states.offline]: states.online,
		[states.online]: states.offline,
	},
	Connected: {
		[states.connecting]: states.online,
	},
};

const actions = {
	Connect: {
		[states.offline]: () => connect(),
		[states.online]: async () => {},
	},
	Connected: {
		[states.connecting]: async () => {},
	},
	Errored: {
		[states.connecting]: async () => {},
	},
};

const [connectionStatus, setConnectionStatus] = createSignal(states.offline);

// let connectionStatus = states.offline;

export const update = (/** @type keyof transitions  */ event) => {
	const nextState = transitions[event][connectionStatus()];
	const action = actions[event][connectionStatus()];

	if (nextState) {
		action()
			.then(() => {
				return setConnectionStatus(nextState);
			})
			.catch(() => {
				return setConnectionStatus(states.error);
			});
	} else {
		console.log("Invalid state transition or event", connectionStatus, event);
	}
};

export function useWebsocket() {
	const context = useContext(WebsocketContext);

	if (!context) {
		throw new ReferenceError("WebsocketContext");
	}

	return context;
}

// const machine = createMachine({
// 	predictableActionArguments: true,
// 	initial: "offline",
// 	states: {
// 		offline: {
// 			on: { CONNECT: "connecting" },
// 		},
// 		connecting: {
// 			invoke: {
// 				src: () => connect(),
// 				onDone: "online",
// 				onError: "error",
// 			},
// 		},
// 		online: {
// 			on: {
// 				CONNECT: "offline",
// 			},
// 		},
// 		error: {},
// 	},
// });

// export function useWebsocket() {
// 	const [current, send] = useContext(WebsocketContext);

// 	return [current, send];
// }
