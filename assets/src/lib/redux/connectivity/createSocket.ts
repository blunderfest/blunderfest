import { AppDispatch, isRoomAction } from "@blunderfest/redux";
import { PayloadAction } from "@reduxjs/toolkit";
import { Channel, Socket } from "phoenix";
import { connected, disconnected, joined, leave, left } from ".";

export const createSocket = (dispatch: AppDispatch) => {
    const socket = new Socket("/socket", { params: { token: undefined } });
    const channels: Record<string, Channel> = {};

    const connect = () => {
        socket.connect();
        socket.onOpen(() => {
            dispatch(connected());
        });

        socket.onError((e) => {
            console.error("socket.onError", e);
            dispatch(disconnected());
        });
    };

    const disconnect = () => {
        socket.disconnect();
        dispatch(disconnected());
    };

    const join = (userId: string, roomCode: string) => {
        const channel = socket.channel("room:" + roomCode, {
            user_id: userId,
        });

        channels[roomCode] = channel;

        channel
            .join()
            .receive("ok", (game) => {
                dispatch(joined(game));
            })
            .receive("error", (resp) => {
                console.error("channel.join", resp);

                dispatch(left(roomCode));
            });

        channel.onMessage = (event, payload) => {
            if (isRoomAction(payload)) {
                console.log("RECEIVED", event, payload);

                dispatch({
                    type: event,
                    payload: payload.payload,
                    meta: {
                        ...payload.meta,
                        remote: true,
                    },
                });
            }

            return payload;
        };

        channel.onClose(() => {
            if (channel.state !== "leaving") {
                dispatch(leave(roomCode));
            }
        });

        channel.onError((reason) => {
            console.error("channel.onError", reason ?? "No reason given");

            dispatch(leave(roomCode));
        });
    };

    const leaveRoom = (roomCode: string) => {
        const channel = channels[roomCode];

        if (channel) {
            if (channel.state === "joined") {
                channel.leave();
            }

            delete channels[roomCode];
            dispatch(left(roomCode));
        }
    };

    const send = (roomCode: string, action: PayloadAction<object, string, object>) => {
        const channel = channels[roomCode];

        if (channel) {
            channel.push(action.type, { meta: action.meta, payload: action.payload });
        }
    };

    return {
        connect,
        disconnect,
        join,
        leave: leaveRoom,
        send,
    };
};
