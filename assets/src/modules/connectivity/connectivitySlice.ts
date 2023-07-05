import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type Meta = {
    online_at: number;
    phx_ref: string;
    user_id: string;
};

export type Message<T> = {
    join_ref: number;
    ref: number;
    event: string;
    topic: string;
    payload?: T;
};

type PresenceState = {
    [id: string]: {
        metas: Meta[];
    };
};

type PresenceDiff = {
    joins: Record<string, { metas: Meta[] }>;
    leaves: Record<string, { metas: Meta[] }>;
};

type State = {
    status: "online" | "offline";
    users: PresenceState;
    roomCode: string;
};

const initialState: State = {
    status: "offline",
    users: {},
    roomCode: "",
};

const connectivitySlice = createSlice({
    name: "connectivity",
    initialState,
    reducers: {
        connect: (state, action: PayloadAction<string>) => {
            state.status = "online";
            state.roomCode = action.payload;
        },
        disconnect: state => void (state.status = "offline"),
        presenceState: (state, action: PayloadAction<PresenceState>) => {
            Object.keys(action.payload).forEach(id => {
                const user = action.payload[id];
                const metas = user.metas.map(meta => ({ ...meta, online_at: Number(meta.online_at) }));

                state.users[id] = { ...user, metas: metas };
            });
        },
        presenceDiff: (state, action: PayloadAction<PresenceDiff>) => {
            const joins = Object.keys(action.payload.joins);
            joins.forEach(id => {
                const user = action.payload.joins[id];
                const metas = user.metas.map(meta => ({ ...meta, online_at: Number(meta.online_at) }));

                state.users[id] = { ...user, metas: metas };
            });

            const leaves = Object.keys(action.payload.leaves);
            leaves.forEach(element => {
                delete state.users[element];
            });
        },
    },
});

export const connectivityReducer = connectivitySlice.reducer;
export const connectivityActions = connectivitySlice.actions;
