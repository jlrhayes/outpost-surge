// OWNER: heroes agent. District campaign: stage N = district N around the base.
// game.heroes.campaign.stage = next district to fight. Also the idle "loot truck".
import { game, mutate, type GameState } from '../core/store';
import type { Combatant, Reward } from '../core/types';
import { emit } from '../core/events';
import { grantIn } from '../core/economy';
import { bonusMult } from '../core/bonuses';
import { now } from '../core/tick';
import { hashSeed, mulberry32, pick } from '../core/rng';
import { toast } from '../core/nav';
import { applyTroopLosses } from './troops';
import { combatPower, squadCombatants, squadReady, type BattleUnit } from './heroes';
import { simulateBattle, startBattle, troopLosses, type BattleResult } from './battle';
import { HEROES } from '../data/heroes';
import {
  BOSS_NAMES,
  DISTRICT_TROOP_LOSS,
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
    currencies: { food: g(300, 1.09), iron: g(220, 1.09), heroExp: g(150, 1.1), diamonds: 20 },
    items: {},
  };
  if (stage >= 8) r.currencies!.gold = Math.round(100 * Math.pow(1.08, stage - 8));
  if (stage % 2 === 0) r.items!.skill_medal = 2 + Math.floor(stage / 5);
  if (isBossDistrict(stage)) {
    r.currencies!.diamonds = 60;
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
  const power = districtPower(stage);
  const units = stage === 1 ? 3 : stage === 2 ? 4 : 5;
  const enemies = zombieFormation(power, hashSeed('district' + stage), { level: stage, boss, bossName, uidPrefix: 'd' + stage, units: boss ? 4 : units });
  let rec = 0;
  for (const e of enemies) rec += combatPower(e.maxHp, e.atk, e.def);
  d = {
    stage,
    name: districtName(stage),
    boss,
    bossName,
    arena: arenaFor(stage),
    recommended: Math.floor(rec),
    enemies,
    rewards: districtRewards(stage),
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

/** Starts the battle for the next district with the given squad. Returns false if the squad is empty. */
export function startDistrictBattle(squadId = 1): boolean {
  const s = game;
  if (!squadReady(s, squadId)) {
    toast('Assign heroes to your squad first', 'bad');
    return false;
  }
  const stage = s.heroes.campaign.stage;
  const info = districtInfo(stage);
  const attackers = squadCombatants(s, squadId);
  const seed = (hashSeed('d' + stage) ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  const result = simulateBattle(attackers, info.enemies, seed);
  const won = result.winner === 'A';
  const lost = troopLosses(attackers, result, DISTRICT_TROOP_LOSS);
  const notes: string[] = [];
  if (lost > 0) notes.push(`Wounded soldiers: ${lost}`);
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
    onFinish: (res) => finishDistrictBattle(stage, info, attackers, res, lost),
  });
  return true;
}

function finishDistrictBattle(stage: number, info: DistrictInfo, attackers: Combatant[], res: BattleResult, lost: number): void {
  const won = res.winner === 'A';
  if (game.heroes.campaign.stage !== stage) return; // already applied
  const killed = zombiesKilled(info.enemies, res);
  mutate((s) => {
    if (lost > 0) applyTroopLosses(s, lost);
    s.heroes.campaign.lastResult = won ? 'win' : 'loss';
    if (won) {
      grantIn(s, info.rewards);
      // The loot truck starts rolling once the first district is cleared.
      if (stage === 1) s.heroes.campaign.idleClaimedAt = now();
      s.heroes.campaign.stage = stage + 1;
    }
  });
  if (killed > 0) emit('zombies:killed', { count: killed });
  if (won) emit('campaign:stageCleared', { stage });
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
  for (const [k, v] of Object.entries(loot.reward.currencies)) {
    if (v && v > 0) emit('resource:collected', { resource: k as any, amount: v });
  }
  return loot.reward;
}
