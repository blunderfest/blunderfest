import { isRoomAction } from "@blunderfest/redux";
import { Middleware } from "@reduxjs/toolkit";
import { connect, disconnect, join, leave } from ".";
import { createSocket } from "./createSocket";

export const websocketMiddleware: Middleware = ({ dispatch }) => {
    const socket = createSocket(dispatch);

    return (next) => {
        return (action: unknown) => {
            const result = next(action);

            if (connect.match(action)) {
                socket.connect();
            }

            if (disconnect.match(action)) {
                socket.disconnect();
            }

            if (join.match(action)) {
                const { userId, roomCode } = action.payload;
                socket.join(userId, roomCode);
            }

            if (leave.match(action)) {
                const { roomCode } = action.payload;
                socket.leave(roomCode);
            }

            if (isRoomAction(action)) {
                console.log("SEND", action);
                socket.send(action.meta.roomCode, action);
            } else {
                console.log("NO SEND", action);
            }

            return result;
        };
    };
};
