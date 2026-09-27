// The single mutable game state + change notification + persistence.
//
// Usage:
//   import { game, mutate, useGame } from '../core/store';
//   mutate(s => { s.currencies.food += 100; });      // any change to state MUST go through mutate()
//   function MyPanel() { const s = useGame(); ... }   // re-renders whenever state changes
//
// Outside of components (3D modes, systems) just read `game` directly.

import { signal } from '@preact/signals';
import type { CurrencyId, ItemId } from './types';
import { BaseState, defaultBaseState } from '../state/base';
import { HeroesState, defaultHeroesState } from '../state/heroes';
import { WorldState, defaultWorldState } from '../state/world';
import { RunnerState, defaultRunnerState } from '../state/runner';
import { MetaState, defaultMetaState } from '../state/meta';

export const SAVE_KEY = 'outpost-surge-save-v1';
export const SAVE_SCHEMA = 1;

export interface Settings {
  sfx: boolean;
  music: boolean;
  quality: 'low' | 'high';
  /** The engine's one-time automatic performance check has run. */
  perfChecked: boolean;
}

/** First-launch graphics default: modest hardware starts on 'low' (no shadows, lower resolution). */
function detectQuality(): 'low' | 'high' {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory;
  return cores <= 4 || (mem !== undefined && mem <= 3) ? 'low' : 'high';
}

export interface GameState {
  schema: number;
  createdAt: number;
  /** Last time the game was running (used for offline progress summaries). */
  lastSeen: number;
  player: { name: string; avatar: number };
  currencies: Record<CurrencyId, number>;
  items: Partial<Record<ItemId, number>>;
  /** Lifetime counters (zombiesKilled, recruits, runnerWins, ...) used by quests/achievements. */
  stats: Record<string, number>;
  settings: Settings;
  base: BaseState;
  heroes: HeroesState;
  world: WorldState;
  runner: RunnerState;
  meta: MetaState;
}

export function defaultState(now = Date.now()): GameState {
  return {
    schema: SAVE_SCHEMA,
    createdAt: now,
    lastSeen: now,
    player: { name: 'Commander', avatar: 0 },
    currencies: { food: 2000, iron: 1500, gold: 500, diamonds: 300, heroExp: 1000 },
    items: { recruit_ticket: 10, speedup_5m: 5, speedup_1h: 1, stamina_potion: 1 },
    stats: {},
    settings: { sfx: true, music: true, quality: detectQuality(), perfChecked: false },
    base: defaultBaseState(now),
    heroes: defaultHeroesState(now),
    world: defaultWorldState(now),
    runner: defaultRunnerState(),
    meta: defaultMetaState(),
  };
}

/** Recursively fills keys missing from `loaded` using `defaults` (so old saves pick up new fields). */
function mergeDefaults<T>(defaults: T, loaded: unknown): T {
  if (loaded === undefined || loaded === null) return defaults;
  if (Array.isArray(defaults)) return (Array.isArray(loaded) ? loaded : defaults) as T;
  if (typeof defaults === 'object' && defaults !== null) {
    if (typeof loaded !== 'object' || Array.isArray(loaded)) return defaults;
    const out: Record<string, unknown> = { ...(loaded as Record<string, unknown>) };
    for (const [k, v] of Object.entries(defaults as Record<string, unknown>)) {
      out[k] = mergeDefaults(v, (loaded as Record<string, unknown>)[k]);
    }
    return out as T;
  }
  return (typeof loaded === typeof defaults ? loaded : defaults) as T;
}

function load(): { state: GameState; isNew: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { state: mergeDefaults(defaultState(), parsed), isNew: false };
    }
  } catch (e) {
    console.warn('Save load failed, starting fresh (old save kept as backup)', e);
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) localStorage.setItem(SAVE_KEY + '-corrupt-' + Date.now(), raw);
    } catch {
      /* storage full or unavailable */
    }
  }
  return { state: defaultState(), isNew: true };
}

const loaded = load();
/** The live game state. Read freely; write only inside mutate(). */
export let game: GameState = loaded.state;
/** True when this session started without a save (first launch). */
export const isNewGame = loaded.isNew;

/** Bumped on every mutation; components subscribe through useGame(). */
export const version = signal(0);

let dirty = false;

export function mutate(fn: (s: GameState) => void): void {
  fn(game);
  dirty = true;
  version.value++;
}

/** Hook: returns the live state and re-renders the component on any change. */
export function useGame(): GameState {
  // Reading .value subscribes the calling component (via @preact/signals).
  void version.value;
  return game;
}

export function saveNow(): void {
  try {
    game.lastSeen = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    dirty = false;
  } catch (e) {
    console.warn('Save failed', e);
  }
}

export function resetGame(): void {
  localStorage.removeItem(SAVE_KEY);
  game = defaultState();
  saveNow();
  location.reload();
}

export function startAutosave(): void {
  setInterval(() => {
    if (dirty) saveNow();
  }, 5000);
  const flush = () => saveNow();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}
