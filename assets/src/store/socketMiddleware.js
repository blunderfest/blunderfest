import { setupSocket } from "@/features/connectivity/websocket";
import { connect, connected } from "@/store/actions";

/**
 * @type {import("@reduxjs/toolkit").Middleware<{}, import("@/store").RootState, import("@reduxjs/toolkit").Dispatch>}
 */
export const socketMiddleware = (api) => {
  const { socket, channel, pushToServer } = setupSocket(api.dispatch);

  return (next) => (action) => {
    if (connect.match(action)) {
      socket.connect();
      channel.join().receive("ok", (response) => {
        next(connected(response.user_id, response.room));
      });

      return;
    }

    const result = next(action);

    const userId = api.getState().connectivity.userId;
    pushToServer(action, userId);

    return result;
  };
};
