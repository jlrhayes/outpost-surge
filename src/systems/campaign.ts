// OWNER: heroes agent. District campaign: stage N = district N around the base.
// game.heroes.campaign.stage = next district to fight. Also the idle "loot truck".
import { game, mutate, saveNow, type GameState } from '../core/store';
import type { Combatant, HeroType, Reward } from '../core/types';
import { emit } from '../core/events';
import { grantIn } from '../core/economy';
import { bonusMult } from '../core/bonuses';
import { now } from '../core/tick';
import { hashSeed, mulberry32, pick } from '../core/rng';
import { toast } from '../core/nav';
import { applyTroopLosses } from './troops';
import { combatPower, squadBusy, squadCombatants, squadReady, squadTroopsByTier, type BattleUnit } from './heroes';
import { simulateBattle, startBattle, troopLosses, weakTo, type BattleResult } from './battle';
import { HEROES, TYPE_LABEL } from '../data/heroes';
import {
  BOSS_NAMES,
  BOSS_TYPES,
  DISTRICT_TROOP_LOSS,
  ELITE_DOUBLE_FROM,
  ELITE_FROM,
  ELITE_PREFIX,
  IDLE_CAP_HOURS,
  ZOMBIE_KINDS,
  districtName,
  districtPower,
  idleRatesFor,
  isBossDistrict,
  type ZombieKind,
} from '../data/campaign';

export type Arena = 'road' | 'wasteland' | 'city';

export interface DistrictInfo {
  stage: number;
  name: string;
  boss: boolean;
  bossName?: string;
  arena: Arena;
  /** Recommended power (= enemy formation power). */
  recommended: number;
  enemies: BattleUnit[];
  rewards: Reward;
  /** Counter types carried by typed enemies (boss/elites), for the "Weak to ..." hint. */
  enemyTypes: HeroType[];
}

const ENEMY_TYPES: HeroType[] = ['tank', 'aircraft', 'missile'];

/** "Weak to Aircraft" style hint for a typed enemy. */
export function counterHint(type: HeroType): string {
  return `Weak to ${TYPE_LABEL[weakTo(type)]}`;
}

/**
 * Gives an enemy unit a hero type for the counter triangle (Tank > Missile > Aircraft > Tank). Zombies keep
 * `type: 'zombie'` (abilities, visuals, kill counts) and fight as `ctype`. Non-boss packs get an elite prefix
 * ("Armored Mauler"). Exported so other modules (e.g. world-map hordes) can type their enemies too.
 */
export function typeEnemy<T extends Combatant>(unit: T, type: HeroType, rename = true): T & { ctype: HeroType } {
  const u = unit as T & { ctype: HeroType };
  u.ctype = type;
  if (rename && unit.type === 'zombie' && !unit.model.toLowerCase().includes('boss') && !unit.name.startsWith(ELITE_PREFIX[type])) {
    u.name = `${ELITE_PREFIX[type]} ${unit.name}`;
  }
  return u;
}

/**
 * Types part of an enemy formation: the boss (if `bossType`), then `elites` non-boss units (front row first,
 * heaviest packs first) with `eliteType` (default: picked from `seed`). Mutates and returns `units`.
 */
export function typeEnemies<T extends Combatant>(units: T[], opts: { seed: number; bossType?: HeroType; elites?: number; eliteType?: HeroType }): T[] {
  for (const u of units) if (opts.bossType && u.model.toLowerCase().includes('boss')) typeEnemy(u, opts.bossType);
  const n = opts.elites ?? 0;
  if (n > 0) {
    const type = opts.eliteType ?? ENEMY_TYPES[opts.seed % ENEMY_TYPES.length];
    const weight = (u: T) => Object.values(ZOMBIE_KINDS).find((k) => k.model === u.model)?.weight ?? 1;
    const pool = units
      .filter((u) => !u.model.toLowerCase().includes('boss') && !(u as BattleUnit).ctype)
      .sort((a, b) => Number(a.slot > 1) - Number(b.slot > 1) || weight(b) - weight(a) || a.slot - b.slot);
    for (const u of pool.slice(0, n)) typeEnemy(u, type);
  }
  return units;
}

