// OWNER: world agent. Tuning tables for the world map: sizes, timers, enemy power curves, loot, names.
// Everything here is plain data/pure functions so it can be tuned without touching the systems.
import type { Reward } from '../core/types';

// ---------------------------------------------------------------- map geometry
/** Tiles per map side. The player's base sits in the centre. */
export const MAP_TILES = 64;
/** World units per tile. */
export const TILE = 4;
/** Half the map size in world units (map spans -HALF..HALF on x and z). */
export const HALF = (MAP_TILES * TILE) / 2;
/** Tiles around the centre reserved for the player's outpost. */
export const BASE_TILE_RADIUS = 3;
/** Distance (world units) from the base centre where marches leave/enter the outpost. */
export const BASE_GATE_RADIUS = 8;

// ---------------------------------------------------------------- stamina
export const STAMINA_MAX = 120;
export const STAMINA_REGEN_MS = 5 * 60_000;
export const STAMINA_COST = { normal: 10, elite: 20, boss: 20, rival: 10 } as const;
/** Stamina restored by one `stamina_potion` when used from the world map. */
export const STAMINA_POTION_AMOUNT = 50;

// ---------------------------------------------------------------- marches
/** Travel time per tile of distance (before march_speed_pct). */
export const MARCH_MS_PER_TILE = 1100;
export const MARCH_MIN_MS = 4000;
/** Time a squad spends digging up a radar treasure. */
export const DIG_MS = 25_000;

// ---------------------------------------------------------------- population
export const MAX_HORDE_LEVEL = 40;
export const HORDE_TARGET = 88;
export const RESOURCE_TARGET = 34;
export const RIVAL_COUNT = 6;
/** Minimum hordes kept on the map at the player's current and next unlockable level. */
export const HORDES_AT_FRONTIER = 3;
export const RIVAL_SHIELD_MS = 2 * 3600_000;
export const REPORT_CAP = 30;
/** How often the map tops up hordes/resources (ms). */
export const MAINTAIN_MS = 45_000;
/** Bump when the entity generator changes shape so saves regenerate their map. */
export const WORLD_GEN_VERSION = 1;

// ---------------------------------------------------------------- radar
export const RADAR_REFRESH_MS = 6 * 3600_000;
export const RADAR_BASE_MISSIONS = 8;
export const RADAR_MISSIONS_PER_LEVEL_STEP = 3; // +1 mission every N radar levels
export const RADAR_MAX_MISSIONS = 12;
export const RADAR_MISSIONS_PER_LEVEL = 8; // completed missions per radar level

// ---------------------------------------------------------------- horde level layout
/** Natural horde level for a distance (in tiles) from the base centre. */
export function levelForDistance(dTiles: number): number {
  return Math.max(1, Math.min(MAX_HORDE_LEVEL, Math.round((dTiles - 3) / 1.1)));
}
/** Inverse of levelForDistance: where (in tiles) a horde of this level naturally lives. */
export function distanceForLevel(level: number): number {
  return 3 + level * 1.1;
}

// ---------------------------------------------------------------- enemy power
export type HordeVariant = 'normal' | 'elite' | 'boss';

/** Power curve of hordes. Tune these to match hero/squad power once heroes are balanced. */
export const HORDE_POWER_BASE = 3500;
export const HORDE_POWER_GROWTH = 1.2;
export const VARIANT_POWER_MULT: Record<HordeVariant, number> = { normal: 1, elite: 1.8, boss: 3.2 };

export function hordePower(level: number, variant: HordeVariant = 'normal'): number {
  return Math.round(HORDE_POWER_BASE * Math.pow(HORDE_POWER_GROWTH, level - 1) * VARIANT_POWER_MULT[variant]);
}

/**
 * Stat model for generated enemies. A unit with "power" u gets hp = u*HP, atk = u*ATK, def = u*DEF,
 * and power is re-estimated as hp*0.5 + atk*4 + def*2 (= u with the defaults below).
 */
export const STAT_HP = 1.0;
export const STAT_ATK = 0.1;
export const STAT_DEF = 0.05;
export function estimatePower(hp: number, atk: number, def: number): number {
  return hp * 0.5 + atk * 4 + def * 2;
}

/** Share of the formation's power per slot (front row 0-1 is beefier). */
export const LINEUP_SHARES: Record<HordeVariant, number[]> = {
  normal: [0.24, 0.24, 0.18, 0.17, 0.17],
  elite: [0.27, 0.27, 0.16, 0.15, 0.15],
  boss: [0.4, 0.2, 0.14, 0.13, 0.13],
};

