import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { App } from "./App.tsx";
import { connect } from "./actions/joined.ts";
import "./i18n";
import "./index.css";
import { store } from "./store/store.ts";

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
