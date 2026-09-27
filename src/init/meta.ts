// OWNER: meta agent. Side-effect registrations for this module, imported once at startup:
// tickers (training/healing, research, daily reset), bonus & power providers, lifetime stat counters,
// daily-task wiring, the welcome-back capture, "New feature unlocked" popups and the onboarding guide hand.
import { effect } from '@preact/signals';
import { game, mutate, type GameState } from '../core/store';
import { registerTicker } from '../core/tick';
import { isUnlocked, type Feature } from '../core/unlocks';
import { registerBonusProvider, registerPowerProvider } from '../core/bonuses';
import { on, type GameEvents } from '../core/events';
import { openScreen, route, screens } from '../core/nav';
import { sceneBusy } from '../modes/base/anchors';
import { troopsPower, troopsTicker } from '../systems/troops';
import { researchBonuses, researchPower, researchTicker } from '../systems/research';
import { dailyTicker, wireDailyTasks } from '../systems/daily';
import { startWelcomeCapture, welcome } from '../ui/hud/welcome';
import { startGuide } from '../ui/hud/guide';

registerTicker('meta:troops', troopsTicker);
registerTicker('meta:research', researchTicker);
registerTicker('meta:daily', dailyTicker);

registerBonusProvider('research', researchBonuses);
registerPowerProvider('troops', troopsPower);
registerPowerProvider('research', researchPower);

// ---- Lifetime stat counters (game.stats) used by quests, daily tasks and achievements ----
type StatFn<K extends keyof GameEvents> = (p: GameEvents[K]) => [string, number][];
const STATS: { [K in keyof GameEvents]?: StatFn<K> } = {
  'building:upgradeStarted': () => [['upgradesStarted', 1]],
  'building:upgraded': () => [['upgrades', 1]],
  'resource:collected': (p) => [
    ['collects', 1],
    [`collected_${p.resource}`, p.amount],
  ],
  'hero:recruited': (p) => [['recruits', p.count]],
  'hero:levelUp': () => [['heroLevelUps', 1]],
  'hero:starUp': () => [['heroStarUps', 1]],
  'squad:changed': () => [['squadChanges', 1]],
  'troops:trained': (p) => [['troopsTrained', p.count]],
  'troops:healed': (p) => [['troopsHealed', p.count]],
  'research:done': () => [['researchDone', 1]],
  'runner:finished': (p) => (p.won ? [['runnerPlays', 1], ['runnerWins', 1]] : [['runnerPlays', 1], ['runnerLosses', 1]]),
  'campaign:stageCleared': () => [['districts', 1]],
  'world:hordeDefeated': () => [['hordes', 1]],
  'world:gathered': (p) => [
    ['gathers', 1],
    ['gathered', p.amount],
  ],
  'zombies:killed': (p) => [['zombiesKilled', p.count]],
  'item:used': (p) => [['itemsUsed', p.count]],
  'speedup:used': (p) => [['speedupMinutes', p.minutes]],
  'quest:claimed': () => [['questsClaimed', 1]],
};

for (const [ev, fn] of Object.entries(STATS)) {
  on(ev as keyof GameEvents, (p: any) => {
    const pairs = (fn as (p: any) => [string, number][])(p);
    mutate((s) => {
      for (const [k, v] of pairs) if (v) s.stats[k] = (s.stats[k] ?? 0) + v;
    });
  });
}

// World-map visits (quest "Visit the World Map") + when the player last arrived in the base.
let lastMode = route.peek().mode;
let baseSince = lastMode === 'base' ? performance.now() : Infinity;
effect(() => {
  const m = route.value.mode;
  if (m === 'world' && lastMode !== 'world') {
    queueMicrotask(() =>
      mutate((s) => {
        s.stats.worldVisits = (s.stats.worldVisits ?? 0) + 1;
      }),
    );
  }
  if (m !== lastMode) baseSince = m === 'base' ? performance.now() : Infinity;
  lastMode = m;
});

// ---- "New feature unlocked" popups: shown once per feature, in the base, when nothing else is on screen ----
const POPUP_FEATURES: Feature[] = ['runner', 'daily', 'recruit', 'world', 'radar', 'research', 'squad2', 'squad3', 'squad4'];

function canShowUnlockPopup(): boolean {
  return (
    game.runner.introDone &&
    route.peek().mode === 'base' &&
    screens.peek().length === 0 &&
    // let a district-reveal cinematic and the welcome-back summary go first
    !sceneBusy.peek() &&
    !welcome.peek() &&
    performance.now() - baseSince > 1500
  );
}

registerTicker('meta:unlocks', (s: GameState) => {
  const seen = s.meta.unlocksSeen;
  if (!seen.includes('_init')) {
    // First run on this save: features that are already open never pop up.
    seen.push('_init', ...POPUP_FEATURES.filter((f) => isUnlocked(s, f)));
    return true;
  }
  const fresh = POPUP_FEATURES.filter((f) => !seen.includes(f) && isUnlocked(s, f));
  if (!fresh.length || !canShowUnlockPopup()) return false;
  seen.push(...fresh);
  queueMicrotask(() => openScreen('featureUnlocked', { features: fresh }));
  return true;
});

wireDailyTasks();
startWelcomeCapture();
startGuide();