/** Zombies killed (for quests/stats) when a horde is wiped out. */
export function hordeZombieCount(level: number, variant: HordeVariant): number {
  const base = 10 + level * 3;
  return variant === 'boss' ? base * 4 : variant === 'elite' ? base * 2 : base;
}

// ---------------------------------------------------------------- horde loot
const VARIANT_LOOT_MULT: Record<HordeVariant, number> = { normal: 1, elite: 2.5, boss: 5 };

/** Deterministic loot preview shown before attacking (items listed as guaranteed/chance separately). */
export function hordeLootPreview(level: number, variant: HordeVariant): Reward {
  const g = Math.pow(1.18, level - 1) * VARIANT_LOOT_MULT[variant];
  const currencies: Reward['currencies'] = {
    food: Math.round(700 * g),
    iron: Math.round(520 * g),
    heroExp: Math.round(300 * Math.pow(1.17, level - 1) * VARIANT_LOOT_MULT[variant]),
  };
  if (level >= 4) currencies.gold = Math.round(110 * g);
  const items: Record<string, number> = {};
  if (variant === 'elite') items.skill_medal = 1 + Math.floor(level / 10);
  if (variant === 'boss') {
    items.skill_medal = 3 + Math.floor(level / 8);
    items.recruit_ticket = 1;
    currencies.diamonds = 20 + level;
  }
  return Object.keys(items).length ? { currencies, items } : { currencies };
}

/** Actual loot: the preview +-10% plus random item drops. `rng` is seeded per battle. */
export function rollHordeLoot(level: number, variant: HordeVariant, rng: () => number): Reward {
  const base = hordeLootPreview(level, variant);
  const currencies: Record<string, number> = {};
  for (const [k, v] of Object.entries(base.currencies ?? {})) currencies[k] = Math.round((v ?? 0) * (0.9 + rng() * 0.2));
  const items: Record<string, number> = {};
  for (const [k, v] of Object.entries(base.items ?? {})) items[k] = v ?? 0;
  if (rng() < 0.3) items.speedup_5m = (items.speedup_5m ?? 0) + 1;
  if (variant !== 'normal' && rng() < 0.25) items.recruit_ticket = (items.recruit_ticket ?? 0) + 1;
  if (level >= 8 && rng() < 0.12) items.speedup_1h = (items.speedup_1h ?? 0) + 1;
  return Object.keys(items).length ? { currencies, items } : { currencies };
}

/** Diamonds for beating a horde level for the first time. */
export function firstClearBonus(level: number): number {
  return 10 + level * 2;
}

// ---------------------------------------------------------------- resource tiles
export type ResKind = 'food' | 'iron' | 'gold';
export const RES_KINDS: ResKind[] = ['food', 'iron', 'gold'];
export const RES_MAX_LEVEL = 6;
export const RES_NAMES: Record<ResKind, string> = { food: 'Farmland', iron: 'Iron Deposit', gold: 'Gold Vein' };
const RES_CAPACITY = [6000, 12000, 22000, 38000, 60000, 90000];
/** Gold is heavier: each gold unit uses this much squad load. */
export const RES_WEIGHT: Record<ResKind, number> = { food: 1, iron: 1, gold: 3 };

export function resourceCapacity(res: ResKind, level: number): number {
  const c = RES_CAPACITY[Math.max(0, Math.min(RES_MAX_LEVEL - 1, level - 1))];
  return res === 'gold' ? Math.round(c * 0.3) : c;
}
/** Units gathered per second on a tile of this level (before gather_speed_pct). */
export function gatherRatePerSec(res: ResKind, level: number): number {
  const r = 22 + level * 9;
  return res === 'gold' ? r / RES_WEIGHT.gold : r;
}
/** How much one soldier of a tier can carry. */
export function loadPerTroop(tier: number): number {
  return 12 + tier * 8;
}
export function resourceLevelForDistance(dTiles: number, rng: () => number): number {
  return Math.max(1, Math.min(RES_MAX_LEVEL, Math.floor(dTiles / 6) + (rng() < 0.3 ? 1 : 0)));
}

// ---------------------------------------------------------------- rivals
export const RIVAL_PREFIX = ['Rust', 'Cinder', 'Dust', 'Ash', 'Grim', 'Salt', 'Storm', 'Bone', 'Scrap', 'Red', 'Hollow', 'Crow', 'Thorn', 'Ember', 'Frost', 'Tin'];
export const RIVAL_SUFFIX = ['fang', 'ridge', 'hold', 'wick', 'gate', 'haven', 'crag', 'mark', 'watch', 'fall', 'moor', 'reach'];
export const RIVAL_KIND = ['Holdout', 'Camp', 'Bastion', 'Stronghold', 'Enclave', 'Redoubt', 'Compound', 'Refuge'];
export const RIVAL_COMMANDERS = ['Vesk', 'Maro', 'Tallis', 'Brannik', 'Oda', 'Quill', 'Sable', 'Harrow', 'Juno', 'Kade', 'Ryker', 'Ilsa', 'Dorran', 'Pike', 'Wren', 'Soren'];
export const RIVAL_COLORS = [0xd04848, 0x3f9fdc, 0xe0a020, 0x9a58d8, 0x3fbf7f, 0xe0702c, 0xd0509e, 0x4fcfcf];
/** Rival power relative to a horde of the same level, and growth per real day (capped). */
export const RIVAL_POWER_MULT = 1.25;
export const RIVAL_GROWTH_PER_DAY = 0.08;
export const RIVAL_GROWTH_CAP = 3;

