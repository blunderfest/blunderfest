import "@/features/i18n/i18n";
import { connect } from "@/store/slices/connectivitySlice";
import { store } from "@/store/store.ts";
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { defaultConfig } from "tailwind-variants";
import { App } from "./App";
import "./index.css";
import { join } from "@/store/slices/roomSlice";

defaultConfig.responsiveVariants = true;
store.dispatch(connect()).then(() => store.dispatch(join(window.config.roomCode)));

document.addEventListener("contextmenu", (e) => e.preventDefault());

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>
  );
}
