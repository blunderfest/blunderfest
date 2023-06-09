import { Socket } from "phoenix";
import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    ready: boolean;
    connect: (roomCode: string) => void;
};

const state: Lens<ChannelStoreState> = set => ({
    ready: false,
    connect: roomCode => {
        const socket = new Socket("/socket");
        socket.connect();

        const channel = socket.channel(`room:${roomCode}`, {});
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