export function rivalPlunderPreview(level: number): Reward {
  const g = Math.pow(1.18, level - 1);
  return {
    currencies: { food: Math.round(1800 * g), iron: Math.round(1400 * g), gold: Math.round(400 * g) },
  };
}

// ---------------------------------------------------------------- radar
export type RadarKind = 'rescue' | 'cache' | 'horde' | 'elite' | 'dig';
export const RADAR_INFO: Record<RadarKind, { title: string; desc: string }> = {
  rescue: { title: 'Stranded Scavengers', desc: 'Survivors are signalling for help. Reach them for an instant reward.' },
  cache: { title: 'Supply Drop', desc: 'An old airdrop crate was spotted nearby. Pick it up for free.' },
  horde: { title: 'Marked Horde', desc: 'The radar tagged a horde near the outpost. Wipe it out.' },
  elite: { title: 'Elite Hunt', desc: 'A mutated elite is roaming close by. Costs 20 stamina.' },
  dig: { title: 'Buried Cache', desc: 'Send a squad to dig up a buried stash. Lucky digs pay double or more.' },
};
/** Relative weights of mission kinds on a fresh board. */
export const RADAR_WEIGHTS: Record<RadarKind, number> = { rescue: 3, cache: 2, horde: 3, elite: 1, dig: 2 };

/** Reward for a radar mission. `tier` grows with the player's horde progress. */
export function radarReward(kind: RadarKind, stars: number, tier: number, rng: () => number): Reward {
  const g = Math.pow(1.16, Math.max(0, tier - 1)) * (0.6 + stars * 0.4);
  const r = (n: number) => Math.round(n * g);
  switch (kind) {
    case 'rescue':
      return { currencies: { heroExp: r(600), food: r(900) }, items: rng() < 0.4 ? { speedup_5m: 1 } : undefined };
    case 'cache': {
      const res = rng() < 0.5 ? 'food' : 'iron';
      return { currencies: { [res]: r(1600), gold: r(200) } };
    }
    case 'horde':
      return { currencies: { food: r(1400), iron: r(1100), heroExp: r(500) }, items: { speedup_5m: 1 + Math.floor(stars / 3) } };
    case 'elite':
      return { currencies: { diamonds: 10 + stars * 6, heroExp: r(900) }, items: { skill_medal: 1 + Math.floor(stars / 2) } };
    case 'dig':
      return { currencies: { gold: r(500), iron: r(1200) }, items: rng() < 0.35 ? { speedup_1h: 1 } : { speedup_5m: 2 } };
  }
}

/** Treasure dig multiplier roll. */
export function rollDigMultiplier(rng: () => number): number {
  const x = rng();
  return x < 0.07 ? 5 : x < 0.3 ? 2 : 1;
}

/** Star rarity weights, shifted by radar level. */
export function rollStars(radarLevel: number, rng: () => number): number {
  const shift = Math.min(0.25, radarLevel * 0.02);
  const x = rng() + shift;
  return x > 1.02 ? 5 : x > 0.9 ? 4 : x > 0.7 ? 3 : x > 0.38 ? 2 : 1;
}

// ---------------------------------------------------------------- names & labels
export const HORDE_NAMES: Record<HordeVariant, string> = {
  normal: 'Shambler Pack',
  elite: 'Mauler Brood',
  boss: 'Blight Colossus',
};

/** Friendly names for items we grant (the meta module owns the full item catalogue). */
export const ITEM_LABELS: Record<string, string> = {
  speedup_1m: 'Speed-up 1m',
  speedup_5m: 'Speed-up 5m',
  speedup_1h: 'Speed-up 1h',
  speedup_8h: 'Speed-up 8h',
  recruit_ticket: 'Recruit Ticket',
  skill_medal: 'Skill Medal',
  stamina_potion: 'Stamina Potion',
  food_box: 'Food Crate',
  iron_box: 'Iron Crate',
  gold_box: 'Gold Crate',
  exp_box: 'EXP Crate',
};
