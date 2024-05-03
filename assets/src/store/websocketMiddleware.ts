import { userSocket } from "@/features/connectivity/socket";
import { createListenerMiddleware, isAction } from "@reduxjs/toolkit";
import snakecaseKeys from "snakecase-keys";

const websocketListener = createListenerMiddleware();
websocketListener.startListening({
  effect(action) {
    const { type, ...payload } = action;
    userSocket.send(
      `room:${window.config.roomCode}`,
      type,
      snakecaseKeys(payload, {
        shouldRecurse: () => true,
      })
    );
  },
  predicate: (action) =>
    isAction(action) &&
    "meta" in action &&
    typeof action.meta === "object" &&
    action.meta !== null &&
    "userId" in action.meta &&
    action.meta.userId === window.config.userId,
});

export const websocketMiddleware = websocketListener.middleware;
