import { connect } from "@/store/actions/joined.ts";
import { store } from "@/store/store";
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { App } from "./App.tsx";
import "./index.css";

store.dispatch(connect());

document.addEventListener("contextmenu", (e) => e.preventDefault());

const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
