import { Socket } from "phoenix";

import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    ready: boolean;
    connect: (roomCode: string) => void;
    disconnect: () => void;
};

let socket: Socket | undefined = undefined;

const state: Lens<ChannelStoreState> = set => {
    return {
        ready: false,
        connect(roomCode) {
            socket = new Socket("/socket");
            socket.connect();

            const channel = socket.channel(`room:${roomCode}`, {});
            channel
                .join()
                .receive("ok", () => {
                    set({ ready: true });
                })
                .receive("error", () => {
                    set({ ready: false });
                });
        },
        disconnect() {
            if (socket) {
                socket.disconnect();
                socket = undefined;
                set({ ready: false });
            }
        },
    };
};

export const channelStore = lens(state);
