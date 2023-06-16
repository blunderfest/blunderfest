import { Channel, Socket } from "phoenix";

import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    status: "online" | "offline";
    latency: number;
    connect: (roomCode: string) => void;
    disconnect: () => void;
};

const socket: Socket = new Socket("/socket", {
    heartbeatIntervalMs: 5000,
});
const channels = new Map<string, Channel>();

const state: Lens<ChannelStoreState> = (set, get) => {
    return {
        status: "offline",
        latency: 0,
        connect(roomCode) {
            socket.connect();
            socket.onOpen(() => set({ status: "online" }, false, "socket/opened"));
            socket.onClose(() => {
                set({ status: "offline" }, false, "socket/closed");
            });
            socket.onError(() => {
                set({ status: "offline" }, false, "socket/errored");
            });

            const channel = socket.channel(`room:${roomCode}`, {});
            channel.join().receive("ok", () => {
                channels.set(roomCode, channel);
            });

            const measure = () => {
                channel.push("ping", { rtt: Date.now() }, 3000).receive("ok", response => {
                    const latency = Date.now() - response.rtt;
                    const currentLatency = get().latency;

                    if (latency !== currentLatency) {
                        set({ latency: latency }, false, "channel/latency_update");
                    }

                    setTimeout(() => measure(), 1000);
                });
            };

            measure();
        },
        disconnect() {
            if (socket) {
                for (const channel of channels.values()) {
                    channel.leave();
                }

                channels.clear();

                socket.disconnect();
            }
        },
    };
};

export const channelStore = lens(state);
