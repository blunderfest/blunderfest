import { createListenerMiddleware } from "@reduxjs/toolkit";
import { Socket } from "phoenix";
import { connect, connected, joined, left } from "./slices/connectivitySlice";
import { AppDispatch, RootState } from "./store";

const websocket = createListenerMiddleware();
const startAppListening = websocket.startListening.withTypes<RootState, AppDispatch>();

startAppListening({
  actionCreator: connect,
  effect: (action, { dispatch }) => {
    const { roomCode, userToken } = action.payload;

    const socket = new Socket("/socket", { params: { token: userToken } });
    socket.connect();

    socket.onOpen(() => {
      dispatch(connected());

      const channel = socket.channel("room:" + roomCode);

      channel
        .join()
        .receive("ok", (game) => {
          dispatch(
            joined({
              roomCode,
              userToken,
            })
          );
        })
        .receive("error", (resp) => {
          if (resp === "room_not_found") {
            socket.disconnect();
            location.href = "/";
          } else {
            console.error("channel.join", resp);
          }
        });

      channel.onMessage = (event, payload) => {
        dispatch({
          type: event,
          payload,
        });

        return payload;
      };

      channel.onClose(() => {
        if (channel.state !== "leaving") {
          dispatch(left());
        }
      });

      channel.onError(() => {});
    });
  },
});

export const websocketMiddleware = websocket.middleware;
