import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { Provider } from "react-redux";
import { store } from "@/store";
import { connect } from "./store/actions";
import "./index.css";

store.dispatch(connect());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store} stabilityCheck="once" identityFunctionCheck="once">
      <App />
    </Provider>
  </React.StrictMode>
);
