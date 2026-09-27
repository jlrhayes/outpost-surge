// OWNER: heroes agent. Deterministic auto-battle simulation between two formations.
// CONTRACT: simulateBattle(), BattleResult, BattleEvent and startBattle() are used by the world map and campaign.
import type { Combatant, HeroType, Reward } from '../core/types';
import { goTo } from '../core/nav';
import { mulberry32 } from '../core/rng';
import { ACTIVE_ENERGY, ATTACK_INTERVAL, heroDef, skillScale, type BuffStat, type SkillEffect, type EnemyTarget, type AllyTarget } from '../data/heroes';
import type { BattleUnit } from './heroes';

export type BattleEvent =
  | { t: number; kind: 'attack'; from: string; to: string; dmg: number; crit?: boolean; hp?: number; sh?: number }
  | {
      t: number;
      kind: 'skill';
      from: string;
      skillId: string;
      targets: string[];
      dmg: number[];
      /** Additive fields (optional): display name, whether it is the charged active skill, per-target crit/hp-after/shield-absorbed. */
      name?: string;
      active?: boolean;
      crit?: boolean[];
      hp?: number[];
      sh?: number[];
    }
  | { t: number; kind: 'heal'; from: string; to: string; amount: number; hp?: number }
  | { t: number; kind: 'death'; uid: string }
  | { t: number; kind: 'shield'; from: string; to: string; amount: number; total: number }
  | { t: number; kind: 'buff'; from: string; to: string[]; stat: BuffStat; pct: number; dur: number; debuff?: boolean }
  | { t: number; kind: 'stun'; from: string; to: string[]; dur: number }
  | { t: number; kind: 'energy'; uid: string; value: number }
  | { t: number; kind: 'reflect'; from: string; to: string; dmg: number; hp: number };

export interface BattleResult {
  winner: 'A' | 'B';
  /** Time-ordered events (t in seconds) for playback in the battle scene. */
  events: BattleEvent[];
  /** Final HP of every combatant by uid. */
  finalHp: Record<string, number>;
  duration: number;
  /** Fraction (0-1) of side A's total HP lost; used for troop losses (wounded). */
  lossRatioA: number;
  /** Additive: effective max HP per uid, damage dealt/healing done per uid, and whether the battle timed out. */
  maxHp?: Record<string, number>;
  dealt?: Record<string, number>;
  healed?: Record<string, number>;
  timeout?: boolean;
}

export const BATTLE_DT = 0.1;
/** Energy: heroes start with some, gain per attack and per hit taken; the tactic skill fires at 100. */
export const START_ENERGY = 25;
export const ENERGY_PER_ATTACK = 24;
export const ENERGY_PER_HIT_TAKEN = 5;
export const BATTLE_MAX_TIME = 60;

/** tank > missile > aircraft > tank */
export const COUNTERS: Record<HeroType, HeroType> = { tank: 'missile', missile: 'aircraft', aircraft: 'tank' };
export function counters(a: string, b: string): boolean {
  return (COUNTERS as Record<string, string>)[a] === b;
}
/** The hero type that counters `t` (weakTo('tank') === 'aircraft'). */
export function weakTo(t: HeroType): HeroType {
  return (Object.keys(COUNTERS) as HeroType[]).find((k) => COUNTERS[k] === t)!;
}
/**
 * Type used for the counter triangle: a hero's type, or the type carried by a typed zombie
 * (bosses/elites, see `ctype` on BattleUnit). Plain zombies return null (no counter either way).
 */
export function counterType(c: Combatant): HeroType | null {
  if (c.type !== 'zombie') return c.type;
  return (c as BattleUnit).ctype ?? null;
}

