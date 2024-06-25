import { connect, connected, disconnected } from "@/store/actions";
import { convertKeysToCamelCase, deepGet, convertKeysToSnakeCase } from "@/utils";
import { Socket } from "phoenix";

export const socket = new Socket("/socket", { params: { token: window["userToken"] } });
export const channel = socket.channel("room:" + window["roomCode"], {});

/**
 * @type {import("@reduxjs/toolkit").Middleware<{}, import("@/store").RootState, import("@reduxjs/toolkit").Dispatch>}
 */
export const socketMiddleware = (api) => {
  socket.onClose(() => {
    api.dispatch(disconnected());
  });

  channel.onMessage = (event, originalPayload, _ref) => {
    const {
      meta = {
        source: "server",
      },
      ...payload
    } = originalPayload ?? {};

    const action = {
      type: event,
      meta: meta,
      payload: payload.payload ?? payload,
    };

    const message = convertKeysToCamelCase(action);
    api.dispatch(message);

    return originalPayload;
  };

  return (next) =>
    /**
     * @param {import ("@reduxjs/toolkit").UnknownAction} action
     */
    (action) => {
      if (connect.match(action)) {
        socket.connect();
        channel.join().receive("ok", (response) => {
          next(connected(response.user_id, response.room));
        });

        return;
      }

      const result = next(action);

      if (
        deepGet(action, ["meta", "source"]) === "local" &&
        deepGet(action, ["meta", "triggeredBy"]) === api.getState().connectivity.userId
      ) {
        const { type, ...rest } = action;
        channel.push(type, convertKeysToSnakeCase(rest));
      }

      return result;
    };
};
