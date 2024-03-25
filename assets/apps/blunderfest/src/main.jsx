import React from "react";
import { createRoot } from "react-dom/client";

import "@blunderfest/design-system/styled-system/styles.css";
import { StoreProvider } from "@blunderfest/store";
import "./i18n";
import { App } from "./ui/App";

const roomCode = document?.querySelector("meta[name='room_code']")?.getAttribute("content");
const userToken = document?.querySelector("meta[name='user_token']")?.getAttribute("content");

console.log(userToken, roomCode);

document.addEventListener("contextmenu", (e) => e.preventDefault());

const root = createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <StoreProvider>{userToken && roomCode && <App userToken={userToken} roomCode={roomCode} />}</StoreProvider>
  </React.StrictMode>
);
