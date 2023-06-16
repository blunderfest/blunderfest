import { Socket as PhoenixSocket } from "phoenix";

type Callback = (rtt: number) => void;

declare module "phoenix" {
    export interface Socket extends PhoenixSocket {
        ping: (callback: Callback) => void;
    }
}
