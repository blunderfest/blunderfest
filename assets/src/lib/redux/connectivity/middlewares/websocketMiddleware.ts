import { Middleware, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "../../store";
import { selectChannel } from "../actions/actions";

const isLocalAction = (action: unknown): action is PayloadAction<object, string, { remote: boolean }, unknown> => {
    return (
        typeof action === "object" &&
        action !== null &&
        "meta" in action &&
        action.meta !== null &&
        typeof action.meta === "object"
    );
};

export const websocketMiddleware: Middleware<unknown, RootState> = ({ getState }) => {
    return (next) => {
        return (action) => {
            const result = next(action);

            if (isLocalAction(action) && !action.meta.remote) {
                const roomCode = getState().connectivity.rooms[0];
                const channel = selectChannel(roomCode);

                if (channel) {
                    channel.push(action.type, action.payload);
                }
            }

            return result;
        };
    };
};