const cache = new Map<number, DistrictInfo>();

function unitPowerPerStrength(k: ZombieKind): number {
  const r = ZOMBIE_KINDS[k].ratio;
  return combatPower(r.hp, r.atk, r.def);
}

/** Builds a zombie unit of the given kind worth `power`. Exported for other modules (e.g. world hordes). */
export function makeZombieUnit(kind: ZombieKind, power: number, slot: number, uid: string, level: number, name?: string): BattleUnit {
  const d = ZOMBIE_KINDS[kind];
  const s = power / unitPowerPerStrength(kind);
  const hp = Math.max(10, Math.round(d.ratio.hp * s));
  return {
    uid,
    name: name ?? d.name,
    side: 'B',
    slot,
    type: 'zombie',
    model: d.model,
    level,
    maxHp: hp,
    hp,
    atk: Math.max(1, Math.round(d.ratio.atk * s)),
    def: Math.max(0, Math.round(d.ratio.def * s)),
    skillId: d.skillId,
    count: d.count,
  };
}

/**
 * Procedural zombie formation worth ~`power` (2 front + 3 back; bosses stand alone in the front row).
 * Exported so other modules can reuse it (e.g. world-map hordes).
 */
export function zombieFormation(power: number, seed: number, opts: { level: number; boss?: boolean; bossName?: string; uidPrefix?: string; units?: number } = { level: 1 }): BattleUnit[] {
  const rng = mulberry32(seed);
  const lvl = opts.level;
  const unlocked = (k: ZombieKind) => lvl >= ZOMBIE_KINDS[k].from;
  const slots: { slot: number; kind: ZombieKind }[] = [];
  const nUnits = opts.units ?? 5;
  if (opts.boss) {
    slots.push({ slot: 0, kind: 'boss' });
  } else {
    for (const slot of [0, 1]) {
      if (slots.length >= nUnits) break;
      slots.push({ slot, kind: unlocked('brute') && rng() < 0.45 ? 'brute' : 'walker' });
    }
  }
  const backPool: ZombieKind[] = ['walker'];
  if (unlocked('runner')) backPool.push('runner', 'runner');
  if (unlocked('spitter')) backPool.push('spitter', 'spitter');
  for (const slot of [3, 2, 4]) {
    if (slots.length >= nUnits) break;
    slots.push({ slot, kind: pick(rng, backPool) });
  }
  const totalW = slots.reduce((a, x) => a + ZOMBIE_KINDS[x.kind].weight, 0);
  const prefix = opts.uidPrefix ?? 'z';
  return slots
    .sort((a, b) => a.slot - b.slot)
    .map((x) =>
      makeZombieUnit(
        x.kind,
        (power * ZOMBIE_KINDS[x.kind].weight) / totalW,
        x.slot,
        `${prefix}_${x.slot}`,
        lvl,
        x.kind === 'boss' ? opts.bossName : undefined,
      ),
    );
}

function arenaFor(stage: number): Arena {
  if (isBossDistrict(stage)) return 'city';
  return (['road', 'wasteland', 'city'] as Arena[])[(stage - 1) % 3];
}

/** Rewards for clearing a district (each district is cleared once, so these are first-clear rewards). */
export function districtRewards(stage: number): Reward {
  const g = (base: number, rate: number) => Math.round(base * Math.pow(rate, stage - 1));
  const r: Reward = {
    currencies: { food: g(300, 1.09), iron: g(220, 1.09), heroExp: g(150, 1.1), diamonds: 8 },
    items: {},
  };
  if (stage >= 8) r.currencies!.gold = Math.round(100 * Math.pow(1.08, stage - 8));
  if (stage % 2 === 0) r.items!.skill_medal = 2 + Math.floor(stage / 5);
  if (isBossDistrict(stage)) {
    r.currencies!.diamonds = 40;
    r.items!.recruit_ticket = stage % 10 === 0 ? 2 : 1;
    // Shards of a (stable) random SSR hero: enough to unlock it if not owned yet.
    const ssr = HEROES.filter((h) => h.rarity === 'SSR');
    const hero = ssr[hashSeed('boss' + stage) % ssr.length];
    r.heroShards = { [hero.id]: 10 };
  }
  if (stage % 10 === 0) r.items!.shard_universal_ssr = 5;
  if (stage === 3) r.items!.recruit_ticket = (r.items!.recruit_ticket ?? 0) + 1; // recruitment unlocks here
  return r;
}