// ---------------------------------------------------------------------------------------------
// Zombie abilities (enemy units with type 'zombie'). Keyed by Combatant.skillId, or derived from model.
// ---------------------------------------------------------------------------------------------
export interface ZombieAbility {
  name: string;
  every: number;
  interval: number;
  effects: SkillEffect[];
}
export const ZOMBIE_ABILITIES: Record<string, ZombieAbility> = {
  z_bite: { name: 'Frenzied Bite', every: 4, interval: 1.4, effects: [{ op: 'dmg', target: 'front', count: 1, mult: 1.5 }] },
  z_pounce: { name: 'Pounce', every: 3, interval: 0.95, effects: [{ op: 'dmg', target: 'back', count: 1, mult: 1.4 }] },
  z_smash: { name: 'Crushing Blow', every: 3, interval: 2.0, effects: [{ op: 'dmg', target: 'front', count: 2, mult: 1.2 }] },
  z_spit: {
    name: 'Acid Spit',
    every: 3,
    interval: 1.7,
    effects: [
      { op: 'dmg', target: 'random', count: 2, mult: 1.0 },
      { op: 'debuff', target: 'hit', stat: 'def', pct: 15, dur: 4 },
    ],
  },
  z_boss: {
    name: 'Tremor Slam',
    every: 3,
    interval: 2.2,
    effects: [
      { op: 'dmg', target: 'all', mult: 0.75 },
      { op: 'stun', target: 'front', count: 2, dur: 1 },
    ],
  },
};

export function zombieAbilityFor(c: Combatant): ZombieAbility {
  if (c.skillId && ZOMBIE_ABILITIES[c.skillId]) return ZOMBIE_ABILITIES[c.skillId];
  const m = c.model.toLowerCase();
  if (m.includes('boss')) return ZOMBIE_ABILITIES.z_boss;
  if (m.includes('brute')) return ZOMBIE_ABILITIES.z_smash;
  if (m.includes('runner')) return ZOMBIE_ABILITIES.z_pounce;
  if (m.includes('spit')) return ZOMBIE_ABILITIES.z_spit;
  return ZOMBIE_ABILITIES.z_bite;
}

// ---------------------------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------------------------
interface Buff {
  stat: BuffStat;
  pct: number;
  until: number;
  debuff: boolean;
}

interface SimSkill {
  id: string;
  name: string;
  every: number;
  effects: SkillEffect[];
  level: number;
}

interface U {
  c: Combatant;
  uid: string;
  side: 'A' | 'B';
  slot: number;
  lane: number;
  type: string;
  /** Counter-triangle type ('' = none). Differs from `type` for typed zombies. */
  ctype: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  interval: number;
  nextAt: number;
  attacks: number;
  energy: number;
  shield: number;
  shieldUntil: number;
  buffs: Buff[];
  stunUntil: number;
  auto?: SimSkill;
  active?: SimSkill;
  crit: number;
  dmgRed: number;
  haste: number;
  vsZombie: number;
  lifesteal: number;
  rage: number;
  thorns: number;
  alive: boolean;
  boss: boolean;
  enraged: boolean;
  dealt: number;
  healed: number;
}

const LANES = [-1, 1, -1.6, 0, 1.6];
const r2 = (v: number) => Math.round(v * 100) / 100;

function makeUnit(c: Combatant, rng: () => number): U {
  const x = c as BattleUnit;
  const u: U = {
    c,
    uid: c.uid,
    side: c.side,
    slot: c.slot,
    lane: LANES[c.slot] ?? 0,
    type: c.type,
    ctype: counterType(c) ?? '',
    hp: Math.max(1, Math.min(c.hp, c.maxHp)),
    maxHp: Math.max(1, c.maxHp),
    atk: Math.max(1, c.atk),
    def: Math.max(0, c.def),
    interval: 1.5,
    nextAt: 0,
    attacks: 0,
    energy: 0,
    shield: 0,
    shieldUntil: 0,
    buffs: [],
    stunUntil: 0,
    crit: 5,
    dmgRed: 0,
    haste: 0,
    vsZombie: 0,
    lifesteal: 0,
    rage: 0,
    thorns: 0,
    alive: c.hp > 0,
    boss: false,
    enraged: false,
    dealt: 0,
    healed: 0,
  };
  const def = c.heroId ? heroDef(c.heroId) : undefined;
  if (def && c.type !== 'zombie') {
    const lv = x.skillLv ?? [1, 1, 1];
    u.interval = ATTACK_INTERVAL[def.type];
    const [a, b, p] = def.skills;
    u.auto = { id: a.id, name: a.name, every: a.every ?? 3, effects: a.effects ?? [], level: lv[0] ?? 1 };
    u.active = { id: b.id, name: b.name, every: 0, effects: b.effects ?? [], level: lv[1] ?? 1 };
    const pv = p.passive ?? {};
    const k = skillScale(lv[2] ?? 1);
    u.crit = 5 + (pv.crit ?? 0) * k;
    u.dmgRed = (pv.dmgRed ?? 0) * k;
    u.haste = (pv.haste ?? 0) * k;
    u.vsZombie = (pv.vsZombie ?? 0) * k;
    u.lifesteal = (pv.lifesteal ?? 0) * k;
    u.rage = (pv.rage ?? 0) * k;
    u.thorns = (pv.thorns ?? 0) * k;
    u.energy = Math.min(ACTIVE_ENERGY - 1, START_ENERGY + (pv.energy ?? 0) * k);
  } else if (c.type === 'zombie') {
    const z = zombieAbilityFor(c);
    u.interval = z.interval;
    u.auto = { id: c.skillId ?? 'zombie', name: z.name, every: z.every, effects: z.effects, level: 1 };
    u.boss = z === ZOMBIE_ABILITIES.z_boss;
  } else {
    // Vehicle without a hero definition (e.g. generic enemy squad).
    u.interval = ATTACK_INTERVAL[c.type as HeroType] ?? 1.5;
  }
  // Stagger opening shots so the battle doesn't start with a single volley.
  u.nextAt = r2(0.3 + c.slot * 0.12 + (c.side === 'B' ? 0.25 : 0) + rng() * 0.3);
  return u;
}

