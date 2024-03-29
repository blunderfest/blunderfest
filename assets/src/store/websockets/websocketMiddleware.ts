import { Middleware } from "@reduxjs/toolkit";
import { connect, disconnect } from "~/actions/joined";
import { socketHandler } from "./socketHandler";

const userToken = document.querySelector("meta[name='user_token']")!.getAttribute("content")!;
const roomCode = document.querySelector("meta[name='room_code']")!.getAttribute("content")!;

export const websocketMiddleware: Middleware = ({ dispatch }) => {
  const socket = socketHandler(dispatch, userToken, roomCode);

  return (next) => {
    return (action) => {
      const result = next(action);

      if (connect.match(action)) {
        socket.connect();
      } else if (disconnect.match(action)) {
        socket.disconnect();
      } else {
        socket.handle(action);
      }

      return result;
    };
  };
};
