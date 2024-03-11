import { StoreProvider, connect, join, store } from "@blunderfest/redux";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App.tsx";
import "./index.css";

const userId = document?.querySelector("meta[name='user_id']")?.getAttribute("content");

const roomCode = document?.querySelector("meta[name='room_code']")?.getAttribute("content");
document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
});

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

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <StoreProvider>{roomCode && <App roomCode={roomCode} />}</StoreProvider>
    </React.StrictMode>
);
