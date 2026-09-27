// OWNER: heroes agent. District campaign tuning: zombie archetypes, names, power curve, rewards.

export type ZombieKind = 'walker' | 'runner' | 'brute' | 'spitter' | 'boss';

export interface ZombieKindDef {
  kind: ZombieKind;
  name: string;
  /** Model key understood by the battle scene. */
  model: 'zombie' | 'zombieRunner' | 'zombieBrute' | 'zombieSpitter' | 'zombieBoss';
  /** Ability id (see ZOMBIE_ABILITIES in src/systems/battle.ts). */
  skillId: string;
  /** Stat ratios per unit of strength. */
  ratio: { hp: number; atk: number; def: number };
  /** Zombies shown in the group. */
  count: number;
  /** Share of the district's power relative to a walker pack (1). */
  weight: number;
  /** First district where this kind appears. */
  from: number;
  blurb: string;
}

export const ZOMBIE_KINDS: Record<ZombieKind, ZombieKindDef> = {
  walker: {
    kind: 'walker',
    name: 'Shambler Pack',
    model: 'zombie',
    skillId: 'z_bite',
    ratio: { hp: 10, atk: 1, def: 0.45 },
    count: 5,
    weight: 1,
    from: 1,
    blurb: 'Slow, stubborn and always hungry.',
  },
  runner: {
    kind: 'runner',
    name: 'Sprinter Pack',
    model: 'zombieRunner',
    skillId: 'z_pounce',
    ratio: { hp: 6.5, atk: 1.35, def: 0.25 },
    count: 4,
    weight: 0.95,
    from: 2,
    blurb: 'Fast attackers that pounce on your back row.',
  },
  spitter: {
    kind: 'spitter',
    name: 'Spitter Nest',
    model: 'zombieSpitter',
    skillId: 'z_spit',
    ratio: { hp: 7, atk: 1.3, def: 0.3 },
    count: 3,
    weight: 0.95,
    from: 3,
    blurb: 'Acid that melts armour (DEF down).',
  },
  brute: {
    kind: 'brute',
    name: 'Hulk',
    model: 'zombieBrute',
    skillId: 'z_smash',
    ratio: { hp: 16, atk: 0.75, def: 0.9 },
    count: 2,
    weight: 1.3,
    from: 4,
    blurb: 'A wall of rotten muscle. Smashes the front row.',
  },
  boss: {
    kind: 'boss',
    name: 'Boss',
    model: 'zombieBoss',
    skillId: 'z_boss',
    ratio: { hp: 14, atk: 1.15, def: 0.8 },
    count: 1,
    weight: 2.6,
    from: 5,
    blurb: 'Slams the ground (hits all, stuns the front). Enrages at half HP.',
  },
};

export const BOSS_NAMES = [
  'Grave Titan',
  'Rotjaw',
  'The Foreman',
  'Mother Blight',
  'Big Harlan',
  'Sludge King',
  'The Tollkeeper',
  'Ironhide',
  'Old Cinder',
  'The Conductor',
];

const PREFIX = ['Cinder', 'Rust', 'Ash', 'Hollow', 'Quarry', 'Canal', 'Brick', 'Salt', 'Tin', 'Copper', 'Mill', 'Signal', 'Harbor', 'Lantern', 'Gravel', 'Thistle'];
const SUFFIX = ['Row', 'Yards', 'Heights', 'Market', 'Depot', 'Flats', 'Junction', 'Terrace', 'Commons', 'Works', 'Crossing', 'Sprawl'];

/** Stable, original district names. */
export function districtName(n: number): string {
  const a = PREFIX[(n * 7 + 3) % PREFIX.length];
  const b = SUFFIX[(n * 5 + Math.floor(n / PREFIX.length)) % SUFFIX.length];
  return `${a} ${b}`;
}

/** Enemy power of district 1 (starter squad is ~12K). */
export const DISTRICT_BASE_POWER = 6200;
/** +12% per district for the first 15, +11% up to 40, then +7.5% (keeps late districts reachable). */
export function districtPower(n: number): number {
  const a = Math.min(n, 15) - 1;
  const b = Math.max(0, Math.min(n, 40) - 15);
  const c = Math.max(0, n - 40);
  return Math.round(DISTRICT_BASE_POWER * Math.pow(1.12, a) * Math.pow(1.11, b) * Math.pow(1.075, c));
}

export function isBossDistrict(n: number): boolean {
  return n % 5 === 0;
}

/** Fraction of lost HP converted to wounded soldiers after a district battle. */
export const DISTRICT_TROOP_LOSS = 0.25;

/** Idle loot truck: hourly rates by districts cleared, and the storage cap. */
export const IDLE_CAP_HOURS = 8;
export function idleRatesFor(cleared: number): { food: number; iron: number; gold: number; heroExp: number } {
  if (cleared <= 0) return { food: 0, iron: 0, gold: 0, heroExp: 0 };
  return {
    food: 240 + 60 * cleared,
    iron: 180 + 45 * cleared,
    gold: cleared >= 8 ? 30 * (cleared - 7) : 0,
    heroExp: 90 + 30 * cleared,
  };
}
