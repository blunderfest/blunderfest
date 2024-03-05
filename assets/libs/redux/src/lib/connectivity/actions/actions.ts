import { createAsyncThunk } from "@reduxjs/toolkit";
import { Channel, Socket } from "phoenix";

//"window.userToken"
const socket = new Socket("/socket", { params: { token: undefined } });

const channels: Record<string, Channel> = {};

export const connect = createAsyncThunk("connect", () => {
    return new Promise<void>((resolve, reject) => {
        socket.connect();
        socket.onOpen(() => resolve());
        socket.onError((e) => {
            console.error(e);
            reject();
        });
    });
});

export const disconnect = createAsyncThunk("disconnect", () => {
    return new Promise<void>((resolve) => {
        socket.disconnect();
        resolve();
    });
});

export const join = createAsyncThunk(
    "join",
    (
        params: {
            userId: string;
            roomCode: string;
        },
        { dispatch, fulfillWithValue, rejectWithValue }
    ) => {
        const { userId, roomCode } = params;

        const channel = socket.channel("room:" + roomCode, {
            user_id: userId,
        });

        channels[roomCode] = channel;

        channel
            .join()
            .receive("ok", () => fulfillWithValue(params))
            .receive("error", (resp) => {
                console.error(resp);

                rejectWithValue({ message: "Unable to join", resp });
            });

        channel.onMessage = (event, payload) => {
            dispatch({
                type: event,
                payload,
                meta: {
                    remote: true,
                },
            });

            return payload;
        };

        channel.onClose(() => {
            if (channel.state !== "leaving") {
                dispatch(leave({ roomCode: roomCode }));
            }
        });

        channel.onError((reason) => {
            rejectWithValue(reason);
        });
    }
);

export const leave = createAsyncThunk("leave", (params: { roomCode: string }, { fulfillWithValue, rejectWithValue }) => {
    const channel = selectChannel(params.roomCode);

    if (!channel || channel.state !== "joined") {
        rejectWithValue("Not joined");
    } else {
        if (channel.state === "joined") {
            channel.leave();
        }

        delete channels[params.roomCode];
        fulfillWithValue(params);
    }
});

export const selectChannel = (roomCode: string) => channels[roomCode];
