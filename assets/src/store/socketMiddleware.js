import { connect, connected, disconnected } from "@/store/actions";
import { isAction } from "@reduxjs/toolkit";
import { Socket } from "phoenix";

/**
 * @param {any} obj
 * @param {(str: string) => string} converter
 */
function iterate(obj, converter) {
  if (Array.isArray(obj)) {
    return obj.map((value) => iterate(value, converter));
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const convertedKey = converter(key);
      acc[convertedKey] = iterate(obj[key], converter);

      return acc;
    }, {});
  }

  return obj;
}

function convertKeysToCamelCase(obj) {
  return iterate(obj, (str) => str.replace(/_./g, (match) => match.charAt(1).toUpperCase()));
}

function convertKeysToSnakeCase(obj) {
  return iterate(obj, (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase());
}

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

  return (next) => (action) => {
    if (connect.match(action)) {
      socket.connect();
      channel.join().receive("ok", (response) => {
        next(connected(response.user_id, response.room));
      });

      return;
    }

    const result = next(action);

    if (
      isAction(action) &&
      "meta" in action &&
      typeof action.meta === "object" &&
      action.meta !== null &&
      "source" in action.meta &&
      action.meta.source === api.getState().connectivity.userId
    ) {
      const { type, ...rest } = action;
      channel.push(type, convertKeysToSnakeCase(rest));
    }

    return result;
  };
};
