import * as ReactDOM from "react-dom/client";

import { App } from "./App.js";
import React from "react";

const gameCode = document.querySelector("meta[name='game-code']")!.getAttribute("content")!;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App gameCode={gameCode} />
  </React.StrictMode>
);
