// OWNER: base agent. Static building data: names, unlock rules, cost/time/effect/power curves,
// HQ prerequisite chain and the fixed base layout (plots + surrounding districts).
// Pure data + pure functions of level only (no game state); aggregation lives in src/systems/buildings.ts.
import type { BonusKey, BuildingType, Cost, CurrencyId } from '../core/types';

export const MAX_BUILDING_LEVEL = 30;
/** Hours of output a producer stores before it stops (before warehouse bonus). */
export const PRODUCER_CAP_HOURS = 10;
export const SECOND_BUILDER_DIAMONDS = 500;
export const MAX_BUILDERS = 2;
/** Base free-finish window for construction (research may extend it via `free_finish_min`). */
export const BASE_FREE_FINISH_MS = 5 * 60 * 1000;

export type PlotKind = 'hq' | 'wall' | 'core' | 'res';

/** A requirement to own the Nth building of a type. All present conditions must hold. */
export interface UnlockRule {
  hq?: number;
  districts?: number;
}

export type EffectFmt = 'int' | 'pct' | 'perHour' | 'tier' | 'plus';
export interface EffectLine {
  label: string;
  value: number;
  fmt: EffectFmt;
  /** Icon name (src/ui/components/Icon.tsx) shown next to the value. */
  icon?: string;
}

export interface BuildingDef {
  type: BuildingType;
  name: string;
  /** One-line flavour/utility text. */
  desc: string;
  plot: PlotKind;
  /** Unlock rule of each instance (index 0 = 1st building). Length = max count. */
  unlocks: UnlockRule[];
  /** Cost multiplier relative to the standard curve. */
  costMult: number;
  /** Share of the standard cost paid in food (rest is iron). */
  foodShare: number;
  timeMult: number;
  /** Fraction of Command Post power at the same level. */
  powerMult: number;
  produces?: CurrencyId;
  /** Accent colour used by UI cards. */
  accent: string;
}

// ---------------------------------------------------------------------------------------------
// Curves
// ---------------------------------------------------------------------------------------------

/** Standard total resource cost (food+iron) of upgrading TO `level`. ~x1.75 early, x1.55 mid, x1.37 late. */
const STD_COST: number[] = (() => {
  const out = [0, 30, 90];
  for (let l = 3; l <= MAX_BUILDING_LEVEL; l++) {
    const g = l <= 10 ? 1.7 : l <= 20 ? 1.55 : 1.37;
    out[l] = out[l - 1] * g;
  }
  return out;
})();

/** Standard build time (seconds) to reach `level`. L1-2 seconds, ~1 min at L4, ~10 min at L8, ~1 h at L12. */
const STD_TIME: number[] = (() => {
  const head = [0, 3, 6, 20, 60, 140, 230, 380, 580, 840, 1200, 1800, 2700];
  const out = head.slice();
  for (let l = head.length; l <= MAX_BUILDING_LEVEL; l++) out[l] = out[l - 1] * 1.27;
  return out;
})();

/** Command Post power at a level (L1 900, L10 ~9.9K, L20 ~68K, L30 ~390K). */
const HQ_POWER: number[] = (() => {
  const out = [0, 900];
  for (let l = 2; l <= MAX_BUILDING_LEVEL; l++) {
    const g = l <= 10 ? 1.305 : l <= 20 ? 1.212 : 1.19;
    out[l] = out[l - 1] * g;
  }
  return out;
})();

function roundNice(n: number): number {
  if (n < 100) return Math.round(n);
  if (n < 1000) return Math.round(n / 5) * 5;
  if (n < 10000) return Math.round(n / 10) * 10;
  if (n < 100000) return Math.round(n / 100) * 100;
  return Math.round(n / 1000) * 1000;
}

const clampLv = (l: number) => Math.max(0, Math.min(MAX_BUILDING_LEVEL, Math.floor(l)));