/**
 * Runs a deterministic auto-battle. Side A attacks; if nobody wins within 60 s, A loses.
 * Combatants are not mutated.
 */
export function simulateBattle(a: Combatant[], b: Combatant[], seed = 1): BattleResult {
  const rng = mulberry32(seed || 1);
  const units = [...a.map((c) => ({ ...c, side: 'A' as const })), ...b.map((c) => ({ ...c, side: 'B' as const }))].map((c) =>
    makeUnit(c, rng),
  );
  const events: BattleEvent[] = [];
  const A = units.filter((u) => u.side === 'A');
  const B = units.filter((u) => u.side === 'B');
  const aliveOf = (side: 'A' | 'B') => (side === 'A' ? A : B).filter((u) => u.alive);
  const over = () => !A.some((u) => u.alive) || !B.some((u) => u.alive);

  for (const u of units) if (u.active && u.energy > 0) events.push({ t: 0, kind: 'energy', uid: u.uid, value: Math.round(u.energy) });

  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buffSum(u: U, stat: BuffStat, t: number): number {
    let v = 0;
    for (const b of u.buffs) if (b.stat === stat && b.until > t) v += b.debuff ? -b.pct : b.pct;
    return v;
  }
  const effAtk = (u: U, t: number) => u.atk * Math.max(0.3, 1 + buffSum(u, 'atk', t) / 100) * (u.enraged ? 1.3 : 1);
  const effDef = (u: U, t: number) => u.def * Math.max(0.2, 1 + buffSum(u, 'def', t) / 100);
  const hasteMult = (u: U, t: number) => Math.max(0.4, 1 + (u.haste + buffSum(u, 'haste', t)) / 100 + (u.enraged ? 0.25 : 0));

  function byLane(u: U, list: U[]): U[] {
    // Prefer the enemy in the same lane most of the time (focus fire), otherwise random.
    const s = shuffle(list);
    if (s.length > 1 && rng() < 0.7) s.sort((x, y) => Math.abs(x.lane - u.lane) - Math.abs(y.lane - u.lane));
    return s;
  }

  function pickEnemies(u: U, rule: EnemyTarget, count: number, lastHit: U[]): U[] {
    const foes = aliveOf(u.side === 'A' ? 'B' : 'A');
    if (!foes.length) return [];
    const front = foes.filter((f) => f.slot <= 1);
    const back = foes.filter((f) => f.slot > 1);
    switch (rule) {
      case 'hit':
        return lastHit.filter((x) => x.alive);
      case 'all':
        return foes;
      case 'front':
        return [...byLane(u, front), ...byLane(u, back)].slice(0, count);
      case 'back':
        return [...byLane(u, back), ...byLane(u, front)].slice(0, count);
      case 'lowest':
        return [...foes].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, count);
      case 'strongest':
        return [...foes].sort((x, y) => y.atk - x.atk).slice(0, count);
      case 'random':
        return shuffle([...foes]).slice(0, count);
    }
  }

  function pickAllies(u: U, rule: AllyTarget, count: number): U[] {
    const al = aliveOf(u.side);
    switch (rule) {
      case 'self':
        return u.alive ? [u] : [];
      case 'allies':
        return al;
      case 'lowestAlly':
        return [...al].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp).slice(0, count);
      case 'frontAllies': {
        const f = al.filter((x) => x.slot <= 1);
        return f.length ? f : al;
      }
      case 'backAllies': {
        const f = al.filter((x) => x.slot > 1);
        return f.length ? f : al;
      }
    }
  }

  function gainEnergy(u: U, n: number, t: number): void {
    if (!u.active || !u.alive) return;
    const before = u.energy;
    u.energy = Math.min(ACTIVE_ENERGY, u.energy + n);
    if (Math.round(u.energy) !== Math.round(before)) events.push({ t, kind: 'energy', uid: u.uid, value: Math.round(u.energy) });
  }

  function kill(u: U, t: number): void {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    u.shield = 0;
    events.push({ t, kind: 'death', uid: u.uid });
  }

  /** Applies one hit. Pushes secondary events (death/reflect) AFTER the caller's primary event. */
  function hit(src: U, tgt: U, mult: number, t: number): { dmg: number; crit: boolean; absorbed: number } {
    const atk = effAtk(src, t);
    const def = effDef(tgt, t);
    let d = atk * mult * (atk / (atk + def));
    if (counters(src.ctype, tgt.ctype)) d *= 1.2;
    if (counters(tgt.ctype, src.ctype)) d *= 0.8;
    const critChance = (src.crit + buffSum(src, 'crit', t)) / 100;
    const crit = rng() < critChance;
    if (crit) d *= 1.5;
    if (src.rage && src.hp < src.maxHp / 2) d *= 1 + src.rage / 100;
    if (tgt.type === 'zombie' && src.vsZombie) d *= 1 + src.vsZombie / 100;
    d *= 1 - buffSum(tgt, 'vuln', t) / 100; // vuln debuffs are stored negative
    d *= Math.max(0.25, 1 - (tgt.dmgRed + buffSum(tgt, 'guard', t)) / 100);
    d *= 0.94 + rng() * 0.12;
    const dmg = Math.max(1, Math.round(d));
    let absorbed = 0;
    if (tgt.shield > 0 && tgt.shieldUntil > t) {
      absorbed = Math.min(tgt.shield, dmg);
      tgt.shield -= absorbed;
    }
    tgt.hp -= dmg - absorbed;
    src.dealt += dmg;
    if (src.lifesteal && src.alive) {
      const add = Math.min(src.maxHp - src.hp, Math.round((dmg * src.lifesteal) / 100));
      if (add > 0) src.hp += add;
    }
    return { dmg, crit, absorbed };
  }

  function afterHit(src: U, tgt: U, dmg: number, t: number): void {
    if (tgt.hp <= 0) {
      kill(tgt, t);
    } else {
      gainEnergy(tgt, ENERGY_PER_HIT_TAKEN, t);
      if (tgt.boss && !tgt.enraged && tgt.hp < tgt.maxHp / 2) {
        tgt.enraged = true;
        events.push({ t, kind: 'buff', from: tgt.uid, to: [tgt.uid], stat: 'atk', pct: 30, dur: 99 });
      }
      if (tgt.thorns && src.alive) {
        const refl = Math.max(1, Math.round((dmg * tgt.thorns) / 100));
        src.hp -= refl;
        events.push({ t, kind: 'reflect', from: tgt.uid, to: src.uid, dmg: refl, hp: Math.max(0, Math.round(src.hp)) });
        if (src.hp <= 0) kill(src, t);
      }
    }
  }

  function basicAttack(u: U, t: number): void {
    const tg = pickEnemies(u, 'front', 1, [])[0];
    if (!tg) return;
    const ev = { t, kind: 'attack' as const, from: u.uid, to: tg.uid, dmg: 0, crit: false, hp: 0, sh: 0 };
    events.push(ev);
    const r = hit(u, tg, 1, t);
    ev.dmg = r.dmg;
    ev.crit = r.crit;
    ev.hp = Math.max(0, Math.round(tg.hp));
    ev.sh = r.absorbed;
    afterHit(u, tg, r.dmg, t);
  }

  function runSkill(u: U, sk: SimSkill, t: number, isActive: boolean): void {
    const k = u.c.type === 'zombie' ? 1 : skillScale(sk.level);
    const ev: Extract<BattleEvent, { kind: 'skill' }> = {
      t,
      kind: 'skill',
      from: u.uid,
      skillId: sk.id,
      name: sk.name,
      active: isActive,
      targets: [],
      dmg: [],
      crit: [],
      hp: [],
      sh: [],
    };
    events.push(ev);
    let lastHit: U[] = [];
    for (const e of sk.effects) {
      if (over()) break;
      switch (e.op) {
        case 'dmg': {
          const tg = pickEnemies(u, e.target, e.count ?? 1, lastHit);
          const results: { tgt: U; dmg: number }[] = [];
          for (const x of tg) {
            if (!x.alive) continue;
            const r = hit(u, x, e.mult * k, t);
            ev.targets.push(x.uid);
            ev.dmg.push(r.dmg);
            ev.crit!.push(r.crit);
            ev.hp!.push(Math.max(0, Math.round(x.hp)));
            ev.sh!.push(r.absorbed);
            results.push({ tgt: x, dmg: r.dmg });
          }
          for (const r of results) afterHit(u, r.tgt, r.dmg, t);
          lastHit = tg;
          break;
        }
        case 'heal': {
          const amount = e.mult * k * effAtk(u, t);
          for (const x of pickAllies(u, e.target, e.count ?? 1)) {
            const add = Math.round(Math.min(amount, x.maxHp - x.hp));
            x.hp += add;
            u.healed += add;
            events.push({ t, kind: 'heal', from: u.uid, to: x.uid, amount: Math.round(amount), hp: Math.round(x.hp) });
          }
          break;
        }
        case 'shield': {
          const amount = ((e.pct * k) / 100) * u.maxHp;
          for (const x of pickAllies(u, e.target, e.count ?? 1)) {
            x.shield = Math.min((x.shieldUntil > t ? x.shield : 0) + amount, x.maxHp * 0.6);
            x.shieldUntil = t + (e.dur ?? 8);
            events.push({ t, kind: 'shield', from: u.uid, to: x.uid, amount: Math.round(amount), total: Math.round(x.shield) });
          }
          break;
        }
        case 'buff': {
          const tg = pickAllies(u, e.target, e.count ?? 1);
          for (const x of tg) x.buffs.push({ stat: e.stat, pct: e.pct * k, until: t + e.dur, debuff: false });
          if (tg.length) events.push({ t, kind: 'buff', from: u.uid, to: tg.map((x) => x.uid), stat: e.stat, pct: Math.round(e.pct * k), dur: e.dur });
          break;
        }
        case 'debuff': {
          const tg = pickEnemies(u, e.target, e.count ?? 1, lastHit);
          for (const x of tg) x.buffs.push({ stat: e.stat, pct: e.pct * k, until: t + e.dur, debuff: true });
          if (tg.length)
            events.push({ t, kind: 'buff', from: u.uid, to: tg.map((x) => x.uid), stat: e.stat, pct: Math.round(e.pct * k), dur: e.dur, debuff: true });
          break;
        }
        case 'stun': {
          const tg = pickEnemies(u, e.target, e.count ?? 1, lastHit);
          for (const x of tg) x.stunUntil = Math.max(x.stunUntil, t + (x.boss ? e.dur / 2 : e.dur));
          if (tg.length) events.push({ t, kind: 'stun', from: u.uid, to: tg.map((x) => x.uid), dur: e.dur });
          break;
        }
        case 'energy': {
          for (const x of pickAllies(u, e.target, e.count ?? 1)) if (x !== u) gainEnergy(x, e.amount * k, t);
          break;
        }
      }
    }
  }

  function act(u: U, t: number): void {
    u.buffs = u.buffs.filter((b) => b.until > t);
    if (u.stunUntil > t) {
      u.nextAt = r2(u.stunUntil);
      return;
    }
    if (u.active && u.energy >= ACTIVE_ENERGY) {
      u.energy = 0;
      events.push({ t, kind: 'energy', uid: u.uid, value: 0 });
      runSkill(u, u.active, t, true);
    } else {
      u.attacks++;
      if (u.auto && u.auto.effects.length && u.attacks % u.auto.every === 0) runSkill(u, u.auto, t, false);
      else basicAttack(u, t);
      gainEnergy(u, ENERGY_PER_ATTACK, t);
    }
    u.nextAt = r2(t + u.interval / hasteMult(u, t));
  }

  let t = 0;
  let duration = BATTLE_MAX_TIME;
  let timeout = true;
  const steps = Math.round(BATTLE_MAX_TIME / BATTLE_DT);
  for (let step = 0; step <= steps; step++) {
    t = r2(step * BATTLE_DT);
    const ready = units
      .filter((u) => u.alive && u.nextAt <= t + 1e-6)
      .sort((x, y) => x.nextAt - y.nextAt || (x.side === y.side ? x.slot - y.slot : x.side === 'A' ? -1 : 1));
    for (const u of ready) {
      if (!u.alive) continue;
      if (over()) break;
      act(u, t);
    }
    if (over()) {
      duration = t;
      timeout = false;
      break;
    }
  }

  const finalHp: Record<string, number> = {};
  const maxHp: Record<string, number> = {};
  const dealt: Record<string, number> = {};
  const healed: Record<string, number> = {};
  let hpA = 0;
  let maxA = 0;
  for (const u of units) {
    finalHp[u.uid] = Math.max(0, Math.round(u.hp));
    maxHp[u.uid] = u.maxHp;
    dealt[u.uid] = Math.round(u.dealt);
    healed[u.uid] = Math.round(u.healed);
    if (u.side === 'A') {
      hpA += Math.max(0, u.hp);
      maxA += u.maxHp;
    }
  }
  const aAlive = A.some((u) => u.alive);
  const bAlive = B.some((u) => u.alive);
  const winner: 'A' | 'B' = aAlive && !bAlive ? 'A' : 'B';
  return {
    winner,
    events,
    finalHp,
    duration: r2(duration),
    lossRatioA: maxA > 0 ? Math.max(0, Math.min(1, 1 - hpA / maxA)) : 1,
    maxHp,
    dealt,
    healed,
    timeout,
  };
}

