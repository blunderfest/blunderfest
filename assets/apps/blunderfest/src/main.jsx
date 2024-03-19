import "@blunderfest/design-system/styled-system/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { fromEvent } from "rxjs";
import { App } from "./App.jsx";
import { store } from "./store/store.js";

const mouse$ = fromEvent(document, "contextmenu");
mouse$.subscribe((e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
