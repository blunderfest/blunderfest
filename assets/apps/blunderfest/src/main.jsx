import "@blunderfest/design-system/styled-system/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { fromEvent } from "rxjs";
import { App } from "./App.jsx";

const mouse$ = fromEvent(document, "contextmenu");
mouse$.subscribe((e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