// ---------------------------------------------------------------------------------------------
// Definitions (all names/text original)
// ---------------------------------------------------------------------------------------------

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  hq: {
    type: 'hq',
    name: 'Command Post',
    desc: 'The heart of the outpost. Its level caps every other building and your heroes.',
    plot: 'hq',
    unlocks: [{}],
    costMult: 2.2,
    foodShare: 0.5,
    timeMult: 1.4,
    powerMult: 1,
    accent: '#3a9cf0',
  },
  wall: {
    type: 'wall',
    name: 'Bulwark Gate',
    desc: 'Fortified gate and perimeter. Toughens every defender of the outpost.',
    plot: 'wall',
    unlocks: [{}],
    costMult: 1,
    foodShare: 0.35,
    timeMult: 1,
    powerMult: 0.45,
    accent: '#9aa4b0',
  },
  barracks: {
    type: 'barracks',
    name: 'Barracks Hall',
    desc: 'Trains soldiers. Higher levels unlock stronger tiers and bigger batches.',
    plot: 'core',
    unlocks: [{}, { hq: 9 }, { hq: 15 }, { hq: 22 }],
    costMult: 1,
    foodShare: 0.5,
    timeMult: 1,
    powerMult: 0.4,
    accent: '#6b8e23',
  },
  drill: {
    type: 'drill',
    name: 'Parade Yard',
    desc: 'Quarters and drills your soldiers. Raises how many troops the outpost can house.',
    plot: 'core',
    unlocks: [{}, { hq: 16 }, { hq: 21 }],
    costMult: 0.9,
    foodShare: 0.75,
    timeMult: 0.9,
    powerMult: 0.35,
    accent: '#b08a50',
  },
  hospital: {
    type: 'hospital',
    name: 'Field Hospital',
    desc: 'Wounded soldiers recover here. Anyone beyond its beds is lost.',
    plot: 'core',
    unlocks: [{ hq: 3 }, { hq: 9 }, { hq: 14 }, { hq: 20 }],
    costMult: 0.9,
    foodShare: 0.75,
    timeMult: 0.9,
    powerMult: 0.3,
    accent: '#e05a5a',
  },
  tech: {
    type: 'tech',
    name: 'Research Lab',
    desc: 'Unlocks research. Required for every Command Post upgrade from level 8.',
    plot: 'core',
    unlocks: [{ hq: 7 }],
    costMult: 1.1,
    foodShare: 0.4,
    timeMult: 1.1,
    powerMult: 0.4,
    accent: '#40b0d0',
  },
  farm: {
    type: 'farm',
    name: 'Greenhouse Farm',
    desc: 'Grows food around the clock. Collect it before the silos fill up.',
    plot: 'res',
    unlocks: [{}, { hq: 2 }, { hq: 5 }, { hq: 9 }, { hq: 14 }],
    costMult: 0.6,
    foodShare: 0.3,
    timeMult: 0.7,
    powerMult: 0.12,
    produces: 'food',
    accent: '#e8a33c',
  },
  ironmine: {
    type: 'ironmine',
    name: 'Iron Quarry',
    desc: 'Digs and smelts iron ore for construction and training.',
    plot: 'res',
    unlocks: [{ hq: 2 }, { hq: 3, districts: 1 }, { hq: 6 }, { hq: 10 }, { hq: 15 }],
    costMult: 0.6,
    foodShare: 0.7,
    timeMult: 0.7,
    powerMult: 0.12,
    produces: 'iron',
    accent: '#9aa4b0',
  },
  goldmine: {
    type: 'goldmine',
    name: 'Gold Refinery',
    desc: 'Refines salvaged gold into coin. Coin is needed for advanced upgrades.',
    plot: 'res',
    unlocks: [{ hq: 8 }, { hq: 12 }, { hq: 17 }],
    costMult: 0.7,
    foodShare: 0.5,
    timeMult: 0.8,
    powerMult: 0.15,
    produces: 'gold',
    accent: '#f5c542',
  },
  warehouse: {
    type: 'warehouse',
    name: 'Supply Depot',
    desc: 'Extra silos and crates: producers store more output before they stop.',
    plot: 'core',
    unlocks: [{ hq: 4 }, { hq: 12 }],
    costMult: 0.6,
    foodShare: 0.5,
    timeMult: 0.6,
    powerMult: 0.1,
    accent: '#a07a50',
  },
  tavern: {
    type: 'tavern',
    name: 'Mess Hall',
    desc: 'Wandering fighters gather here. Recruit new heroes.',
    plot: 'core',
    unlocks: [{ districts: 3 }],
    costMult: 0.8,
    foodShare: 0.6,
    timeMult: 0.9,
    powerMult: 0.2,
    accent: '#c0602a',
  },
  tankcenter: {
    type: 'tankcenter',
    name: 'Armor Works',
    desc: 'Tunes armored vehicles: boosts Tank heroes and how many troops they lead.',
    plot: 'core',
    unlocks: [{ hq: 6 }],
    costMult: 1,
    foodShare: 0.3,
    timeMult: 1.1,
    powerMult: 0.45,
    accent: '#7a9a3a',
  },
  aircenter: {
    type: 'aircenter',
    name: 'Skyport',
    desc: 'Hangars and a runway: boosts Aircraft heroes and how many troops they lead.',
    plot: 'core',
    unlocks: [{ hq: 10 }],
    costMult: 1,
    foodShare: 0.3,
    timeMult: 1.1,
    powerMult: 0.45,
    accent: '#5a9ad0',
  },
  missilecenter: {
    type: 'missilecenter',
    name: 'Rocket Yard',
    desc: 'Launch rails and payload bays: boosts Missile heroes and how many troops they lead.',
    plot: 'core',
    unlocks: [{ hq: 13 }],
    costMult: 1,
    foodShare: 0.3,
    timeMult: 1.1,
    powerMult: 0.45,
    accent: '#c07040',
  },
  radar: {
    type: 'radar',
    name: 'Signal Tower',
    desc: 'Scans the wasteland: opens the world map, speeds marches and raises stamina.',
    plot: 'core',
    unlocks: [{ hq: 4 }],
    costMult: 0.8,
    foodShare: 0.4,
    timeMult: 0.8,
    powerMult: 0.2,
    accent: '#50a070',
  },
  trainingbase: {
    type: 'trainingbase',
    name: 'Combat Academy',
    desc: 'Sparring grounds that steadily produce Hero EXP.',
    plot: 'res',
    unlocks: [{ hq: 2, districts: 2 }, { hq: 7 }, { hq: 12 }, { hq: 18 }, { hq: 24 }],
    costMult: 0.8,
    foodShare: 0.5,
    timeMult: 0.8,
    powerMult: 0.15,
    produces: 'heroExp',
    accent: '#7ee06a',
  },
};

