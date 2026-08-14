import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
// Fonts come from app.css (@fontsource-variable/*), one place for both families.
import '@/app/app.css';
import '@/i18n';
import App from '@/app/App';
import { watchSystemTheme } from '@/lib/theme';
import { store } from '@/store';

watchSystemTheme();

const rootEl = document.getElementById('root');

if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>,
  );
}
