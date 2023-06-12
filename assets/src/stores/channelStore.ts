import { Channel, Socket } from "phoenix";

import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    status: "online" | "offline";
    connect: (roomCode: string) => void;
    disconnect: () => void;
};

let socket: Socket | undefined = undefined;
let channel: Channel | undefined = undefined;

const state: Lens<ChannelStoreState> = set => {
    return {
        status: "offline",
        connect(roomCode) {
            socket = new Socket("/socket");
            socket.connect();

            channel = socket.channel(`room:${roomCode}`, {});
            channel
                .join()
                .receive("ok", () => {
                    set({ status: "online" });
                })
                .receive("error", () => {
                    set({ status: "offline" });
                });
        },
        disconnect() {
            if (socket) {
                socket.disconnect();
                channel = undefined;
                socket = undefined;
                set({ status: "offline" });
            }
        },
    };
};

export const channelStore = lens(state);
