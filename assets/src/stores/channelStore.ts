import { Channel, Socket } from "phoenix";

import { Lens, lens } from "@dhmk/zustand-lens";

type ChannelStoreState = {
    status: "online" | "offline";
    connect: (roomCode: string) => void;
    disconnect: () => void;
    roomCode: string;
};

let socket: Socket | undefined = undefined;
let channel: Channel | undefined = undefined;

const state: Lens<ChannelStoreState> = set => {
    return {
        status: "offline",
        roomCode: "",
        connect(roomCode) {
            socket = new Socket("/socket", {
                heartbeatIntervalMs: 5000,
            });
            socket.connect();
            socket.onOpen(() => set({ status: "online" }));
            socket.onClose(e => {
                console.log("onClose", e);
                set({ status: "offline" });
            });
            socket.onError(() => {
                console.log("onError");
                set({ status: "offline" });
            });

            channel = socket.channel(`room:${roomCode}`, {});
            channel
                .join()
                .receive("ok", () => {
                    console.log("received ok");
                    set({ roomCode: roomCode });
                })
                .receive("error", () => {
                    console.log("received error");
                    set({ roomCode: "" });
                });
        },
        disconnect() {
            if (socket) {
                socket.disconnect();
                channel = undefined;
                socket = undefined;
            }
        },
    };
};

export const channelStore = lens(state);