export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];
/** Types that can be placed on each plot kind (build menu order). */
export const PLOT_TYPES: Record<PlotKind, BuildingType[]> = {
  hq: ['hq'],
  wall: ['wall'],
  core: ['barracks', 'drill', 'hospital', 'tavern', 'radar', 'warehouse', 'tankcenter', 'tech', 'aircenter', 'missilecenter'],
  res: ['farm', 'ironmine', 'trainingbase', 'goldmine'],
};

export function buildingName(type: BuildingType): string {
  return BUILDINGS[type]?.name ?? type;
}

// ---------------------------------------------------------------------------------------------
// Cost / time / power
// ---------------------------------------------------------------------------------------------

/** Resources needed to upgrade a building TO `level` (level 1 = construction). Gold from level 9. */
export function upgradeCost(type: BuildingType, level: number): Cost {
  const d = BUILDINGS[type];
  const l = clampLv(level);
  if (l < 1) return {};
  const total = STD_COST[l] * d.costMult;
  const cost: Cost = {
    food: roundNice(total * d.foodShare),
    iron: roundNice(total * (1 - d.foodShare)),
  };
  if (l >= 9) cost.gold = roundNice(total * Math.min(0.42, 0.26 + (l - 9) * 0.015));
  if (!cost.food) delete cost.food;
  if (!cost.iron) delete cost.iron;
  return cost;
}

/** Base build time (ms, before speed bonuses) to reach `level`. */
export function baseUpgradeMs(type: BuildingType, level: number): number {
  const l = clampLv(level);
  if (l < 1) return 0;
  return Math.round(STD_TIME[l] * BUILDINGS[type].timeMult) * 1000;
}

