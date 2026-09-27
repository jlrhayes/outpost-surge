import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { serviceWorkerStamp } from './scripts/vite-plugin-sw.mjs';

// Relative base so the same build works on GitHub Pages (/<repo>/) and inside the Capacitor Android WebView.
export default defineConfig({
  base: './',
  // serviceWorkerStamp: versions public/sw.js + fills its precache list at build time (PWA offline support).
  plugins: [preact(), serviceWorkerStamp()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
