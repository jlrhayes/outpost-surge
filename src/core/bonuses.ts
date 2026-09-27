// Decoupled bonus & power aggregation. Modules register providers at import time; consumers
// query getBonus()/totalPower() without knowing who contributes.
//
//   registerBonusProvider('research', s => ({ atk_pct: 5 }));
//   const pct = getBonus(game, 'food_prod_pct');
import type { BonusKey } from './types';
import type { GameState } from './store';

type BonusProvider = (s: GameState) => Partial<Record<BonusKey, number>>;
type PowerProvider = (s: GameState) => number;

const bonusProviders = new Map<string, BonusProvider>();
const powerProviders = new Map<string, PowerProvider>();

export function registerBonusProvider(name: string, fn: BonusProvider): void {
  bonusProviders.set(name, fn);
}

export function registerPowerProvider(name: string, fn: PowerProvider): void {
  powerProviders.set(name, fn);
}

export function getBonus(s: GameState, key: BonusKey): number {
  let total = 0;
  for (const fn of bonusProviders.values()) {
    const v = fn(s)[key];
    if (v) total += v;
  }
  return total;
}

/** Multiplier form of a *_pct bonus, e.g. 25 -> 1.25. */
export function bonusMult(s: GameState, key: BonusKey): number {
  return 1 + getBonus(s, key) / 100;
}

/** Total commander power shown in the HUD: sum of all registered power providers (heroes, troops, buildings, research...). */
export function totalPower(s: GameState): number {
  let total = 0;
  for (const fn of powerProviders.values()) total += fn(s);
  return Math.floor(total);
}

export function powerBreakdown(s: GameState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, fn] of powerProviders) out[k] = Math.floor(fn(s));
  return out;
}
