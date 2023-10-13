import { Presence, Socket } from "phoenix";
import { connected, disconnected } from "./connectivitySlice";
import { update } from "./presenceSlice";

/**
 * @type {import("@reduxjs/toolkit").Middleware}
 */
export const socketMiddleware = ({ dispatch, getState }) => {
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

	channel.on("shout", (response) => {
		const userId = getState().system.connectivity.userId;

		if (response.type && response.from !== userId) {
			dispatch(response);
		}
	});

	return (next) => {
		return async (action) => {
			const userId = getState().system.connectivity.userId;

			if (!Object.prototype.hasOwnProperty.call(action, "from") && !action.type.startsWith("system/")) {
				channel.push("shout", { ...action, from: userId });
			}

			return next(action);
		};
	};
};
