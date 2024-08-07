import { Middleware, isAction } from "@reduxjs/toolkit";
import { createSocket } from "./createSocket";
import { convertKeysToCamelCase } from "@/lib/keyconverter";
import { RootState } from "@/store";
import { connect, connected } from "@/store/actions";

export const socketMiddleware: Middleware<RootState> = (api) => {
  const { socket, channel } = createSocket(api.dispatch);

  return (next) => (action) => {
    if (connect.match(action)) {
      socket.connect();
      channel.join().receive("ok", (response) => {
        type T = ReturnType<typeof connected>["payload"];
        const converted = convertKeysToCamelCase(response) as T;

        next(connected(converted.userId, converted.room));
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
