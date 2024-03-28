import { connect, disconnect } from "@/actions/joined";
import { Middleware } from "@reduxjs/toolkit";
import { socketHandler } from "./socketHandler";

const userToken = document.querySelector("meta[name='user_token']")!.getAttribute("content")!;
const roomCode = document.querySelector("meta[name='room_code']")!.getAttribute("content")!;

export const websocketMiddleware: Middleware = ({ dispatch }) => {
  const socket = socketHandler(dispatch);

  return (next) => {
    return (action) => {
      const result = next(action);

      if (connect.match(action)) {
        socket.connect(userToken, roomCode);
      } else if (disconnect.match(action)) {
        socket.disconnect();
      } else {
        socket.handle(action);
      }

      return result;
    };
  };
};
