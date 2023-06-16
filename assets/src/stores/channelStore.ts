import { Channel, Socket } from "phoenix";

import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    status: "online" | "offline";
    latency: number;
    connect: (roomCode: string) => void;
    disconnect: () => void;
};

const socket: Socket = new Socket("/socket");
const channels = new Map<string, Channel>();

const state: Lens<ChannelStoreState> = set => {
    return {
        status: "offline",
        latency: 0,
        connect(roomCode) {
            const determineLatency = (rtt: number) => {
                set({ latency: rtt }, false, "channel/latency_update");

                if (socket.isConnected()) {
                    setTimeout(() => socket.ping(determineLatency), 1000);
                }
            };

            socket.connect();
            socket.onOpen(() => {
                determineLatency(0);

                set({ status: "online" }, false, "socket/opened");
            });
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
