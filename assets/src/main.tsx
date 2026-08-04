import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import './app.css'
import './i18n'
import App from './App'
import { store } from './store'

const rootEl = document.getElementById('root')

if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </React.StrictMode>,
  )
}