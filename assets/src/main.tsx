import React from 'react'
import ReactDOM from 'react-dom/client'
import './app.css'
import './i18n'
import App from './App'

const rootEl = document.getElementById('root')

if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}