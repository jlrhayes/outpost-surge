// OWNER: meta agent. Side-effect registrations for this module, imported once at startup:
// tickers (training/healing, research, daily reset), bonus & power providers, lifetime stat counters,
// daily-task wiring and the welcome-back capture.
import { effect } from '@preact/signals';
import { mutate } from '../core/store';
import { registerTicker } from '../core/tick';
import { registerBonusProvider, registerPowerProvider } from '../core/bonuses';
import { on, type GameEvents } from '../core/events';
import { route } from '../core/nav';
import { troopsPower, troopsTicker } from '../systems/troops';
import { researchBonuses, researchPower, researchTicker } from '../systems/research';
import { dailyTicker, wireDailyTasks } from '../systems/daily';
import { startWelcomeCapture } from '../ui/hud/welcome';

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

// World-map visits (quest "Visit the World Map").
let lastMode = route.peek().mode;
effect(() => {
  const m = route.value.mode;
  if (m === 'world' && lastMode !== 'world') {
    queueMicrotask(() =>
      mutate((s) => {
        s.stats.worldVisits = (s.stats.worldVisits ?? 0) + 1;
      }),
    );
  }
  lastMode = m;
});

wireDailyTasks();
startWelcomeCapture();
