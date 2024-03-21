import React from "react";
import { createRoot } from "react-dom/client";

import "@blunderfest/design-system/styled-system/styles.css";
import "./i18n";
import { App } from "./ui/App";

document.addEventListener("contextmenu", (e) => e.preventDefault());

const root = createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
