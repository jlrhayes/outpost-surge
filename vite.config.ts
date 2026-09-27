import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the same build works on GitHub Pages (/<repo>/) and inside the Capacitor Android WebView.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
