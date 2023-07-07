type Message = { topic: string; event: string; payload: any; ref: string; join_ref: string };

export module "phoenix" {
    export interface Socket {
        // onMessage: (message: Message) => void;
        onMessage(callback: (message: Message) => void | Promise<void>): MessageRef;
    }

    export interface Channel {
        isMember: (topic: string, event: string, payload: any, join_ref: string) => boolean;
    }
}