export function districtInfo(stage: number): DistrictInfo {
  let d = cache.get(stage);
  if (d) return d;
  const boss = isBossDistrict(stage);
  const bossName = boss ? BOSS_NAMES[(stage / 5 - 1) % BOSS_NAMES.length] : undefined;
  const power = Math.round(districtPower(stage) * (boss ? 0.8 : 1));
  const units = stage === 1 ? 3 : stage === 2 ? 4 : 5;
  const enemies = zombieFormation(power, hashSeed('district' + stage), { level: stage, boss, bossName, uidPrefix: 'd' + stage, units: boss ? 4 : units });
  // Counter triangle: bosses always carry a type; elite packs appear from district ELITE_FROM.
  typeEnemies(enemies, {
    seed: hashSeed('elite' + stage),
    bossType: boss ? BOSS_TYPES[(stage / 5 - 1) % BOSS_TYPES.length] : undefined,
    elites: boss ? 0 : stage >= ELITE_DOUBLE_FROM ? 2 : stage >= ELITE_FROM ? 1 : 0,
  });
  let rec = 0;
  for (const e of enemies) rec += combatPower(e.maxHp, e.atk, e.def);
  const enemyTypes = [...new Set(enemies.map((e) => e.ctype).filter((t): t is HeroType => !!t))];
  d = {
    stage,
    name: districtName(stage),
    boss,
    bossName,
    arena: arenaFor(stage),
    recommended: Math.floor(rec * (boss ? 1.25 : 1.1)),
    enemies,
    rewards: districtRewards(stage),
    enemyTypes,
  };
  cache.set(stage, d);
  return d;
}

/** Zombies killed in a battle (dead groups count fully, damaged groups proportionally). */
export function zombiesKilled(defenders: Combatant[], result: BattleResult): number {
  let n = 0;
  for (const c of defenders) {
    if (c.type !== 'zombie') continue;
    const count = (c as BattleUnit).count ?? 1;
    const max = result.maxHp?.[c.uid] ?? c.maxHp;
    n += Math.round(count * (1 - (result.finalHp[c.uid] ?? 0) / Math.max(1, max)));
  }
  return n;
}

/** Why a squad can't fight the next district right now (null = OK). */
export function districtBattleBlocker(s: GameState, squadId: number): string | null {
  if (squadBusy(s, squadId)) return `Squad ${squadId} is out on the world map. Wait for it to return or pick another squad.`;
  if (!squadReady(s, squadId)) return 'Assign heroes to your squad first';
  return null;
}

/**
 * Fights the next district with the given squad. The battle is simulated up-front and its outcome (stage,
 * rewards, wounded soldiers, events) is applied and saved immediately — the 3D scene only replays it, so
 * closing the app during playback can neither lose a win nor dodge losses. Returns false if it can't start.
 */
