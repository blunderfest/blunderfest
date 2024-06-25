import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.jsx";
import { Provider } from "react-redux";
import "./index.css";
import { store } from "@/store";
import { connect } from "./store/actions.js";

store.dispatch(connect());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store} stabilityCheck="once" identityFunctionCheck="once">
      <App />
    </Provider>
  </React.StrictMode>
);
