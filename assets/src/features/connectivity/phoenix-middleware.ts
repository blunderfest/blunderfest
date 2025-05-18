import { isAction, type Middleware } from "@reduxjs/toolkit";
import { Socket } from "phoenix";

import { convertKeysToCamelCase } from "~/lib/keyconverter";

import { connect, connected, disconnect } from "./connectivity-slice";

export const phoenixMiddleware: Middleware = (api) => (next) => {
  const socket = new Socket("/socket");
  const channel = socket.channel("room:" + window.roomCode, {});

  socket.onClose(() => {
    next(disconnect());
  });

  channel.onMessage = (event, originalPayload, _ref) => {
    const { meta, ...payload } = originalPayload ?? {};

    const action = {
      type: event,
      meta: meta,
      payload: payload.payload ?? payload,
    };

    const message = convertKeysToCamelCase(action);
    next(message);

    return originalPayload;
  };

  return (action) => {
    if (connect.match(action)) {
      socket.connect();
      channel.join().receive("ok", (response) => {
        const converted = convertKeysToCamelCase(response);

        next(
          connected({
            userId: converted.userId,
            room: converted.room,
          }),
        );
      });

      return;
    }

    const result = next(action);

    if (isAction(action) && !("meta" in action)) {
      const { type, ...payload } = action;
      const userId = api.getState().connectivity.userId;

      channel.push(type, {
        ...payload,
        meta: {
          triggeredBy: userId,
          source: "local",
        },
      });
    }

    return result;
  };
};
