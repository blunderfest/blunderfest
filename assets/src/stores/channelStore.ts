import { Socket } from "phoenix";
import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    ready: boolean;
    connect: () => void;
};

const state: Lens<ChannelStoreState> = set => ({
    ready: false,
    connect: () => {
        console.log("Connecting...");
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

export const channelStore = lens(state);
