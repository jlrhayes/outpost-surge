// OWNER: meta agent. Soldier tiers T1..T10: names, per-soldier power/stats, training cost & time.
// Soldiers have no type (only tiers). Numbers follow the genre curve (T10 ~ 69x T1 power), timers compressed.
// This is the ONE soldier stat table: battles (src/systems/heroes.ts troopStats), the Barracks screen and the
// 'troops' power provider all read it, so what the player sees is what fights.
import type { Cost } from '../core/types';

export interface TroopTierDef {
  tier: number;
  name: string;
  /** Power contributed by one ready soldier (= statPower of its combat stats). */
  power: number;
  /** Per-soldier combat stats (heroes add these on top of hero stats when leading troops). */
  hp: number;
  atk: number;
  def: number;
  /** Carry capacity per soldier (world-map gathering). */
  load: number;
  /** Cost to train ONE soldier. */
  cost: Cost;
  /** Seconds to train ONE soldier (before speed bonuses). */
  trainSec: number;
}

/** Per-soldier combat stats of a T1 soldier; every tier is TROOP_TIER_MULT x the previous one (T10 ~69x T1). */
export const TROOP_BASE = { hp: 10, atk: 1, def: 0.3 };
export const TROOP_TIER_MULT = 1.6;

/** Headline power of a stat block. Same formula as combatPower() in src/systems/heroes.ts. */
export function statPower(hp: number, atk: number, def: number): number {
  return hp + atk * 10 + def * 5;
}

const NAMES = ['Rookie', 'Trooper', 'Ranger', 'Veteran', 'Vanguard', 'Striker', 'Sentinel', 'Warden', 'Paragon', 'Titan'];
const FOOD = [3, 6, 12, 24, 45, 80, 140, 240, 400, 650];
const IRON = [2, 4, 8, 16, 30, 55, 95, 160, 270, 450];
const GOLD = [0, 0, 0, 4, 10, 20, 35, 60, 100, 170];
const TRAIN = [0.4, 0.6, 0.9, 1.3, 2, 3, 4.5, 6.5, 9, 12];
const LOAD = [400, 520, 650, 800, 1200, 1400, 1600, 1800, 2000, 2200];

export const TROOP_TIERS: TroopTierDef[] = NAMES.map((name, i) => {
  const cost: Cost = { food: FOOD[i], iron: IRON[i] };
  if (GOLD[i]) cost.gold = GOLD[i];
  // Exact (unrounded) stats: the battle sim multiplies them by soldier counts.
  const m = Math.pow(TROOP_TIER_MULT, i);
  const hp = TROOP_BASE.hp * m;
  const atk = TROOP_BASE.atk * m;
  const def = TROOP_BASE.def * m;
  return {
    tier: i + 1,
    name,
    power: statPower(hp, atk, def),
    hp,
    atk,
    def,
    load: LOAD[i],
    cost,
    trainSec: TRAIN[i],
  };
});

export const MAX_TIER = TROOP_TIERS.length;

export function troopTier(tier: number): TroopTierDef {
  return TROOP_TIERS[Math.max(1, Math.min(MAX_TIER, Math.round(tier))) - 1];
}

/** Short label used on tier badges ("T3"). */
export function tierLabel(tier: number): string {
  return 'T' + tier;
}

/** Formats a (possibly fractional) per-soldier stat for display: 0.3, 2.56, 41, 1.2K. */
export function fmtTroopStat(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) return String(Math.round(n * 10) / 10);
  return String(Math.round(n * 100) / 100);
}

/** Healing a wounded soldier costs this fraction of its training cost... */
export const HEAL_COST_FACTOR = 0.3;
/** ...and takes this fraction of its training time. */
export const HEAL_TIME_FACTOR = 0.35;
