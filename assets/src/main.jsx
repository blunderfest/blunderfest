import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App.jsx";

import { connect, join } from "connectivity/actions/actions.js";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "./store.js";

const userId = document
  .querySelector("meta[name='user_id']")
  .getAttribute("content");
const roomCode = document
  .querySelector("meta[name='room_code']")
  .getAttribute("content");

store.dispatch(function connectToBackend(dispatch) {
  dispatch(connect()).then(() => {
    dispatch(
      join({
        userId: userId,
        roomCode: roomCode,
      })
    );
  });
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
