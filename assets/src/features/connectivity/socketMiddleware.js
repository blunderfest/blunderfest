import { connect, disconnect } from "@/store/connectivity/actions";
import { join, leave } from "@/store/room/actions";
import { Presence, Socket } from "phoenix";

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
      dispatch(join(userId));
    }
  });

  presence.onLeave((userId) => {
    const currentUserId = getState().connectivity.userId;

    if (userId && currentUserId !== userId) {
      dispatch(leave(userId));
    }
  });

  channel
    .join()
    .receive("ok", (response) => {
      dispatch(connect(response.user_id, roomCode));
    })
    .receive("error", () => {
      dispatch(disconnect());
    });

  channel.on("shout", (response) => {
    dispatch({
      ...response,
      meta: {
        skipSocket: true,
      },
    });
  });

  return (next) => {
    return async (action) => {
      if (action.meta && action.meta.skipSocket) {
        next(action);
      } else {
        channel.push("shout", action);
      }
    };
  };
};
