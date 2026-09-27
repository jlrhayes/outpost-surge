// Platform glue: hardware/gesture "back", app pause/resume, audio unlock.
//  - Android (Capacitor): the App plugin's backButton event.
//  - Browser / installed PWA: a guard history entry turns the back gesture into in-game "back".
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { closeScreen, goTo, route, screens } from './core/nav';
import { saveNow } from './core/store';
import { runTickers } from './core/tick';
import { resumeAudio, suspendAudio, unlockAudio } from './core/audio';
import { runActions, runHud } from './modes/runner/runState';

/** In-game "back". Returns false when there is nothing left to go back from (app may background). */
export function handleBack(): boolean {
  if (screens.value.length) {
    closeScreen();
    return true;
  }
  switch (route.value.mode) {
    case 'runner':
      if (runHud.paused.value) runActions.resume();
      else runActions.pause();
      return true;
    case 'battle':
      return true; // use the Skip button; back never abandons a battle mid-playback
    case 'world':
      goTo('base');
      return true;
    default:
      return false;
  }
}

function onHidden(): void {
  saveNow();
  suspendAudio();
}

function onVisible(): void {
  resumeAudio();
  runTickers();
}

export function initPlatform(): void {
  // Audio may only start from a real user activation (tap/click end), not a touch pointerdown.
  const unlock = () => {
    if (unlockAudio()) {
      for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.removeEventListener(ev, unlock, true);
    }
  };
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, true);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHidden();
    else onVisible();
  });

  if (Capacitor.isNativePlatform()) {
    void App.addListener('backButton', () => {
      if (!handleBack()) void App.minimizeApp();
    });
    void App.addListener('pause', onHidden);
    void App.addListener('resume', onVisible);
  } else {
    const guard = () => history.pushState({ osGuard: true }, '');
    guard();
    window.addEventListener('popstate', () => {
      if (handleBack()) guard();
      else history.back(); // nothing to close: let the browser leave the game
    });
  }
}
