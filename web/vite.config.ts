import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Served from the domain root on Vercel, with a rewrite of unknown paths to
  // index.html (see vercel.json). If you ever host this in a sub-folder on a
  // plain static host instead, set this back to './' and switch BrowserRouter
  // to HashRouter in src/App.tsx.
  base: '/',
  plugins: [react()],
  server: { port: 5173 },
});
