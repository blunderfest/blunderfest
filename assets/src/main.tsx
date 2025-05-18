import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "./app.tsx";
import { store } from "./app/store.ts";
import { connect } from "./features/connectivity/connectivity-slice.ts";

store.dispatch(connect());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
