// OWNER: heroes agent. Original hero roster: stats, skills and portrait looks.
// All names, bios and skills are original to Outpost Surge.
import type { HeroRole, HeroType, Rarity } from '../core/types';

// ---------------------------------------------------------------------------------------------
// Skill model
// ---------------------------------------------------------------------------------------------

/** Enemy targeting rules. 'hit' = the targets of the previous damage effect in the same skill. */
export type EnemyTarget = 'front' | 'back' | 'lowest' | 'strongest' | 'random' | 'all' | 'hit';
export type AllyTarget = 'self' | 'allies' | 'lowestAlly' | 'frontAllies' | 'backAllies';
/** atk/def/haste/crit: +% (buff) or -% (debuff). guard: -% damage taken (buff). vuln: +% damage taken (debuff). */
export type BuffStat = 'atk' | 'def' | 'haste' | 'crit' | 'guard' | 'vuln';

export type SkillEffect =
  /** mult x caster ATK to `count` enemies. */
  | { op: 'dmg'; target: EnemyTarget; count?: number; mult: number }
  /** mult x caster ATK healed on each ally target. */
  | { op: 'heal'; target: AllyTarget; count?: number; mult: number }
  /** Shield worth pct% of the caster's max HP on each ally target (lasts `dur` s, default 8). */
  | { op: 'shield'; target: AllyTarget; count?: number; pct: number; dur?: number }
  | { op: 'buff'; target: AllyTarget; count?: number; stat: BuffStat; pct: number; dur: number }
  | { op: 'debuff'; target: EnemyTarget; count?: number; stat: BuffStat; pct: number; dur: number }
  | { op: 'stun'; target: EnemyTarget; count?: number; dur: number }
  | { op: 'energy'; target: AllyTarget; count?: number; amount: number };

export interface PassiveDef {
  /** Own stat bonuses in % (baked into squad stats). */
  atk?: number;
  hp?: number;
  def?: number;
  /** Squad aura in % for matching allies (baked into squad stats). */
  aura?: { scope: 'all' | HeroType | 'front' | 'back'; atk?: number; hp?: number; def?: number };
  /** Combat modifiers used by the battle simulation. */
  crit?: number; // + crit chance (percentage points)
  dmgRed?: number; // % less damage taken
  haste?: number; // % faster attacks
  vsZombie?: number; // % more damage vs zombies
  lifesteal?: number; // % of damage dealt healed back
  energy?: number; // starting energy
  rage?: number; // % more damage while below 50% HP
  thorns?: number; // % of damage taken reflected to the attacker
}

export interface SkillDef {
  id: string;
  name: string;
  kind: 'auto' | 'active' | 'passive';
  /** Auto skills fire on every Nth attack (replacing the basic attack). */
  every?: number;
  effects?: SkillEffect[];
  passive?: PassiveDef;
}

// ---------------------------------------------------------------------------------------------
// Portrait model (procedural SVG bust, see src/ui/heroes/HeroPortrait.tsx)
// ---------------------------------------------------------------------------------------------
export interface PortraitLook {
  /** 0..5 skin palette index. */
  skin: number;
  face: 'oval' | 'round' | 'square' | 'long' | 'heart';
  hair: 'buzz' | 'short' | 'sidepart' | 'swept' | 'mohawk' | 'curly' | 'bald' | 'long' | 'bob' | 'ponytail' | 'bun' | 'braids';
  hairColor: string;
  hat: 'none' | 'helmet' | 'tanker' | 'cap' | 'beret' | 'pilot' | 'goggles' | 'headset' | 'bandana' | 'boonie';
  hatColor?: string;
  eyes: 'normal' | 'narrow' | 'wide' | 'wink' | 'visor' | 'shades' | 'patch';
  eyeColor?: string;
  brows: 'flat' | 'angry' | 'raised' | 'thick';
  mouth: 'smile' | 'smirk' | 'flat' | 'grin' | 'frown' | 'open';
  beard?: 'stubble' | 'full' | 'mustache' | 'goatee';
  extra?: ('scar' | 'paint' | 'freckles' | 'earring' | 'cigar' | 'bandage' | 'blush' | 'mole' | 'lashes')[];
}

// ---------------------------------------------------------------------------------------------
// Hero definition
// ---------------------------------------------------------------------------------------------
export interface Stats {
  hp: number;
  atk: number;
  def: number;
}

export interface HeroDef {
  id: string;
  name: string;
  /** Short name used in battle callouts. */
  callsign: string;
  type: HeroType;
  rarity: Rarity;
  role: HeroRole;
  bio: string;
  /** Level-1, 0-star stats. */
  base: Stats;
  /** Added per level. */
  growth: Stats;
  /** [auto-attack skill, active (energy) skill, passive]. */
  skills: [SkillDef, SkillDef, SkillDef];
  look: PortraitLook;
}