/** Power of one building at `level`. */
export function buildingPower(type: BuildingType, level: number): number {
  const l = clampLv(level);
  if (l < 1) return 0;
  return Math.round(HQ_POWER[l] * BUILDINGS[type].powerMult);
}

/** Diamonds to instantly skip `ms` of timer. ~5 for 5 min, ~45 for 1 h, ~290 for 8 h. */
export function diamondsForMs(ms: number): number {
  if (ms <= 0) return 0;
  const min = ms / 60000;
  return Math.max(1, Math.ceil(Math.pow(min, 0.9) * 1.1));
}

// ---------------------------------------------------------------------------------------------
// Per-level effect formulas (single source of truth for systems AND UI)
// ---------------------------------------------------------------------------------------------

/** Output per hour of one producer at a level (food/iron/gold/heroExp), before bonuses. */
export function productionAt(type: BuildingType, level: number): number {
  const l = clampLv(level);
  if (l < 1) return 0;
  const base = 600 + 1100 * l + 30 * l * l; // L1 1.7K/h, L10 14.6K/h, L20 34.6K/h, L30 60K/h
  switch (type) {
    case 'farm':
    case 'ironmine':
      return base;
    case 'goldmine':
      return Math.round(base * 0.6);
    case 'trainingbase':
      return 900 + 1100 * l + 40 * l * l; // L1 2K/h, L10 15.9K/h, L30 69K/h
    default:
      return 0;
  }
}

/** Troops housed by one Parade Yard. */
export function drillCapacityAt(level: number): number {
  const l = clampLv(level);
  return l < 1 ? 0 : 300 * l + 10 * l * l;
}
export const BASE_TROOP_CAPACITY = 400;

/** Beds in one Field Hospital. */
export function hospitalBedsAt(level: number): number {
  const l = clampLv(level);
  return l < 1 ? 0 : 120 + 60 * l;
}
export const BASE_HOSPITAL_BEDS = 100;

/** Highest soldier tier a Barracks Hall of this level can train. */
const TIER_AT = [1, 4, 6, 10, 14, 17, 20, 24, 27, 30]; // level needed for tier i+1
export function tierAt(level: number): number {
  let t = 1;
  for (let i = 0; i < TIER_AT.length; i++) if (level >= TIER_AT[i]) t = i + 1;
  return t;
}
/** Barracks level needed for a tier (for "next tier at" hints). */
export function levelForTier(tier: number): number {
  return TIER_AT[Math.max(0, Math.min(TIER_AT.length - 1, tier - 1))];
}

/** Soldiers per training batch at a Barracks Hall of this level. */
export function batchAt(level: number): number {
  const l = clampLv(level);
  if (l < 1) return 0;
  return l <= 10 ? 10 + 14 * l : 150 + 10 * (l - 10);
}

/** Extra march size per hero granted by a type center of this level (+10 at L1 ... +100 at L30). */
export function centerMarchAt(level: number): number {
  const l = clampLv(level);
  return l < 1 ? 0 : Math.round(10 + ((l - 1) * 90) / 29);
}

/** Base march size per hero from the Command Post level. */
export function hqMarchAt(hq: number): number {
  return 50 + 25 * Math.max(0, hq - 1);
}

/** Per-type bonus contributed by a single building at a level (summed/maxed by the provider). */
export function bonusesAt(type: BuildingType, level: number): Partial<Record<BonusKey, number>> {
  const l = clampLv(level);
  if (l < 1) return {};
  switch (type) {
    case 'hq':
      return { hp_pct: 0.5 * (l - 1), atk_pct: 0.5 * (l - 1) };
    case 'wall':
      return { def_pct: 0.5 * l };
    case 'tankcenter':
      return { tank_pct: l };
    case 'aircenter':
      return { aircraft_pct: l };
    case 'missilecenter':
      return { missile_pct: l };
    case 'warehouse':
      return { storage_pct: 3 * l };
    case 'tech':
      return { research_speed_pct: l };
    case 'barracks':
      return { train_speed_pct: l };
    case 'hospital':
      return { heal_speed_pct: l };
    case 'radar':
      return { march_speed_pct: l, stamina_max: 2 * l };
    case 'tavern':
      return { recruit_cd_pct: l };
    default:
      return {};
  }
}

