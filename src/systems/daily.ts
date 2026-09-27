// OWNER: meta agent. Daily tasks: event-driven progress -> claim for activity points -> 5 chests
// at 40/80/120/160/200 points. Everything resets at local midnight (uses now() so dev time-skip works).
import { game, mutate, type GameState } from '../core/store';
import type { Reward } from '../core/types';
import { grantIn } from '../core/economy';
import { on, type GameEvents } from '../core/events';
import { now } from '../core/tick';
import { openScreen, toast } from '../core/nav';
import { isUnlocked, type Feature } from '../core/unlocks';
import { sfx } from '../core/audio';

export interface DailyTaskDef {
  id: string;
  text: string;
  target: number;
  points: number;
  icon: string;
  /** Hidden until this feature is unlocked. */
  feature?: Feature;
  /** Screen / action the "Go" button opens. */
  go?: { screen?: string; mode?: 'world' };
}

export const DAILY_TASKS: DailyTaskDef[] = [
  { id: 'login', text: 'Report for duty (log in)', target: 1, points: 10, icon: 'check' },
  { id: 'upgrade', text: 'Start 2 building upgrades', target: 2, points: 20, icon: 'hammer' },
  { id: 'collect', text: 'Collect resources 5 times', target: 5, points: 10, icon: 'food' },
  { id: 'train', text: 'Train 100 soldiers', target: 100, points: 20, icon: 'troops', go: {} },
  { id: 'runner', text: 'Win 2 Special Ops runs', target: 2, points: 20, icon: 'truck', feature: 'runner', go: { screen: 'runnerLevels' } },
  { id: 'district', text: 'Win a district battle', target: 1, points: 20, icon: 'skull', feature: 'campaign', go: { screen: 'campaign' } },
  { id: 'zombies', text: 'Eliminate 300 zombies', target: 300, points: 20, icon: 'target', feature: 'runner', go: { screen: 'runnerLevels' } },
  { id: 'heroLevel', text: 'Level up heroes 3 times', target: 3, points: 10, icon: 'helmet', go: { screen: 'heroes' } },
  { id: 'recruit', text: 'Recruit 1 hero', target: 1, points: 20, icon: 'ticket', feature: 'recruit', go: { screen: 'recruit' } },
  { id: 'speedup', text: 'Use 15 minutes of speed-ups', target: 15, points: 10, icon: 'speed_5m', go: { screen: 'bag' } },
  { id: 'items', text: 'Use 3 items from the bag', target: 3, points: 10, icon: 'bag', go: { screen: 'bag' } },
  { id: 'horde', text: 'Defeat 3 zombie hordes', target: 3, points: 30, icon: 'swords', feature: 'world', go: { mode: 'world' } },
  { id: 'gather', text: 'Gather from a resource tile', target: 1, points: 10, icon: 'iron', feature: 'world', go: { mode: 'world' } },
  { id: 'research', text: 'Complete 1 research', target: 1, points: 20, icon: 'flask', feature: 'research', go: { screen: 'research' } },
  { id: 'heal', text: 'Heal 50 wounded soldiers', target: 50, points: 10, icon: 'hospital' },
];

export const DAILY_CHESTS: { points: number; reward: Reward }[] = [
  { points: 40, reward: { currencies: { food: 3000, iron: 3000 }, items: { speedup_5m: 2 } } },
  { points: 80, reward: { currencies: { heroExp: 3000 }, items: { speedup_5m: 3, stamina_potion: 1 } } },
  { points: 120, reward: { currencies: { diamonds: 30 }, items: { recruit_ticket: 1, speedup_1h: 1 } } },
  { points: 160, reward: { currencies: { gold: 2000 }, items: { supply_crate: 1, skill_medal: 5 } } },
  { points: 200, reward: { currencies: { diamonds: 60 }, items: { recruit_ticket: 2, speedup_1h: 2, exp_box: 2 } } },
];
export const DAILY_MAX_POINTS = 200;

