import './ui/styles.css';
import { render } from 'preact';
import { App } from './ui/App';
import { engine } from './three/engine';
import { modeFactories } from './modes';
import { startTicking } from './core/tick';
import { game, startAutosave } from './core/store';
import { goTo } from './core/nav';
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

  // Like the genre's opening: brand-new players start straight in a squad run, then land in the base.
  if (!game.runner.introDone) goTo('runner', { level: 1, intro: true });
  else goTo('base');

  document.getElementById('boot')?.remove();
}

boot();