/** Soldiers lost by side A (proportional to each hero's HP lost x factor). */
export function troopLosses(attackers: Combatant[], result: BattleResult, factor = 0.3): number {
  let n = 0;
  for (const c of attackers) {
    const troops = (c as BattleUnit).troops ?? 0;
    if (!troops) continue;
    const max = result.maxHp?.[c.uid] ?? c.maxHp;
    const lost = 1 - (result.finalHp[c.uid] ?? 0) / Math.max(1, max);
    n += troops * Math.max(0, lost) * factor;
  }
  return Math.floor(n);
}

export interface BattleRequest {
  title: string;
  attackers: Combatant[];
  defenders: Combatant[];
  seed?: number;
  /** Background/arena flavour for the scene. */
  arena?: 'road' | 'wasteland' | 'city';
  /**
   * Called when the player leaves the result screen (the mode then goes to `returnTo`). Prefer applying the
   * outcome (rewards/losses) BEFORE startBattle — the player may close the app during playback.
   */
  onFinish: (result: BattleResult) => void;
  /** Mode to return to after the battle (default 'base'). */
  returnTo?: 'base' | 'world';
  // ---- Optional extras (additive) ----
  /** Precomputed result (must come from simulateBattle with the same inputs). */
  result?: BattleResult;
  /** Shown on the victory screen. */
  rewards?: Reward;
  /** Small subtitle under the title (e.g. district name). */
  subtitle?: string;
  /** Extra lines on the result screen (e.g. "Wounded soldiers: 12"). */
  notes?: string[];
  /** Attacking squad id (the defeat screen's "Formation" button opens it). */
  squadId?: number;
}

/** Opens the 3D battle playback mode. The result is computed up-front with simulateBattle. */
export function startBattle(req: BattleRequest): void {
  if (!req.result) req = { ...req, result: simulateBattle(req.attackers, req.defenders, req.seed ?? 1) };
  goTo('battle', req);
}
