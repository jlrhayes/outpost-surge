// Spending and granting. Always use these instead of editing currencies directly so events/stats fire.
import { game, mutate, type GameState } from './store';
import { emit } from './events';
import type { Cost, CurrencyId, ItemId, Reward } from './types';

export function canAfford(s: GameState, cost: Cost): boolean {
  for (const [k, v] of Object.entries(cost) as [CurrencyId, number][]) {
    if ((s.currencies[k] ?? 0) < (v ?? 0)) return false;
  }
  return true;
}

/** Returns the currencies the player is short of (for "not enough X" UI). */
export function shortfall(s: GameState, cost: Cost): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost) as [CurrencyId, number][]) {
    const have = s.currencies[k] ?? 0;
    if (have < v) out[k] = v - have;
  }
  return out;
}

/** Deducts cost inside an existing mutate() call. Returns false (and changes nothing) if unaffordable. */
export function spendIn(s: GameState, cost: Cost): boolean {
  if (!canAfford(s, cost)) return false;
  for (const [k, v] of Object.entries(cost) as [CurrencyId, number][]) s.currencies[k] -= v;
  return true;
}

/** Standalone spend (wraps mutate). */
export function spend(cost: Cost): boolean {
  let ok = false;
  mutate((s) => {
    ok = spendIn(s, cost);
  });
  return ok;
}

export function itemCount(s: GameState, id: ItemId): number {
  return s.items[id] ?? 0;
}

/** Consumes items inside mutate(). Returns false if not enough. */
export function consumeItemIn(s: GameState, id: ItemId, count = 1): boolean {
  if ((s.items[id] ?? 0) < count) return false;
  s.items[id] = (s.items[id] ?? 0) - count;
  return true;
}

export function addStat(s: GameState, key: string, amount = 1): void {
  s.stats[key] = (s.stats[key] ?? 0) + amount;
}

// Hero-related rewards are applied by the heroes module (registered at import time).
type HeroGrantHandler = (s: GameState, reward: Reward) => void;
let heroGrantHandler: HeroGrantHandler | null = null;
export function registerHeroGrantHandler(fn: HeroGrantHandler): void {
  heroGrantHandler = fn;
}

/** Applies a reward inside an existing mutate() call. */
export function grantIn(s: GameState, reward: Reward): void {
  if (reward.currencies) {
    for (const [k, v] of Object.entries(reward.currencies) as [CurrencyId, number][]) {
      s.currencies[k] = (s.currencies[k] ?? 0) + v;
    }
  }
  if (reward.items) {
    for (const [k, v] of Object.entries(reward.items)) {
      s.items[k] = (s.items[k] ?? 0) + (v ?? 0);
    }
  }
  if (reward.troops) {
    for (const [tier, n] of Object.entries(reward.troops)) {
      const t = Number(tier);
      s.meta.troops[t] = (s.meta.troops[t] ?? 0) + n;
    }
  }
  if ((reward.heroes?.length || reward.heroShards) && heroGrantHandler) heroGrantHandler(s, reward);
}

/** Standalone grant (wraps mutate). Does not emit `resource:collected` — that event is reserved for
 * the player collecting building production. */
export function grant(reward: Reward): void {
  mutate((s) => grantIn(s, reward));
}

export function isEmptyReward(r: Reward): boolean {
  return !(
    (r.currencies && Object.keys(r.currencies).length) ||
    (r.items && Object.keys(r.items).length) ||
    (r.heroShards && Object.keys(r.heroShards).length) ||
    r.heroes?.length ||
    (r.troops && Object.keys(r.troops).length)
  );
}

export { game };
