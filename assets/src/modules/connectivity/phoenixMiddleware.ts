import { Channel, Socket } from "phoenix";
import { RootState } from "~/modules/store";

import { Middleware } from "@reduxjs/toolkit";

import { connectivityActions } from "./connectivitySlice";

const snakeCaseToCamelCase = (input: string) =>
    input
        .split("_")
        .reduce(
            (res, word, i) =>
                i === 0 ? word.toLowerCase() : `${res}${word.charAt(0).toUpperCase()}${word.substr(1).toLowerCase()}`,
            "",
        );

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

            socket.onMessage(message => {
                const { topic, event, payload, join_ref } = message;
                if (channel.isMember(topic, event, payload, join_ref)) {
                    const type = event.includes("/") ? event : `connectivity/${event}`;
                    const correctlyCased = snakeCaseToCamelCase(type);

                    store.dispatch({ type: correctlyCased, payload: payload });
                }
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
