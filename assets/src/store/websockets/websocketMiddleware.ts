import { Middleware } from "@reduxjs/toolkit";
import { connectivitySlice } from "../slices/connectivitySlice";
import { socketHandler } from "./socketHandler";

export const websocketMiddleware: Middleware = ({ dispatch }) => {
  const socket = socketHandler(dispatch);

  return (next) => {
    return (action) => {
      const result = next(action);

      if (connectivitySlice.actions.connect.match(action)) {
        const { roomCode, userToken } = action.payload;
        socket.connect(userToken, roomCode);
      } else {
        socket.handle(action);
      }

      return result;
    };
  };
};
