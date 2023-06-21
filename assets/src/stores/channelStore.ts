import { Channel, Socket } from "phoenix";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type Store = {
    status: "online" | "offline";
    latency: number;
    connect: (roomCode: string) => void;
    disconnect: () => void;
};

const socket: Socket = new Socket("/socket", {
    heartbeatIntervalMs: 1000,
});

let channel: Channel | undefined = undefined;

export const useChannelStore = create<Store>()(
    devtools(
        immer(set => ({
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
                            setTimeout(() => socket.ping(rtt => determineLatency(rtt)), 1000);
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
        })),
    ),
);