/** Seconds between attacks by vehicle type. Aircraft fire fast, missiles hit hard and slow. */
export const ATTACK_INTERVAL: Record<HeroType, number> = { tank: 1.5, aircraft: 1.2, missile: 1.9 };
export const ACTIVE_ENERGY = 100;

const RARITY_MULT: Record<Rarity, number> = { SR: 1, SSR: 1.28, UR: 1.62 };
const ROLE_MULT: Record<HeroRole, Stats> = {
  defense: { hp: 1.35, atk: 0.78, def: 1.45 },
  attack: { hp: 0.86, atk: 1.32, def: 0.8 },
  support: { hp: 1.0, atk: 0.95, def: 1.0 },
};
const TYPE_MULT: Record<HeroType, Stats> = {
  tank: { hp: 1.1, atk: 1.0, def: 1.15 },
  aircraft: { hp: 0.95, atk: 0.8, def: 0.9 },
  missile: { hp: 0.95, atk: 1.25, def: 0.95 },
};
const BASE: Stats = { hp: 560, atk: 56, def: 30 };

function mkStats(type: HeroType, rarity: Rarity, role: HeroRole, tweak: Partial<Stats> = {}): { base: Stats; growth: Stats } {
  const r = RARITY_MULT[rarity];
  const ro = ROLE_MULT[role];
  const ty = TYPE_MULT[type];
  const base: Stats = {
    hp: Math.round(BASE.hp * r * ro.hp * ty.hp * (tweak.hp ?? 1)),
    atk: Math.round(BASE.atk * r * ro.atk * ty.atk * (tweak.atk ?? 1)),
    def: Math.round(BASE.def * r * ro.def * ty.def * (tweak.def ?? 1)),
  };
  const growth: Stats = {
    hp: Math.round(base.hp * 0.1 * 10) / 10,
    atk: Math.round(base.atk * 0.1 * 10) / 10,
    def: Math.round(base.def * 0.1 * 10) / 10,
  };
  return { base, growth };
}

type Raw = Omit<HeroDef, 'base' | 'growth'> & { tweak?: Partial<Stats> };

function hero(h: Raw): HeroDef {
  const { tweak, ...rest } = h;
  return { ...rest, ...mkStats(h.type, h.rarity, h.role, tweak) };
}

const auto = (id: string, name: string, every: number, effects: SkillEffect[]): SkillDef => ({ id, name, kind: 'auto', every, effects });
const active = (id: string, name: string, effects: SkillEffect[]): SkillDef => ({ id, name, kind: 'active', effects });
const passive = (id: string, name: string, p: PassiveDef): SkillDef => ({ id, name, kind: 'passive', passive: p });

// Uniform colours for portraits by type.
const HAIR = {
  black: '#1e1a1c',
  brown: '#5a3a22',
  chestnut: '#7a4424',
  blond: '#d8b060',
  platinum: '#e8e2d0',
  red: '#a8431f',
  grey: '#9a9a9a',
  white: '#e8e8e8',
  blue: '#3a6ad0',
  pink: '#e07aa8',
  teal: '#2a9a94',
};

