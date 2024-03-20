import "@blunderfest/design-system/styled-system/styles.css";
import { App } from "@blunderfest/ui/App";
import React from "react";
import ReactDOM from "react-dom/client";

document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
