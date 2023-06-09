import { Socket } from "phoenix";
import { StateCreator } from "zustand";

export type ChannelStoreState = {
    ready: boolean;
};

export const createChannelStore: StateCreator<ChannelStoreState> = (set, get, api) => ({
    ready: false,
    connect: () => {
        const socket = new Socket("/socket");
        socket.connect();

        const channel = socket.channel("room:lobby", {});
        channel
            .join()
            .receive("ok", () => {
                set({
                    ready: true,
                });
            })
            .receive("error", () => {
                set({ ready: false });
            });
    },
});