export const HEROES: HeroDef[] = [
  // ================================= TANK =================================
  hero({
    id: 'brakka',
    name: 'Brakka Voss',
    callsign: 'Bulwark',
    type: 'tank',
    rarity: 'UR',
    role: 'defense',
    bio: 'Held the Ferrow bridge for nine days with one tank and a thermos of cold coffee.',
    skills: [
      auto('brakka_a', 'Hammer Round', 3, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.6 },
        { op: 'stun', target: 'hit', dur: 0.8 },
      ]),
      active('brakka_b', 'Iron Curtain', [
        { op: 'shield', target: 'allies', pct: 14 },
        { op: 'buff', target: 'allies', stat: 'def', pct: 20, dur: 5 },
      ]),
      passive('brakka_c', 'Reinforced Hull', { def: 15, dmgRed: 8, aura: { scope: 'front', hp: 8 } }),
    ],
    look: { skin: 1, face: 'square', hair: 'bun', hairColor: HAIR.red, hat: 'tanker', hatColor: '#4d5a2c', eyes: 'narrow', eyeColor: '#3a6a3a', brows: 'thick', mouth: 'flat', extra: ['scar', 'lashes'] },
  }),
  hero({
    id: 'magnus',
    name: 'Magnus Harrow',
    callsign: 'Breaker',
    type: 'tank',
    rarity: 'UR',
    role: 'attack',
    bio: 'Believes every problem is a wall, and every wall is temporary.',
    skills: [
      auto('magnus_a', 'Twin Bore Shot', 3, [{ op: 'dmg', target: 'front', count: 2, mult: 1.5 }]),
      active('magnus_b', 'Earthsplitter', [
        { op: 'dmg', target: 'all', mult: 1.7 },
        { op: 'debuff', target: 'hit', stat: 'def', pct: 20, dur: 5 },
      ]),
      passive('magnus_c', 'Siege Doctrine', { atk: 18, rage: 20 }),
    ],
    look: { skin: 3, face: 'square', hair: 'buzz', hairColor: HAIR.black, hat: 'none', eyes: 'narrow', brows: 'angry', mouth: 'grin', beard: 'full', extra: ['cigar'] },
  }),
  hero({
    id: 'dace',
    name: 'Dace Molina',
    callsign: 'Anvil',
    type: 'tank',
    rarity: 'SSR',
    role: 'defense',
    bio: 'Former demolition foreman. Now demolishes whatever walks toward the gate.',
    skills: [
      auto('dace_a', 'Ram Charge', 4, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.4 },
        { op: 'stun', target: 'hit', dur: 1 },
      ]),
      active('dace_b', 'Hold the Line', [
        { op: 'shield', target: 'self', pct: 30 },
        { op: 'buff', target: 'frontAllies', stat: 'def', pct: 25, dur: 6 },
      ]),
      passive('dace_c', 'Thick Skin', { hp: 15, thorns: 10 }),
    ],
    look: { skin: 2, face: 'round', hair: 'short', hairColor: HAIR.brown, hat: 'helmet', hatColor: '#5b6a38', eyes: 'normal', eyeColor: '#5a3a1a', brows: 'thick', mouth: 'smile', beard: 'mustache' },
  }),
  hero({
    id: 'rhea',
    name: 'Rhea Okonkwo',
    callsign: 'Longshot',
    type: 'tank',
    rarity: 'SSR',
    role: 'attack',
    bio: 'Scored a hit at four kilometres in a sandstorm. Still says it was luck.',
    skills: [
      auto('rhea_a', 'Sabot Lance', 3, [{ op: 'dmg', target: 'back', count: 1, mult: 1.7 }]),
      active('rhea_b', 'Rolling Thunder', [{ op: 'dmg', target: 'random', count: 3, mult: 1.6 }]),
      passive('rhea_c', 'Steady Aim', { crit: 12, atk: 10 }),
    ],
    look: { skin: 4, face: 'heart', hair: 'braids', hairColor: HAIR.black, hat: 'goggles', hatColor: '#c8a040', eyes: 'normal', eyeColor: '#3a2210', brows: 'raised', mouth: 'smirk', extra: ['earring', 'lashes'] },
  }),
  hero({
    id: 'tobias',
    name: 'Tobias Venn',
    callsign: 'Wrench',
    type: 'tank',
    rarity: 'SSR',
    role: 'support',
    bio: 'Can rebuild a gearbox from scrap and a strong opinion.',
    skills: [
      auto('tobias_a', 'Patch Job', 3, [{ op: 'heal', target: 'lowestAlly', count: 1, mult: 1.3 }]),
      active('tobias_b', 'Field Overhaul', [
        { op: 'heal', target: 'allies', mult: 0.9 },
        { op: 'buff', target: 'allies', stat: 'atk', pct: 12, dur: 5 },
      ]),
      passive('tobias_c', 'Spare Parts', { hp: 10, aura: { scope: 'tank', def: 6 } }),
    ],
    look: { skin: 0, face: 'long', hair: 'curly', hairColor: HAIR.chestnut, hat: 'bandana', hatColor: '#c0392b', eyes: 'wide', eyeColor: '#3a6aa0', brows: 'raised', mouth: 'open', extra: ['freckles'] },
  }),
  hero({
    id: 'pike',
    name: 'Pike Lanner',
    callsign: 'Doorstop',
    type: 'tank',
    rarity: 'SR',
    role: 'defense',
    bio: 'First in, last out, and loudest on the radio.',
    skills: [
      auto('pike_a', 'Shoulder Check', 4, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.3 },
        { op: 'debuff', target: 'hit', stat: 'atk', pct: 10, dur: 4 },
      ]),
      active('pike_b', 'Brace!', [
        { op: 'shield', target: 'self', pct: 25 },
        { op: 'buff', target: 'self', stat: 'def', pct: 30, dur: 5 },
      ]),
      passive('pike_c', 'Stubborn', { def: 10, dmgRed: 5 }),
    ],
    look: { skin: 1, face: 'square', hair: 'short', hairColor: HAIR.blond, hat: 'helmet', hatColor: '#6a7a40', eyes: 'normal', eyeColor: '#4a6a8a', brows: 'flat', mouth: 'grin', beard: 'stubble' },
  }),
  hero({
    id: 'juno',
    name: 'Juno Barros',
    callsign: 'Spark',
    type: 'tank',
    rarity: 'SR',
    role: 'attack',
    bio: 'Paints a tally mark on her barrel for every horde. She is running out of barrel.',
    skills: [
      auto('juno_a', 'Hot Shell', 3, [{ op: 'dmg', target: 'front', count: 1, mult: 1.6 }]),
      active('juno_b', 'Scatter Volley', [{ op: 'dmg', target: 'random', count: 3, mult: 1.3 }]),
      passive('juno_c', 'Eager Trigger', { haste: 10, atk: 6 }),
    ],
    look: { skin: 2, face: 'oval', hair: 'ponytail', hairColor: HAIR.brown, hat: 'cap', hatColor: '#55653a', eyes: 'wink', eyeColor: '#3a2a1a', brows: 'raised', mouth: 'grin', extra: ['blush', 'lashes'] },
  }),
  hero({
    id: 'ostrov',
    name: 'Ostrov Kade',
    callsign: 'Padre',
    type: 'tank',
    rarity: 'SR',
    role: 'support',
    bio: 'Quiet radio operator who hums hymns over the static. The crew swears it helps.',
    skills: [
      auto('ostrov_a', 'Signal Flare', 3, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.0 },
        { op: 'debuff', target: 'hit', stat: 'def', pct: 12, dur: 4 },
      ]),
      active('ostrov_b', 'Rally Call', [
        { op: 'buff', target: 'allies', stat: 'atk', pct: 15, dur: 6 },
        { op: 'heal', target: 'allies', mult: 0.5 },
      ]),
      passive('ostrov_c', 'Steady Voice', { energy: 20, aura: { scope: 'all', atk: 4 } }),
    ],
    look: { skin: 1, face: 'long', hair: 'sidepart', hairColor: HAIR.grey, hat: 'headset', hatColor: '#333333', eyes: 'narrow', eyeColor: '#5a5a5a', brows: 'flat', mouth: 'smile', beard: 'goatee' },
  }),

  // =============================== AIRCRAFT ===============================
  hero({
    id: 'sable',
    name: 'Sable Quinn',
    callsign: 'Nightjar',
    type: 'aircraft',
    rarity: 'UR',
    role: 'attack',
    bio: 'Flies with the lights off and the music up.',
    skills: [
      auto('sable_a', 'Strafing Run', 3, [{ op: 'dmg', target: 'front', count: 2, mult: 1.3 }]),
      active('sable_b', 'Death From Above', [
        { op: 'dmg', target: 'lowest', count: 1, mult: 3.0 },
        { op: 'dmg', target: 'all', mult: 0.7 },
      ]),
      passive('sable_c', 'Ace Instinct', { crit: 15, haste: 10, atk: 10 }),
    ],
    look: { skin: 0, face: 'heart', hair: 'bob', hairColor: HAIR.platinum, hat: 'pilot', hatColor: '#2a2e38', eyes: 'shades', brows: 'angry', mouth: 'smirk', extra: ['mole', 'lashes'] },
  }),
  hero({
    id: 'aurelio',
    name: 'Aurelio Fenn',
    callsign: 'Halo',
    type: 'aircraft',
    rarity: 'UR',
    role: 'support',
    bio: 'Medevac pilot. Has never once left anyone behind, and he counts.',
    skills: [
      auto('aurelio_a', 'Med Drop', 3, [{ op: 'heal', target: 'lowestAlly', count: 2, mult: 1.1 }]),
      active('aurelio_b', 'Guardian Wing', [
        { op: 'heal', target: 'allies', mult: 1.3 },
        { op: 'shield', target: 'allies', pct: 8 },
      ]),
      passive('aurelio_c', 'Air Cover', { hp: 12, aura: { scope: 'aircraft', atk: 8, hp: 5 } }),
    ],
    look: { skin: 3, face: 'oval', hair: 'swept', hairColor: HAIR.black, hat: 'headset', hatColor: '#e8e8e8', eyes: 'normal', eyeColor: '#2a1a0a', brows: 'raised', mouth: 'smile', beard: 'stubble' },
  }),
  hero({
    id: 'wren',
    name: 'Wren Hollis',
    callsign: 'Kite',
    type: 'aircraft',
    rarity: 'SSR',
    role: 'attack',
    bio: 'Youngest pilot in the squadron. Oldest callsign joke in the book.',
    skills: [
      auto('wren_a', 'Rocket Pods', 3, [{ op: 'dmg', target: 'random', count: 2, mult: 1.3 }]),
      active('wren_b', 'Dive Bomb', [{ op: 'dmg', target: 'back', count: 3, mult: 1.8 }]),
      passive('wren_c', 'Tailwind', { haste: 15 }),
    ],
    look: { skin: 1, face: 'round', hair: 'short', hairColor: HAIR.blue, hat: 'goggles', hatColor: '#8a5a2a', eyes: 'wide', eyeColor: '#2a7ac0', brows: 'raised', mouth: 'grin', extra: ['freckles', 'bandage'] },
  }),
  hero({
    id: 'idris',
    name: 'Idris Calloway',
    callsign: 'Canopy',
    type: 'aircraft',
    rarity: 'SSR',
    role: 'defense',
    bio: 'Flies a gunship with more armour than sense. Likes it that way.',
    skills: [
      auto('idris_a', 'Suppressing Fire', 3, [
        { op: 'dmg', target: 'front', count: 2, mult: 0.9 },
        { op: 'debuff', target: 'hit', stat: 'atk', pct: 12, dur: 4 },
      ]),
      active('idris_b', 'Flare Screen', [
        { op: 'shield', target: 'allies', pct: 10 },
        { op: 'buff', target: 'frontAllies', stat: 'def', pct: 15, dur: 5 },
      ]),
      passive('idris_c', 'Armored Cockpit', { hp: 15, def: 10 }),
    ],
    look: { skin: 5, face: 'square', hair: 'bald', hairColor: HAIR.black, hat: 'pilot', hatColor: '#4a5a6a', eyes: 'normal', eyeColor: '#1a1a1a', brows: 'thick', mouth: 'flat', beard: 'full' },
  }),
  hero({
    id: 'mei',
    name: 'Mei Tashiro',
    callsign: 'Lantern',
    type: 'aircraft',
    rarity: 'SSR',
    role: 'support',
    bio: 'Recon specialist who maps a whole city from the sky before breakfast.',
    skills: [
      auto('mei_a', 'Target Paint', 3, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.0 },
        { op: 'debuff', target: 'hit', stat: 'vuln', pct: 15, dur: 5 },
      ]),
      active('mei_b', 'Recon Sweep', [
        { op: 'debuff', target: 'all', stat: 'def', pct: 18, dur: 6 },
        { op: 'energy', target: 'allies', amount: 25 },
      ]),
      passive('mei_c', 'Overwatch', { crit: 8, aura: { scope: 'all', atk: 5 } }),
    ],
    look: { skin: 0, face: 'oval', hair: 'long', hairColor: HAIR.black, hat: 'headset', hatColor: '#d04040', eyes: 'visor', eyeColor: '#40e0ff', brows: 'flat', mouth: 'smile', extra: ['lashes'] },
  }),
  hero({
    id: 'lark',
    name: 'Lark Denholm',
    callsign: 'Buzz',
    type: 'aircraft',
    rarity: 'SR',
    role: 'attack',
    bio: 'Talks to her plane. Claims the plane talks back.',
    skills: [
      auto('lark_a', 'Chaingun Burst', 3, [{ op: 'dmg', target: 'front', count: 1, mult: 1.5 }]),
      active('lark_b', 'Low Pass', [{ op: 'dmg', target: 'front', count: 2, mult: 1.8 }]),
      passive('lark_c', 'Hotshot', { crit: 10 }),
    ],
    look: { skin: 1, face: 'heart', hair: 'ponytail', hairColor: HAIR.red, hat: 'pilot', hatColor: '#6a7a5a', eyes: 'normal', eyeColor: '#3a8a4a', brows: 'raised', mouth: 'open', extra: ['freckles', 'lashes'] },
  }),
  hero({
    id: 'bram',
    name: 'Bram Oduya',
    callsign: 'Umbrella',
    type: 'aircraft',
    rarity: 'SR',
    role: 'defense',
    bio: 'Big, calm, and always parked exactly where the trouble is.',
    skills: [
      auto('bram_a', 'Rotor Wash', 4, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.1 },
        { op: 'stun', target: 'hit', dur: 0.6 },
      ]),
      active('bram_b', 'Iron Umbrella', [
        { op: 'shield', target: 'allies', pct: 8 },
        { op: 'buff', target: 'self', stat: 'def', pct: 20, dur: 5 },
      ]),
      passive('bram_c', 'Sturdy Frame', { hp: 12 }),
    ],
    look: { skin: 4, face: 'round', hair: 'buzz', hairColor: HAIR.black, hat: 'cap', hatColor: '#34507a', eyes: 'normal', eyeColor: '#2a1a0a', brows: 'thick', mouth: 'smile', beard: 'full' },
  }),
  hero({
    id: 'poppy',
    name: 'Poppy Vance',
    callsign: 'Sprocket',
    type: 'aircraft',
    rarity: 'SR',
    role: 'support',
    bio: 'Mechanic turned pilot. Still keeps a wrench in the cockpit, just in case.',
    skills: [
      auto('poppy_a', 'Repair Drone', 3, [{ op: 'heal', target: 'lowestAlly', count: 1, mult: 1.1 }]),
      active('poppy_b', 'Tune-Up', [
        { op: 'heal', target: 'allies', mult: 0.7 },
        { op: 'buff', target: 'allies', stat: 'haste', pct: 12, dur: 5 },
      ]),
      passive('poppy_c', 'Tinkerer', { energy: 15, aura: { scope: 'aircraft', def: 6 } }),
    ],
    look: { skin: 2, face: 'round', hair: 'bun', hairColor: HAIR.pink, hat: 'goggles', hatColor: '#3a8a8a', eyes: 'wide', eyeColor: '#5a3a1a', brows: 'raised', mouth: 'grin', extra: ['blush', 'lashes'] },
  }),

  // ================================ MISSILE ===============================
  hero({
    id: 'vesna',
    name: 'Vesna Kroll',
    callsign: 'Tempest',
    type: 'missile',
    rarity: 'UR',
    role: 'attack',
    bio: 'Launches first, calculates later, somehow never misses.',
    skills: [
      auto('vesna_a', 'Cluster Warhead', 3, [{ op: 'dmg', target: 'random', count: 3, mult: 1.2 }]),
      active('vesna_b', 'Firestorm', [
        { op: 'dmg', target: 'all', mult: 2.0 },
        { op: 'debuff', target: 'hit', stat: 'def', pct: 15, dur: 4 },
      ]),
      passive('vesna_c', 'Warhead Specialist', { atk: 18, vsZombie: 15 }),
    ],
    look: { skin: 0, face: 'long', hair: 'long', hairColor: HAIR.white, hat: 'beret', hatColor: '#8a2a2a', eyes: 'narrow', eyeColor: '#6a2ab0', brows: 'angry', mouth: 'smirk', extra: ['paint', 'lashes'] },
  }),
  hero({
    id: 'castor',
    name: 'Castor Ambe',
    callsign: 'Aegis',
    type: 'missile',
    rarity: 'UR',
    role: 'defense',
    bio: 'Runs the interceptor battery. Nothing gets through twice.',
    skills: [
      auto('castor_a', 'Flak Burst', 3, [
        { op: 'dmg', target: 'front', count: 2, mult: 1.0 },
        { op: 'debuff', target: 'hit', stat: 'atk', pct: 10, dur: 4 },
      ]),
      active('castor_b', 'Interceptor Grid', [
        { op: 'shield', target: 'allies', pct: 12 },
        { op: 'buff', target: 'allies', stat: 'guard', pct: 15, dur: 5 },
      ]),
      passive('castor_c', 'Bastion', { def: 18, hp: 10, dmgRed: 6 }),
    ],
    look: { skin: 5, face: 'long', hair: 'mohawk', hairColor: HAIR.teal, hat: 'none', eyes: 'shades', brows: 'flat', mouth: 'flat', beard: 'goatee', extra: ['earring'] },
  }),
  hero({
    id: 'nadia',
    name: 'Nadia Ferro',
    callsign: 'Comet',
    type: 'missile',
    rarity: 'SSR',
    role: 'attack',
    bio: 'Keeps a notebook of every crater she has made, sorted by size.',
    skills: [
      auto('nadia_a', 'Twin Rockets', 3, [{ op: 'dmg', target: 'front', count: 2, mult: 1.3 }]),
      active('nadia_b', 'Arc Strike', [{ op: 'dmg', target: 'back', count: 3, mult: 1.9 }]),
      passive('nadia_c', 'Blast Radius', { atk: 12 }),
    ],
    look: { skin: 2, face: 'heart', hair: 'sidepart', hairColor: HAIR.black, hat: 'boonie', hatColor: '#8a7a50', eyes: 'normal', eyeColor: '#4a2a1a', brows: 'angry', mouth: 'smirk', extra: ['lashes', 'mole'] },
  }),
  hero({
    id: 'gideon',
    name: 'Gideon Sorrel',
    callsign: 'Professor',
    type: 'missile',
    rarity: 'SSR',
    role: 'support',
    bio: 'Ballistics lecturer who swapped chalk for coordinates.',
    skills: [
      auto('gideon_a', 'Spotter Round', 3, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.0 },
        { op: 'debuff', target: 'hit', stat: 'vuln', pct: 12, dur: 5 },
      ]),
      active('gideon_b', 'Firing Solution', [
        { op: 'buff', target: 'allies', stat: 'atk', pct: 20, dur: 6 },
        { op: 'energy', target: 'allies', amount: 20 },
      ]),
      passive('gideon_c', 'Calculated', { crit: 6, aura: { scope: 'missile', atk: 8 } }),
    ],
    look: { skin: 1, face: 'oval', hair: 'swept', hairColor: HAIR.grey, hat: 'none', eyes: 'normal', eyeColor: '#4a6a8a', brows: 'raised', mouth: 'smile', beard: 'mustache', extra: ['bandage'] },
  }),
  hero({
    id: 'yusuf',
    name: 'Yusuf Brandt',
    callsign: 'Rampart',
    type: 'missile',
    rarity: 'SSR',
    role: 'defense',
    bio: 'Parks his launcher like a castle wall and dares anything to climb it.',
    skills: [
      auto('yusuf_a', 'Shrapnel Wall', 3, [{ op: 'dmg', target: 'front', count: 2, mult: 0.95 }]),
      active('yusuf_b', 'Hardpoint', [
        { op: 'shield', target: 'self', pct: 30 },
        { op: 'buff', target: 'allies', stat: 'guard', pct: 10, dur: 6 },
      ]),
      passive('yusuf_c', 'Entrenched', { hp: 18, thorns: 12 }),
    ],
    look: { skin: 3, face: 'square', hair: 'short', hairColor: HAIR.black, hat: 'helmet', hatColor: '#8a6a44', eyes: 'narrow', eyeColor: '#2a1a0a', brows: 'thick', mouth: 'frown', beard: 'full' },
  }),
  hero({
    id: 'tamsin',
    name: 'Tamsin Reyes',
    callsign: 'Flint',
    type: 'missile',
    rarity: 'SR',
    role: 'attack',
    bio: 'Loads her own rockets. Will not let anyone else touch them.',
    skills: [
      auto('tamsin_a', 'Hot Rocket', 3, [{ op: 'dmg', target: 'front', count: 1, mult: 1.7 }]),
      active('tamsin_b', 'Salvo', [{ op: 'dmg', target: 'random', count: 3, mult: 1.4 }]),
      passive('tamsin_c', 'Powder Hands', { atk: 8 }),
    ],
    look: { skin: 3, face: 'oval', hair: 'curly', hairColor: HAIR.brown, hat: 'bandana', hatColor: '#d08a20', eyes: 'normal', eyeColor: '#3a2a1a', brows: 'angry', mouth: 'grin', extra: ['lashes', 'paint'] },
  }),
  hero({
    id: 'otto',
    name: 'Otto Grieve',
    callsign: 'Tick',
    type: 'missile',
    rarity: 'SR',
    role: 'support',
    bio: 'Old artillery hand. Can judge the range by the sound of the wind.',
    skills: [
      auto('otto_a', 'Smoke Shell', 3, [
        { op: 'dmg', target: 'front', count: 1, mult: 0.9 },
        { op: 'debuff', target: 'hit', stat: 'atk', pct: 12, dur: 4 },
      ]),
      active('otto_b', 'Resupply', [
        { op: 'heal', target: 'allies', mult: 0.6 },
        { op: 'energy', target: 'allies', amount: 20 },
      ]),
      passive('otto_c', 'Veteran', { aura: { scope: 'all', def: 5 } }),
    ],
    look: { skin: 1, face: 'long', hair: 'bald', hairColor: HAIR.white, hat: 'cap', hatColor: '#7a5a3a', eyes: 'patch', eyeColor: '#4a4a4a', brows: 'thick', mouth: 'flat', beard: 'mustache', extra: ['scar'] },
  }),
  hero({
    id: 'zola',
    name: 'Zola Mbeki',
    callsign: 'Brick',
    type: 'missile',
    rarity: 'SR',
    role: 'defense',
    bio: 'Built the outpost’s first wall by hand. Now she is the wall.',
    skills: [
      auto('zola_a', 'Counterbattery', 4, [
        { op: 'dmg', target: 'front', count: 1, mult: 1.2 },
        { op: 'stun', target: 'hit', dur: 0.5 },
      ]),
      active('zola_b', 'Dig In', [
        { op: 'shield', target: 'self', pct: 28 },
        { op: 'heal', target: 'self', mult: 0.8 },
      ]),
      passive('zola_c', 'Sandbagged', { def: 12, hp: 6 }),
    ],
    look: { skin: 5, face: 'round', hair: 'braids', hairColor: HAIR.black, hat: 'helmet', hatColor: '#9a7a4a', eyes: 'normal', eyeColor: '#2a1a0a', brows: 'flat', mouth: 'smile', extra: ['lashes', 'earring'] },
  }),
];