/** Local calendar day key, e.g. "2026-09-27". */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Timestamp of the next local midnight after `t`. */
export function nextMidnight(t: number): number {
  const d = new Date(t);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function resetIfNewDay(s: GameState, t: number): boolean {
  const key = dayKey(t);
  if (s.meta.daily.date === key) return false;
  s.meta.daily = { date: key, progress: { login: 1 }, claimed: [], chests: [] };
  return true;
}

/** 1 Hz: rolls the daily board over at local midnight. */
export function dailyTicker(s: GameState, t: number): boolean {
  return resetIfNewDay(s, t);
}

export function visibleTasks(s: GameState): DailyTaskDef[] {
  return DAILY_TASKS.filter((d) => !d.feature || isUnlocked(s, d.feature));
}

export function taskProgress(s: GameState, id: string): number {
  return s.meta.daily.progress[id] ?? 0;
}

export function activityPoints(s: GameState): number {
  let p = 0;
  for (const id of s.meta.daily.claimed) p += DAILY_TASKS.find((d) => d.id === id)?.points ?? 0;
  return p;
}

export function dailyClaimable(s: GameState): number {
  if (!isUnlocked(s, 'daily')) return 0;
  const pts = activityPoints(s);
  let n = 0;
  for (const d of visibleTasks(s)) if (taskProgress(s, d.id) >= d.target && !s.meta.daily.claimed.includes(d.id)) n++;
  DAILY_CHESTS.forEach((c, i) => {
    if (pts >= c.points && !s.meta.daily.chests.includes(i)) n++;
  });
  return n;
}

export function claimDailyTask(id: string): boolean {
  const def = DAILY_TASKS.find((d) => d.id === id);
  if (!def) return false;
  const s = game;
  if (taskProgress(s, id) < def.target || s.meta.daily.claimed.includes(id)) return false;
  mutate((st) => {
    st.meta.daily.claimed.push(id);
  });
  sfx.reward();
  toast(`+${def.points} Activity`, 'good');
  return true;
}

export function claimAllDailyTasks(): number {
  const s = game;
  const ids = visibleTasks(s)
    .filter((d) => taskProgress(s, d.id) >= d.target && !s.meta.daily.claimed.includes(d.id))
    .map((d) => d.id);
  if (!ids.length) return 0;
  const pts = ids.reduce((a, id) => a + (DAILY_TASKS.find((d) => d.id === id)?.points ?? 0), 0);
  mutate((st) => {
    st.meta.daily.claimed.push(...ids);
  });
  sfx.reward();
  toast(`+${pts} Activity`, 'good');
  return ids.length;
}

export function claimDailyChest(i: number): boolean {
  const c = DAILY_CHESTS[i];
  const s = game;
  if (!c || activityPoints(s) < c.points || s.meta.daily.chests.includes(i)) return false;
  mutate((st) => {
    grantIn(st, c.reward);
    st.meta.daily.chests.push(i);
  });
  sfx.reward();
  openScreen('rewards', { title: `Activity Chest ${i + 1}`, reward: c.reward });
  return true;
}

// ---------------- Event wiring ----------------

function bump(id: string, n = 1): void {
  if (n <= 0) return;
  mutate((s) => {
    resetIfNewDay(s, now());
    s.meta.daily.progress[id] = (s.meta.daily.progress[id] ?? 0) + n;
  });
}

let wired = false;
/** Subscribes daily-task counters to game events (called once from src/init/meta.ts). */
export function wireDailyTasks(): void {
  if (wired) return;
  wired = true;
  const map: { [K in keyof GameEvents]?: (p: GameEvents[K]) => [string, number] | null } = {
    'building:upgradeStarted': () => ['upgrade', 1],
    'resource:collected': () => ['collect', 1],
    'troops:trained': (p) => ['train', p.count],
    'runner:finished': (p) => (p.won ? ['runner', 1] : null),
    'campaign:stageCleared': () => ['district', 1],
    'zombies:killed': (p) => ['zombies', p.count],
    'hero:levelUp': () => ['heroLevel', 1],
    'hero:recruited': (p) => ['recruit', p.count],
    'speedup:used': (p) => ['speedup', Math.round(p.minutes)],
    'item:used': (p) => ['items', p.count],
    'world:hordeDefeated': () => ['horde', 1],
    'world:gathered': () => ['gather', 1],
    'research:done': () => ['research', 1],
    'troops:healed': (p) => ['heal', p.count],
  };
  for (const [ev, fn] of Object.entries(map)) {
    on(ev as keyof GameEvents, (p: any) => {
      const r = (fn as (p: any) => [string, number] | null)(p);
      if (r) bump(r[0], r[1]);
    });
  }
}
