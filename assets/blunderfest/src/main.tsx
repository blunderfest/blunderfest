import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistor, store } from './app/store';

import { App } from './app/App';
import { connect, join } from './app/connectivity/actions/actions';

const userId = document
  ?.querySelector("meta[name='user_id']")
  ?.getAttribute('content');

const roomCode = document
  ?.querySelector("meta[name='room_code']")
  ?.getAttribute('content');

if (userId && roomCode) {
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
}
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        {roomCode && <App roomCode={roomCode} />}
      </PersistGate>
    </Provider>
  </StrictMode>
);