export const HERO_BY_ID: Record<string, HeroDef> = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export function heroDef(id: string): HeroDef | undefined {
  return HERO_BY_ID[id];
}

/** Starter heroes granted on a new game (all Tank so the first mono-type squad bonus works). */
export const STARTER_HEROES = ['dace', 'pike', 'juno', 'ostrov'];
/** Squad 1 at game start: slots 0-1 front, 2-4 back. */
export const STARTER_SQUAD: (string | null)[] = ['dace', 'pike', 'juno', 'ostrov', null];
/** The very first recruitment always yields this hero (completes a 5-Tank squad). */
export const SCRIPTED_FIRST_RECRUIT = 'rhea';

export const TYPE_LABEL: Record<HeroType, string> = { tank: 'Tank', aircraft: 'Aircraft', missile: 'Missile' };
export const ROLE_LABEL: Record<HeroRole, string> = { attack: 'Attack', defense: 'Defense', support: 'Support' };
export const RARITY_ORDER: Record<Rarity, number> = { SR: 0, SSR: 1, UR: 2 };

// ---------------------------------------------------------------------------------------------
// Skill scaling & descriptions
// ---------------------------------------------------------------------------------------------

/** Multiplier applied to a skill's numbers at a given skill level (durations/counts don't scale). */
export function skillScale(level: number): number {
  return 1 + 0.06 * (Math.max(1, level) - 1);
}

