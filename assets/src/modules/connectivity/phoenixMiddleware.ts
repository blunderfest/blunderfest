import { Channel, Socket } from "phoenix";
import { RootState } from "~/modules/store";

import { Middleware } from "@reduxjs/toolkit";

import { connectivityActions } from "./connectivitySlice";

export const phoenixMiddleware: Middleware<Record<string, never>, RootState> = store => {
    let socket: Socket;
    let channel: Channel;

    return next => action => {
        if (connectivityActions.connect.match(action)) {
            if (socket && socket.isConnected()) {
                socket.disconnect();
            }

            socket = new Socket("/socket");

            socket.connect();

            channel = socket.channel(`room:${action.payload}`);
            channel.join().receive("ok", () => {
                next(action);
            });

            channel.on("presence_state", response => {
                store.dispatch(connectivityActions.presenceState(response));
            });

            channel.on("presence_diff", response => {
                store.dispatch(connectivityActions.presenceDiff(response));
            });
        } else if (connectivityActions.disconnect.match(action)) {
            channel.leave();
            socket.disconnect();

            next(action);
        } else {
            next(action);
        }
    };
};
