import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Amiri's Arabic subset only: its unicode-range keeps Latin text on the system
// stack, so Dari glyphs render in Amiri in both the Dari and English UI.
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