/** Human-readable effect lines for the building panel (current vs next level). */
export function effectsAt(type: BuildingType, level: number): EffectLine[] {
  const l = clampLv(level);
  const b = bonusesAt(type, l);
  switch (type) {
    case 'hq':
      return [
        { label: 'Building level cap', value: l, fmt: 'int' },
        { label: 'Hero level cap', value: 5 * l, fmt: 'int' },
        { label: 'Troops led per hero', value: hqMarchAt(l), fmt: 'int', icon: 'troops' },
        { label: 'Hero HP & ATK', value: b.hp_pct ?? 0, fmt: 'pct' },
      ];
    case 'wall':
      return [{ label: 'Defense of all heroes', value: b.def_pct ?? 0, fmt: 'pct' }];
    case 'barracks':
      return [
        { label: 'Highest trainable tier', value: tierAt(l), fmt: 'tier' },
        { label: 'Soldiers per batch', value: batchAt(l), fmt: 'int', icon: 'troops' },
        { label: 'Training speed', value: b.train_speed_pct ?? 0, fmt: 'pct' },
      ];
    case 'drill':
      return [{ label: 'Troop capacity', value: drillCapacityAt(l), fmt: 'plus', icon: 'troops' }];
    case 'hospital':
      return [
        { label: 'Hospital beds', value: hospitalBedsAt(l), fmt: 'plus', icon: 'troops' },
        { label: 'Healing speed', value: b.heal_speed_pct ?? 0, fmt: 'pct' },
      ];
    case 'tech':
      return [{ label: 'Research speed', value: b.research_speed_pct ?? 0, fmt: 'pct' }];
    case 'farm':
    case 'ironmine':
    case 'goldmine':
    case 'trainingbase': {
      const res = BUILDINGS[type].produces!;
      const p = productionAt(type, l);
      return [
        { label: 'Output per hour', value: p, fmt: 'perHour', icon: res },
        { label: 'Storage', value: p * PRODUCER_CAP_HOURS, fmt: 'int', icon: res },
      ];
    }
    case 'warehouse':
      return [{ label: 'Producer storage', value: b.storage_pct ?? 0, fmt: 'pct' }];
    case 'tavern':
      return [{ label: 'Free recruit cooldown', value: -(b.recruit_cd_pct ?? 0), fmt: 'pct' }];
    case 'tankcenter':
    case 'aircenter':
    case 'missilecenter': {
      const key = type === 'tankcenter' ? 'tank_pct' : type === 'aircenter' ? 'aircraft_pct' : 'missile_pct';
      const who = type === 'tankcenter' ? 'Tank' : type === 'aircenter' ? 'Aircraft' : 'Missile';
      return [
        { label: `${who} hero stats`, value: b[key] ?? 0, fmt: 'pct' },
        { label: `${who} troops led per hero`, value: centerMarchAt(l), fmt: 'plus', icon: 'troops' },
      ];
    }
    case 'radar':
      return [
        { label: 'March speed', value: b.march_speed_pct ?? 0, fmt: 'pct' },
        { label: 'Max stamina', value: b.stamina_max ?? 0, fmt: 'plus', icon: 'stamina' },
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------------------------
// Command Post prerequisites (two buildings at target-1; Research Lab always from HQ 8)
// ---------------------------------------------------------------------------------------------

const HQ_PREREQ_EARLY: Record<number, [BuildingType, BuildingType]> = {
  2: ['drill', 'barracks'],
  3: ['wall', 'drill'],
  4: ['barracks', 'drill'],
  5: ['wall', 'barracks'],
  6: ['wall', 'drill'],
  7: ['wall', 'tankcenter'],
  8: ['tech', 'hospital'],
  9: ['tech', 'tankcenter'],
  10: ['tech', 'hospital'],
};
const HQ_ROTATION: BuildingType[] = ['wall', 'barracks', 'drill', 'tankcenter', 'hospital'];

/** Buildings (and the level they need) to upgrade the Command Post TO `target`. */
export function hqPrereqs(target: number): { type: BuildingType; level: number }[] {
  if (target < 2) return [];
  const pair = HQ_PREREQ_EARLY[target] ?? (['tech', HQ_ROTATION[(target - 11) % HQ_ROTATION.length]] as [BuildingType, BuildingType]);
  return pair.map((type) => ({ type, level: target - 1 }));
}

// ---------------------------------------------------------------------------------------------
// Layout: compound plots + surrounding district blocks
// ---------------------------------------------------------------------------------------------

export interface PlotDef {
  id: number;
  x: number;
  z: number;
  kind: PlotKind;
  /** District that must be cleared to use this plot (0 = inside the compound). */
  district: number;
}

export interface DistrictDef {
  /** 1-based; matches campaign stage numbers. */
  id: number;
  x: number;
  z: number;
  ring: number;
}

/** Size of a district block (world units). The compound covers 2x3 blocks around the origin. */
export const DISTRICT_SIZE = 16;
export const COMPOUND = { minX: -16, maxX: 16, minZ: -24, maxZ: 24 };
export const GATE = { x: 0, z: 23 };
/** Inner line of the perimeter wall (walls sit just inside the compound edge; streets run outside). */
export const WALL_INSET = 1.2;

const RING1: [number, number][] = [
  [8, 32], [-8, 32], [-24, 32], [-24, 16], [-24, 0], [-24, -16], [-24, -32],
  [-8, -32], [8, -32], [24, -32], [24, -16], [24, 0], [24, 16], [24, 32],
];
const RING2: [number, number][] = [
  [8, 48], [-8, 48], [-24, 48], [-40, 48], [-40, 32], [-40, 16], [-40, 0], [-40, -16], [-40, -32], [-40, -48],
  [-24, -48], [-8, -48], [8, -48], [24, -48], [40, -48], [40, -32], [40, -16], [40, 0], [40, 16], [40, 32],
  [40, 48], [24, 48],
];

export const DISTRICTS: DistrictDef[] = [
  ...RING1.map(([x, z], i) => ({ id: i + 1, x, z, ring: 1 })),
  ...RING2.map(([x, z], i) => ({ id: RING1.length + i + 1, x, z, ring: 2 })),
];

export const PLOTS: PlotDef[] = (() => {
  const p: PlotDef[] = [
    { id: 0, x: 0, z: -8, kind: 'hq', district: 0 },
    { id: 1, x: 0, z: 23, kind: 'wall', district: 0 },
    // Compound core plots (military & support)
    { id: 2, x: -9.5, z: -18, kind: 'core', district: 0 },
    { id: 3, x: 0, z: -19, kind: 'core', district: 0 },
    { id: 4, x: 9.5, z: -18, kind: 'core', district: 0 },
    { id: 5, x: -10, z: -8, kind: 'core', district: 0 },
    { id: 6, x: 10, z: -8, kind: 'core', district: 0 },
    { id: 7, x: -10, z: 2, kind: 'core', district: 0 },
    { id: 8, x: 10, z: 2, kind: 'core', district: 0 },
    // Compound resource yard (south, near the gate)
    { id: 9, x: -10.5, z: 11.5, kind: 'res', district: 0 },
    { id: 10, x: -5, z: 11.5, kind: 'res', district: 0 },
    { id: 11, x: 5, z: 11.5, kind: 'res', district: 0 },
    { id: 12, x: 10.5, z: 11.5, kind: 'res', district: 0 },
  ];
  let id = p.length;
  for (const d of DISTRICTS) {
    if (d.ring === 1) {
      p.push({ id: id++, x: d.x - 3.2, z: d.z, kind: 'res', district: d.id });
      p.push({ id: id++, x: d.x + 3.2, z: d.z, kind: 'core', district: d.id });
    } else {
      p.push({ id: id++, x: d.x, z: d.z, kind: d.id % 2 ? 'res' : 'core', district: d.id });
    }
  }
  return p;
})();

export function plotDef(id: number): PlotDef | undefined {
  return PLOTS[id]?.id === id ? PLOTS[id] : PLOTS.find((p) => p.id === id);
}

/** Starting plots for the opening. */
export const START_PLOTS = { hq: 0, wall: 1, farm: 9, drill: 5 };
