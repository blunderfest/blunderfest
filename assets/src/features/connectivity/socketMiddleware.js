import { Presence, Socket } from "phoenix";
import { connected, disconnected } from "./connectivitySlice";
import { update } from "./presenceSlice";

/**
 * @type {import("@reduxjs/toolkit").Middleware}
 */
export const socketMiddleware = ({ dispatch }) => {
	const socket = new Socket("/socket");
	const roomCode = document.querySelector('meta[name="room-code"]')?.getAttribute("content");

	if (!roomCode) {
		return (next) => (action) => next(action);
	}

	/**
	 * @param {Presence} presence
	 */
	function renderOnlineUsers(presence) {
		const ids = presence.list((id) => {
			return id;
		});

		dispatch(update(ids));
	}

	const channel = socket.channel(`room:${roomCode}`);
	const presence = new Presence(channel);

	socket.connect();
	presence.onSync(() => renderOnlineUsers(presence));

	channel
		.join()
		.receive("ok", (response) => {
			dispatch(connected({ roomCode: roomCode, userId: response.user_id }));
		})
		.receive("error", () => {
			dispatch(disconnected());
		});

	socket.onMessage((/** @type {any} */ message) => {
		if (Object.prototype.hasOwnProperty.call(message, "type")) {
			console.log("Dispatching ", message);
			dispatch(message);
		}
	});

	return (next) => {
		return async (action) => {
			// const { dispatch, getState } = params;
			// const { type } = action;
			console.log("action", action);

			// switch (type) {
			// 	case "socket/connect":
			// 		socket.connect("wss://example.com");
			// 		socket.on("open", () => {});
			// 		socket.on("message", (data) => {});
			// 		socket.on("close", () => {});
			// 		break;
			// 	case "socket/disconnect":
			// 		socket.disconnect();
			// 		break;
			// 	default:
			// 		break;
			// }
			return next(action);
		};
	};
};