export function startDistrictBattle(squadId = 1): boolean {
  const s = game;
  const blocker = districtBattleBlocker(s, squadId);
  if (blocker) {
    toast(blocker, 'bad');
    return false;
  }
  const stage = s.heroes.campaign.stage;
  const info = districtInfo(stage);
  const attackers = squadCombatants(s, squadId);
  // The tiers that actually fight (losses are taken from these).
  const fought = squadTroopsByTier(s, squadId);
  const seed = (hashSeed('d' + stage) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const result = simulateBattle(attackers, info.enemies, seed);
  const won = result.winner === 'A';
  const lost = troopLosses(attackers, result, DISTRICT_TROOP_LOSS);
  const killed = zombiesKilled(info.enemies, result);

  let loss = { wounded: 0, died: 0 };
  mutate((st) => {
    if (st.heroes.campaign.stage !== stage) return;
    if (lost > 0) loss = applyTroopLosses(st, lost, fought);
    st.heroes.campaign.lastResult = won ? 'win' : 'loss';
    if (won) {
      grantIn(st, info.rewards);
      // The loot truck starts rolling once the first district is cleared.
      if (stage === 1) st.heroes.campaign.idleClaimedAt = now();
      st.heroes.campaign.stage = stage + 1;
    }
  });
  saveNow();
  if (killed > 0) emit('zombies:killed', { count: killed });
  if (won) emit('campaign:stageCleared', { stage });

  const notes: string[] = [];
  if (loss.wounded > 0) notes.push(`Wounded soldiers: ${loss.wounded} (heal them in the Hospital)`);
  if (loss.died > 0) notes.push(`Soldiers lost (hospital full): ${loss.died}`);
  if (!won) notes.push(result.timeout ? 'Out of time! Attackers must win within 60 s.' : 'Your squad was defeated.');
  startBattle({
    title: `District ${stage}`,
    subtitle: info.boss ? `${info.name} · Boss: ${info.bossName}` : info.name,
    attackers,
    defenders: info.enemies,
    seed,
    arena: info.arena,
    result,
    rewards: won ? info.rewards : undefined,
    notes,
    returnTo: 'base',
    squadId,
    // Outcome already applied above: leaving the result screen only navigates.
    onFinish: () => {},
  });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Idle loot truck
// ---------------------------------------------------------------------------------------------
export function districtsClearedCount(s: GameState): number {
  return Math.max(0, s.heroes.campaign.stage - 1);
}

/** Hourly idle rates (after the idle_reward_pct bonus). */
export function idleRates(s: GameState): { food: number; iron: number; gold: number; heroExp: number } {
  const r = idleRatesFor(districtsClearedCount(s));
  const m = bonusMult(s, 'idle_reward_pct');
  return { food: Math.round(r.food * m), iron: Math.round(r.iron * m), gold: Math.round(r.gold * m), heroExp: Math.round(r.heroExp * m) };
}

export interface IdleLoot {
  /** Accrued hours (capped). */
  hours: number;
  capped: boolean;
  /** Timestamp when the truck is full. */
  fullAt: number;
  reward: Reward;
}

export function idleLoot(s: GameState, t = now()): IdleLoot {
  const capMs = IDLE_CAP_HOURS * 3600e3;
  const elapsed = Math.max(0, Math.min(capMs, t - s.heroes.campaign.idleClaimedAt));
  const hours = elapsed / 3600e3;
  const r = idleRates(s);
  const cur: Reward['currencies'] = {};
  for (const k of ['food', 'iron', 'gold', 'heroExp'] as const) {
    const v = Math.floor(r[k] * hours);
    if (v > 0) cur[k] = v;
  }
  return { hours, capped: elapsed >= capMs, fullAt: s.heroes.campaign.idleClaimedAt + capMs, reward: { currencies: cur } };
}

/** True when the truck holds at least ~10 minutes of loot (for red dots). */
export function idleLootReady(s: GameState, t = now()): boolean {
  return districtsClearedCount(s) > 0 && t - s.heroes.campaign.idleClaimedAt >= 10 * 60e3;
}

/** Collects the loot truck. Returns the granted reward (or null if empty). */
export function claimIdleLoot(): Reward | null {
  const loot = idleLoot(game);
  if (!loot.reward.currencies || !Object.keys(loot.reward.currencies).length) return null;
  mutate((s) => {
    grantIn(s, loot.reward);
    s.heroes.campaign.idleClaimedAt = now();
  });
  // No 'resource:collected' here: that event means "collected building production" (daily task / stats).
  return loot.reward;
}
