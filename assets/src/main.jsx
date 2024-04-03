import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { defaultConfig } from "tailwind-variants";
import { App } from "./App.jsx";
import "./i18n.js";
import "./index.css";
import { connect } from "./store/actions/connect.js";
import { store } from "./store/store.js";

defaultConfig.responsiveVariants = true;

document.addEventListener("contextmenu", (e) => e.preventDefault());

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);

  store.dispatch(connect());

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );
}