const STAT_WORD: Record<BuffStat, string> = {
  atk: 'ATK',
  def: 'DEF',
  haste: 'attack speed',
  crit: 'crit chance',
  guard: 'damage taken',
  vuln: 'damage taken',
};

function targetText(t: EnemyTarget, count?: number): string {
  const n = count ?? 1;
  const plural = n > 1;
  switch (t) {
    case 'front':
      return plural ? `${n} enemies (front row first)` : 'the front-row enemy';
    case 'back':
      return plural ? `${n} back-row enemies` : 'a back-row enemy';
    case 'lowest':
      return plural ? `the ${n} weakest enemies` : 'the weakest enemy';
    case 'strongest':
      return 'the strongest enemy';
    case 'random':
      return plural ? `${n} random enemies` : 'a random enemy';
    case 'all':
      return 'ALL enemies';
    case 'hit':
      return 'them';
  }
}

function allyText(t: AllyTarget, count?: number): string {
  switch (t) {
    case 'self':
      return 'self';
    case 'allies':
      return 'all allies';
    case 'lowestAlly':
      return (count ?? 1) > 1 ? `the ${count} most injured allies` : 'the most injured ally';
    case 'frontAllies':
      return 'front-row allies';
    case 'backAllies':
      return 'back-row allies';
  }
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const pctStr = (v: number) => `${Math.round(v)}%`;

export function describeEffect(e: SkillEffect, level: number): string {
  const k = skillScale(level);
  switch (e.op) {
    case 'dmg':
      return `Deals ${pctStr(e.mult * 100 * k)} ATK damage to ${targetText(e.target, e.count)}`;
    case 'heal':
      return `Heals ${allyText(e.target, e.count)} for ${pctStr(e.mult * 100 * k)} ATK`;
    case 'shield':
      return `Shields ${allyText(e.target, e.count)} for ${pctStr(e.pct * k)} of own max HP (${e.dur ?? 8}s)`;
    case 'buff':
      return e.stat === 'guard'
        ? `${allyText(e.target, e.count)[0].toUpperCase() + allyText(e.target, e.count).slice(1)} take ${pctStr(e.pct * k)} less damage for ${e.dur}s`
        : `Raises ${STAT_WORD[e.stat]} of ${allyText(e.target, e.count)} by ${pctStr(e.pct * k)} for ${e.dur}s`;
    case 'debuff':
      return e.stat === 'vuln'
        ? `${e.target === 'hit' ? 'They take' : targetText(e.target, e.count) + ' take'} ${pctStr(e.pct * k)} more damage for ${e.dur}s`
        : `Lowers ${STAT_WORD[e.stat]} of ${targetText(e.target, e.count)} by ${pctStr(e.pct * k)} for ${e.dur}s`;
    case 'stun':
      return `Stuns ${targetText(e.target, e.count)} for ${r1(e.dur)}s`;
    case 'energy':
      return `Grants ${allyText(e.target, e.count)} +${Math.round(e.amount * k)} energy`;
  }
}

export function describePassive(p: PassiveDef, level: number): string[] {
  const k = skillScale(level);
  const out: string[] = [];
  const s = (v: number) => pctStr(v * k);
  if (p.atk) out.push(`ATK +${s(p.atk)}`);
  if (p.hp) out.push(`HP +${s(p.hp)}`);
  if (p.def) out.push(`DEF +${s(p.def)}`);
  if (p.crit) out.push(`Crit chance +${s(p.crit)}`);
  if (p.dmgRed) out.push(`Takes ${s(p.dmgRed)} less damage`);
  if (p.haste) out.push(`Attack speed +${s(p.haste)}`);
  if (p.vsZombie) out.push(`+${s(p.vsZombie)} damage vs zombies`);
  if (p.lifesteal) out.push(`Heals for ${s(p.lifesteal)} of damage dealt`);
  if (p.energy) out.push(`Starts battle with ${Math.round(p.energy * k)} energy`);
  if (p.rage) out.push(`+${s(p.rage)} damage while below 50% HP`);
  if (p.thorns) out.push(`Reflects ${s(p.thorns)} of damage taken`);
  if (p.aura) {
    const a = p.aura;
    const who =
      a.scope === 'all' ? 'all squad members' : a.scope === 'front' ? 'front-row allies' : a.scope === 'back' ? 'back-row allies' : `${TYPE_LABEL[a.scope]} allies`;
    const parts: string[] = [];
    if (a.atk) parts.push(`ATK +${s(a.atk)}`);
    if (a.hp) parts.push(`HP +${s(a.hp)}`);
    if (a.def) parts.push(`DEF +${s(a.def)}`);
    out.push(`Aura: ${parts.join(', ')} for ${who}`);
  }
  return out;
}

export function describeSkill(sk: SkillDef, level: number): string[] {
  if (sk.kind === 'passive') return describePassive(sk.passive ?? {}, level);
  const lines = (sk.effects ?? []).map((e) => describeEffect(e, level));
  return lines;
}

export function skillKindLabel(sk: SkillDef): string {
  if (sk.kind === 'auto') return `Auto · every ${sk.every ?? 3} attacks`;
  if (sk.kind === 'active') return `Tactic · ${ACTIVE_ENERGY} energy`;
  return 'Passive';
}
