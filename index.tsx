
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSupabase } from './services/supabaseClient';

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("FATAL: Could not find root element to mount to");
  throw new Error("Could not find root element to mount to");
}

async function start() {
  try {
    const response = await fetch('/api/config');
    if (response.ok) {
      const data = await response.json();
      if (data.VITE_SUPABASE_URL && data.VITE_SUPABASE_ANON_KEY) {
        initSupabase(data.VITE_SUPABASE_URL, data.VITE_SUPABASE_ANON_KEY);
      }
    }
  } catch (err) {
    console.warn("Failed to fetch runtime backend configuration:", err);
  }

  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("App mounted successfully");
  } catch (error) {
    console.error("Error mounting React app:", error);
  }
}

start();

