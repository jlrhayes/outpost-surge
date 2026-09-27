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
    rollupOptions: {
      output: {
        // three.js changes rarely: keep it in its own long-cached chunk so game updates download less.
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/')) return 'vendor';
        },
      },
    },
  },
});
