import { connect, connected, disconnected } from "@/store/actions";
import { isAction } from "@reduxjs/toolkit";
import { Socket } from "phoenix";

function toCamelCase(str) {
  return str.replace(/_./g, (match) => match.charAt(1).toUpperCase());
}

function convertKeysToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const camelCaseKey = toCamelCase(key);
      acc[camelCaseKey] = convertKeysToCamelCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

function toSnakeCase(str) {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function convertKeysToSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeCaseKey = toSnakeCase(key);
      acc[snakeCaseKey] = convertKeysToSnakeCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
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
    } = originalPayload;

    const action = {
      type: event,
      meta: meta,
      payload: payload,
    };

    api.dispatch(convertKeysToCamelCase(action));

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
      const { type, ...payload } = action;
      channel.push(type, convertKeysToSnakeCase(payload));
    }

    return result;
  };
};
