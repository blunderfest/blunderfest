import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Provider } from "react-redux";
import { store } from "./store";
import "./features/i18n/i18n";
import "./index.css";
import { connect } from "./store/actions.ts";

store.dispatch(connect());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider identityFunctionCheck="once" stabilityCheck="once" store={store}>
      <App />
    </Provider>
  </StrictMode>
);
