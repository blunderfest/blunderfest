import { Channel, Socket } from "phoenix";

import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    status: "online" | "offline";
    latency: number;
    connect: (roomCode: string) => void;
    disconnect: () => void;
};
const socket: Socket = new Socket("/socket", {
    heartbeatIntervalMs: 1000,
});

let channel: Channel | undefined = undefined;

const state: Lens<ChannelStoreState> = set => {
    return {
        status: "offline",
        latency: 0,
        connect(roomCode) {
            if (!socket.isConnected()) {
                socket.connect();
            }
            channel = socket.channel(`room:${roomCode}`, {});
            channel.join().receive("ok", () => {
                const determineLatency = (rtt: number) => {
                    set({ latency: rtt }, false, "channel/latency_update");

                    if (socket.isConnected()) {
                        setTimeout(() => socket.ping(determineLatency), 1000);
                    }
                };
                determineLatency(0);
                set({ status: "online" }, false, "channel/online");
            });
        },
        disconnect() {
            channel?.leave();
            socket.disconnect();
            set({ status: "offline" }, false, "channel/offline");
        },
    };
};

export const channelStore = lens(state);
