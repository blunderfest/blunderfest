import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { App } from "./App.tsx";
import "./i18n";
import "./index.css";
import { store } from "./store/store.ts";

const roomCode = document?.querySelector("meta[name='room_code']")?.getAttribute("content");
const userToken = document?.querySelector("meta[name='user_token']")?.getAttribute("content");

document.addEventListener("contextmenu", (e) => e.preventDefault());

const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>{userToken && roomCode && <App userToken={userToken} roomCode={roomCode} />}</Provider>
  </React.StrictMode>
);
