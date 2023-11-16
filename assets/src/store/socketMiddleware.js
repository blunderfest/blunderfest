import { connected, disconnected } from "@/store/actions";
import { Socket } from "phoenix";

/**
 * @template T
 * @param {import("@reduxjs/toolkit").PayloadAction<T>} action
 */
function fromServer(action) {
  return {
    ...action,
    meta: {
      fromServer: true,
    },
  };
}

/**
 * @type {import("@reduxjs/toolkit").Middleware}
 */
export const socketMiddleware = ({ dispatch }) => {
  const socket = new Socket("/socket");
  const roomCode = document.querySelector('meta[name="room-code"]')?.getAttribute("content");

  if (!roomCode) {
    return (next) => (action) => next(action);
  }

  const channel = socket.channel(`room:${roomCode}`);

  socket.connect();

  socket.onMessage(
    /**
     * @param {{event: string, payload: any} | any} message
     */
    (message) => {
      const { event, payload } = message;

      if (event === "phx_reply") {
        return;
      }

      if (event && payload) {
        dispatch(
          fromServer({
            type: event,
            payload: payload,
          }),
        );
      }
    },
  );

  channel
    .join()
    .receive("ok", (response) => {
      dispatch(fromServer(connected(response.user_id, roomCode)));
    })
    .receive("error", () => {
      dispatch(fromServer(disconnected()));
    });

  return (next) => {
    return async (action) => {
      if (action.meta && action.meta.fromServer) {
        next(action);
      } else {
        channel.push(action.type, action.payload);
      }
    };
  };
};
