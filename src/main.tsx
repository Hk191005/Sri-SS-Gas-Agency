import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { purgeLegacyLocalStorageBusinessData } from './lib/cleanupLegacyStorage'

// Execute safe one-time purge of legacy development localStorage business data
purgeLegacyLocalStorageBusinessData();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
