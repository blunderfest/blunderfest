import { connected, disconnected, userJoined, userLeft } from "@/store/actions";
import { Presence, Socket } from "phoenix";

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
export const socketMiddleware = ({ dispatch, getState }) => {
  const socket = new Socket("/socket");
  const roomCode = document.querySelector('meta[name="room-code"]')?.getAttribute("content");

  if (!roomCode) {
    return (next) => (action) => next(action);
  }

  const channel = socket.channel(`room:${roomCode}`);
  const presence = new Presence(channel);

  socket.connect();

  presence.onJoin((userId) => {
    const currentUserId = getState().connectivity.userId;

    if (userId && currentUserId !== userId) {
      dispatch(fromServer(userJoined(userId)));
    }
  });

  presence.onLeave((userId) => {
    const currentUserId = getState().connectivity.userId;

    if (userId && currentUserId !== userId) {
      dispatch(fromServer(userLeft(userId)));
    }
  });

  channel
    .join()
    .receive("ok", (response) => {
      dispatch(fromServer(connected(response.user_id, roomCode)));
    })
    .receive("error", () => {
      dispatch(fromServer(disconnected()));
    });

  channel.on("shout", (response) => {
    dispatch(fromServer(response));
  });

  return (next) => {
    return async (action) => {
      if (action.meta && action.meta.fromServer) {
        next(action);
      } else {
        channel.push("shout", action);
      }
    };
  };
};
