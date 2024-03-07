import { StrictMode } from "react";
import * as ReactDOM from "react-dom/client";

import { StoreProvider, connect, join, store } from "@blunderfest/redux";
import { App } from "./app/App";

const userId = document?.querySelector("meta[name='user_id']")?.getAttribute("content");

const roomCode = document?.querySelector("meta[name='room_code']")?.getAttribute("content");

if (userId && roomCode) {
    store.dispatch(function connectToBackend(dispatch) {
        dispatch(connect()).then(() => {
            dispatch(
                join({
                    userId: userId,
                    roomCode: roomCode,
                })
            );
        });
    });
}
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
    <StrictMode>
        <StoreProvider>{roomCode && <App roomCode={roomCode} />}</StoreProvider>
    </StrictMode>
);
