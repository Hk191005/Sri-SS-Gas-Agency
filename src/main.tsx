import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { purgeLegacyLocalStorageBusinessData } from './lib/cleanupLegacyStorage'
import { supabase } from './lib/supabase'
import * as db from './lib/db'

// Execute safe one-time purge of legacy development localStorage business data
purgeLegacyLocalStorageBusinessData();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).db = db;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
