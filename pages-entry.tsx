/// <reference types="vite/client" />
import { createRoot } from 'react-dom/client';
import Home from './app/page';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(<Home />);

// Offline play and home-screen install; only the Pages build ships sw.js.
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => {
        /* The game still works online without offline support. */
      });
  });
