// OWNER: meta agent. Soldier tiers T1..T10: names, per-soldier power/stats, training cost & time.
// Soldiers have no type (only tiers). Numbers follow the genre curve (T10 ~ 69x T1 power), timers compressed.
import type { Cost } from '../core/types';

export interface TroopTierDef {
  tier: number;
  name: string;
  /** Power contributed by one ready soldier. */
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

const NAMES = ['Rookie', 'Trooper', 'Ranger', 'Veteran', 'Vanguard', 'Striker', 'Sentinel', 'Warden', 'Paragon', 'Titan'];
const POWER = [24, 50, 100, 200, 409, 540, 715, 945, 1250, 1647];
const FOOD = [3, 6, 12, 24, 45, 80, 140, 240, 400, 650];
const IRON = [2, 4, 8, 16, 30, 55, 95, 160, 270, 450];
const GOLD = [0, 0, 0, 4, 10, 20, 35, 60, 100, 170];
const TRAIN = [0.4, 0.6, 0.9, 1.3, 2, 3, 4.5, 6.5, 9, 12];
const LOAD = [400, 520, 650, 800, 1200, 1400, 1600, 1800, 2000, 2200];

export const TROOP_TIERS: TroopTierDef[] = NAMES.map((name, i) => {
  const cost: Cost = { food: FOOD[i], iron: IRON[i] };
  if (GOLD[i]) cost.gold = GOLD[i];
  return {
    tier: i + 1,
    name,
    power: POWER[i],
    hp: Math.round(POWER[i] * 4),
    atk: Math.round(POWER[i] * 0.9),
    def: Math.round(POWER[i] * 0.5),
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

/** Healing a wounded soldier costs this fraction of its training cost... */
export const HEAL_COST_FACTOR = 0.3;
/** ...and takes this fraction of its training time. */
export const HEAL_TIME_FACTOR = 0.35;
