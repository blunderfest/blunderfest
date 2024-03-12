import { Middleware, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { connect, disconnect, join, leave } from "../actions/actions";
import { createSocket } from "./createSocket";

const isLocalAction = (
    action: unknown
): action is PayloadAction<object, string, { roomCode: string; remote: boolean }, unknown> => {
    return (
        typeof action === "object" &&
        action !== null &&
        "meta" in action &&
        action.meta !== null &&
        typeof action.meta === "object" &&
        "roomCode" in action.meta
    );
};

export const websocketMiddleware: Middleware<unknown, RootState> = ({ dispatch }) => {
    const socket = createSocket(dispatch);

    return (next) => {
        return (action) => {
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

            if (isLocalAction(action) && !action.meta.remote) {
                socket.send(action.meta.roomCode, action);
            }

            return result;
        };
    };
};
