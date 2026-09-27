// OWNER: meta agent. Soldiers: training in barracks, wounded/healing in hospitals, capacity.
// CONTRACT (used by heroes/battle/world): totalTroops(), bestTroopTier(), applyTroopLosses().
import type { GameState } from '../core/store';

export function totalTroops(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.meta.troops)) n += v;
  return n;
}

/** Highest tier with at least one ready soldier (1 if none). */
export function bestTroopTier(s: GameState): number {
  let best = 1;
  for (const [t, v] of Object.entries(s.meta.troops)) if (v > 0 && Number(t) > best) best = Number(t);
  return best;
}

/**
 * Moves `count` soldiers from ready to wounded (highest tiers last). Call inside mutate()
 * after a lost/costly battle. Excess beyond hospital capacity die.
 */
export function applyTroopLosses(s: GameState, count: number): void {
  let left = Math.floor(count);
  const tiers = Object.keys(s.meta.troops).map(Number).sort((a, b) => a - b);
  for (const t of tiers) {
    if (left <= 0) break;
    const take = Math.min(left, s.meta.troops[t] ?? 0);
    s.meta.troops[t] -= take;
    s.meta.wounded[t] = (s.meta.wounded[t] ?? 0) + take;
    left -= take;
  }
}
