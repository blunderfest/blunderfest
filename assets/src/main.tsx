import React, { memo } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { Provider } from "react-redux";
import { store } from "@/store";
import { connect } from "./store/actions";
import "@/features/i18n/i18n";
import "./index.css";

store.dispatch(connect());

const MemoizedApp = memo(App);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store} stabilityCheck="once" identityFunctionCheck="once">
      <MemoizedApp />
    </Provider>
  </React.StrictMode>
);
