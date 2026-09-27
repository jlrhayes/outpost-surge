import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the Vite build (`dist/`) into the Android app in `android/`.
// Typical flow: `npm run build && npx cap sync android` (CI does this in .github/workflows/android.yml).
const config: CapacitorConfig = {
  appId: 'io.github.jlrhayes.outpostsurge',
  appName: 'Outpost Surge',
  webDir: 'dist',
  // Dark background behind the WebView while the game boots (matches --bg-dark in src/ui/styles.css).
  backgroundColor: '#14202c',
  android: {
    backgroundColor: '#14202c',
    // The game is fully offline; never allow mixed content.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Built-in Capacitor 8 plugin (no extra package). Hide status/navigation bars for a full-screen game;
    // MainActivity.java keeps them hidden (swipe from an edge shows them briefly).
    // Safe-area insets still reach CSS via env(safe-area-inset-*) because index.html uses viewport-fit=cover.
    SystemBars: {
      hidden: true,
      style: 'DARK',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
