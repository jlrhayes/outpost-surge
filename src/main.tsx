import './ui/styles.css';
import { render } from 'preact';
import { App } from './ui/App';
import { engine } from './three/engine';
import { modeFactories } from './modes';
import { startTicking } from './core/tick';
import { game, mutate, startAutosave } from './core/store';
import { goTo, openScreen } from './core/nav';
import { debugSkip, now, runTickers } from './core/tick';
import { grant } from './core/economy';
import type { ModeId } from './core/types';
import { unlockAudio } from './core/audio';

// Module registrations (tickers, bonus/power providers, event listeners). Order-independent.
import './init/meta';
import './init/base';
import './init/heroes';
import './init/world';
import './init/runner';

function boot() {
  engine.init(document.getElementById('stage')!, modeFactories);
  render(<App />, document.getElementById('ui')!);
  startTicking();
  startAutosave();

  // Mobile browsers only allow audio after a user gesture.
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  // Dev-only test hooks: ?mode=runner&level=3 | ?mode=world | ?mode=base&screen=heroes, and window.__os.
  const q = new URLSearchParams(location.search);
  if (import.meta.env.DEV) {
    (window as any).__os = { game, mutate, goTo, openScreen, debugSkip, grant, now, engine, runTickers };
  }
  const devMode = import.meta.env.DEV ? (q.get('mode') as ModeId | null) : null;

  if (devMode) {
    if (devMode !== 'runner') mutate((s) => (s.runner.introDone = true));
    goTo(devMode, devMode === 'runner' ? { level: Number(q.get('level') ?? 1), intro: q.get('intro') === '1' } : undefined);
    const scr = q.get('screen');
    if (scr) openScreen(scr);
  } else if (!game.runner.introDone) {
    // Like the genre's opening: brand-new players start straight in a squad run, then land in the base.
    goTo('runner', { level: 1, intro: true });
  } else goTo('base');

  document.getElementById('boot')?.remove();
}

boot();

// PWA offline support (public/sw.js): production web builds only, never inside the Capacitor Android app
// (which already serves the game from local files).
if (import.meta.env.PROD && 'serviceWorker' in navigator && !(window as any).Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker registration failed:', err));
  });
}
