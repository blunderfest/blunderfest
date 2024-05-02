import { createAppSlice } from "@/store/createAppSlice";
import { createListenerMiddleware, isAction } from "@reduxjs/toolkit";
import camelcaseKeys from "camelcase-keys";
import { Channel, Socket } from "phoenix";
import snakecaseKeys from "snakecase-keys";

const socket = new Socket("/socket", { params: { token: window.config.userToken } });
const channels: Record<string, Channel> = {};

const websocketListener = createListenerMiddleware();
websocketListener.startListening({
  effect(action) {
    const room = channels[window.config.roomCode];

    const { type, ...payload } = action;
    room.push(
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

const initialState: {
  status: "connecting" | "connected" | "disconnected";
} = {
  status: "disconnected",
};

export const socketSlice = createAppSlice({
  name: "socket",
  initialState,
  
  reducers: (create) => ({
    connect: create.asyncThunk(
      (_: void) => {
        return new Promise<void>((resolve) => {
          socket.onOpen(() => resolve());
          socket.connect();
        });
      },
      {
        pending: (state) => {
          state.status = "connecting";
        },
        fulfilled: (state) => {
          state.status = "connected";
        },
      }
    ),

    disconnect: create.asyncThunk(
      (_: void) => {
        return new Promise<void>((resolve) => {
          socket.disconnect();
          resolve();
        });
      },
      {
        fulfilled: (state) => {
          state.status = "disconnected";
        },
      }
    ),

    join: create.asyncThunk((roomCode: string, { dispatch }) => {
      return new Promise<void>((resolve, reject) => {
        const channel = socket.channel("room:" + roomCode);

        channel.onMessage = (type, payload) => {
          if (type.includes("/")) {
            const action = { type, ...payload };

            dispatch(
              camelcaseKeys(action, {
                deep: true,
              })
            );
          }

          return payload;
        };

        channel
          .join()
          .receive("ok", () => {
            channels[roomCode] = channel;
            resolve();
          })
          .receive("error", (response) => {
            reject(new Error(response));
          });
      });
    }),
  }),
});

export const websocketMiddleware = websocketListener.middleware;

export const { connect, disconnect, join } = socketSlice.actions;
