import { connect, connected } from "@/store/actions";
import { Action, Middleware, isAction } from "@reduxjs/toolkit";
import { createSocket } from "./createSocket";
import { convertKeysToCamelCase } from "@/lib/keyconverter";
import { RootState } from "@/store";

function isCustomAction(action: unknown): action is Action & {
  meta: {
    source: "local" | "server";
    triggeredBy: string;
  };
} {
  return (
    isAction(action) &&
    "meta" in action &&
    typeof action.meta === "object" &&
    action.meta !== null &&
    "source" in action.meta &&
    "triggeredBy" in action.meta
  );
}

export const socketMiddleware: Middleware<RootState> = (api) => {
  const { socket, channel } = createSocket(api.dispatch);

  return (next) => (action) => {
    if (connect.match(action)) {
      socket.connect();
      channel.join().receive("ok", (response) => {
        const converted = convertKeysToCamelCase(response);

        next(connected(converted.userId, converted.room));
      });

      return;
    }

    const result = next(action);

    if (
      isCustomAction(action) &&
      action.meta.source === "local" &&
      action.meta.triggeredBy === api.getState().connectivity.userId
    ) {
      const { type, ...payload } = action;
      channel.push(type, payload);
    }

    return result;
  };
};
