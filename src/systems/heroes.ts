// OWNER: heroes agent. Hero progression, squads, recruitment, combat stat derivation.
// The contract functions squadCombatants/squadPower/squadReady are used by other modules (world map, HUD) — keep signatures.
import { mutate, type GameState } from '../core/store';
import type { Combatant, Cost, HeroType, Rarity } from '../core/types';
import { bonusMult, getBonus } from '../core/bonuses';
import { emit } from '../core/events';
import { canAfford, consumeItemIn, spendIn } from '../core/economy';
import { toast } from '../core/nav';
import { now } from '../core/tick';
import { isUnlocked } from '../core/unlocks';
import { hqLevel, marchSizePerHero } from './buildings';
import { troopTier } from '../data/troops';
import {
  HEROES,
  SCRIPTED_FIRST_RECRUIT,
  heroDef,
  skillScale,
  type HeroDef,
  type PassiveDef,
  type Stats,
} from '../data/heroes';
import { newHeroState, type HeroState, type Squad } from '../state/heroes';

// ---------------------------------------------------------------------------------------------
// Tuning
// ---------------------------------------------------------------------------------------------
export const STAR_COSTS = [25, 50, 100, 300, 500];
export const MAX_STARS = 5;
/** Max skill level by star count (0..5 stars). */
export const SKILL_CAP_BY_STARS = [3, 5, 10, 15, 20, 30];
export const UNLOCK_SHARDS = 10;
export const DUP_SHARDS: Record<Rarity, number> = { SR: 10, SSR: 30, UR: 60 };
export const STAR_STAT_BONUS = 0.12;
export const MAX_SQUADS = 4;

/** Extra combat fields carried on hero/zombie combatants (optional; the battle sim falls back to defaults). */
export interface CombatExtras {
  /** Skill levels [auto, active, passive]. */
  skillLv?: number[];
  /** Soldiers led by this hero. */
  troops?: number;
  /** Highest soldier tier in the unit. */
  troopTier?: number;
  /** Visual group size for zombie units. */
  count?: number;
  /** Stars (heroes). */
  stars?: number;
  /**
   * Counter-triangle type of a typed enemy (boss/elite zombies keep `type: 'zombie'` for their abilities and
   * visuals but fight as this type: Tank > Missile > Aircraft > Tank). See typeEnemy() in src/systems/campaign.ts.
   */
  ctype?: HeroType;
}
export type BattleUnit = Combatant & CombatExtras;

// ---------------------------------------------------------------------------------------------
// Power & troops
// ---------------------------------------------------------------------------------------------

/** Headline power of a stat block. Also used for enemies so "recommended power" is comparable. */
export function combatPower(hp: number, atk: number, def: number): number {
  return hp + atk * 10 + def * 5;
}

/**
 * Per-soldier combat stats for a tier (T1..T10). Reads the single soldier table in src/data/troops.ts
 * (also used by the Barracks screen and the 'troops' power provider).
 */
export function troopStats(tier: number): Stats {
  const t = troopTier(tier);
  return { hp: t.hp, atk: t.atk, def: t.def };
}
export function troopPower(tier: number): number {
  return troopTier(tier).power;
}

export interface TroopStack {
  tier: number;
  count: number;
}

/** Soldiers one hero leads: the march size for its type (HQ + type center) plus 2 per hero level above 1. */
export function heroLeadSize(s: GameState, h: HeroState): number {
  const d = heroDef(h.id);
  if (!d) return 0;
  return marchSizePerHero(s, d.type) + Math.floor((h.level - 1) * 2);
}

/** Per-slot soldier caps of a squad; the flat `squad_capacity` bonus (research) is shared among its heroes. */
function slotCaps(s: GameState, sq: Squad): number[] {
  const caps = [0, 0, 0, 0, 0];
  const filled: number[] = [];
  for (let i = 0; i < 5; i++) {
    const id = sq.heroes[i];
    const h = id ? s.heroes.owned[id] : undefined;
    if (!h || !heroDef(h.id)) continue;
    caps[i] = heroLeadSize(s, h);
    filled.push(i);
  }
  const extra = Math.max(0, Math.floor(getBonus(s, 'squad_capacity')));
  if (filled.length && extra > 0) {
    const each = Math.floor(extra / filled.length);
    let rest = extra - each * filled.length;
    for (const i of filled) caps[i] += each + (rest-- > 0 ? 1 : 0);
  }
  return caps;
}

/**
 * THE soldier capacity of a squad (sum of its heroes' lead sizes + the `squad_capacity` bonus).
 * Used by battles (troopAllocation) and by the world map (marches), so both always agree.
 */
export function squadTroopCap(s: GameState, squadId: number): number {
  const sq = getSquad(s, squadId);
  return sq ? slotCaps(s, sq).reduce((a, b) => a + b, 0) : 0;
}

/** True while the squad is out on a world-map march (its heroes and soldiers are away). */
export function squadBusy(s: GameState, squadId: number): boolean {
  const marches = s.world?.marches;
  return !!marches && marches.some((m) => m.squadId === squadId);
}

/** Soldiers a busy squad took on its march(es). */
function marchTroopsOf(s: GameState, squadId: number): number {
  let n = 0;
  for (const m of s.world?.marches ?? []) if (m.squadId === squadId) n += Math.max(0, Math.floor(m.troops ?? 0));
  return n;
}

/**
 * Splits ready soldiers between squads and within a squad between heroes (slot order), each hero leading up
 * to its lead size, highest tiers first. Squads out on a world march are served first and keep exactly the
 * soldiers they marched with, so soldiers that are away are never counted again for squads at home.
 * Returns squadId -> per-slot stacks.
 */
export function troopAllocation(s: GameState): Record<number, TroopStack[][]> {
  const pool: TroopStack[] = Object.entries(s.meta.troops)
    .map(([t, n]) => ({ tier: Number(t), count: Math.max(0, Math.floor(n ?? 0)) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.tier - a.tier);
  const out: Record<number, TroopStack[][]> = {};
  const busy = (id: number) => squadBusy(s, id);
  const squads = [...s.heroes.squads].sort((a, b) => Number(busy(b.id)) - Number(busy(a.id)) || a.id - b.id);
  for (const sq of squads) {
    const caps = slotCaps(s, sq);
    let budget = busy(sq.id) ? marchTroopsOf(s, sq.id) : Infinity;
    const slots: TroopStack[][] = [];
    for (let i = 0; i < 5; i++) {
      const stacks: TroopStack[] = [];
      let need = Math.min(caps[i], budget);
      for (const p of pool) {
        if (need <= 0) break;
        if (p.count <= 0) continue;
        const take = Math.min(need, p.count);
        p.count -= take;
        need -= take;
        budget -= take;
        stacks.push({ tier: p.tier, count: take });
      }
      slots.push(stacks);
    }
    out[sq.id] = slots;
  }
  return out;
}

/** Soldiers of a squad by tier (tier -> count), as they would fight right now. */
export function squadTroopsByTier(s: GameState, squadId: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const slot of troopAllocation(s)[squadId] ?? []) for (const st of slot) out[st.tier] = (out[st.tier] ?? 0) + st.count;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Hero stats
// ---------------------------------------------------------------------------------------------
export interface GearSlotDef {
  id: string;
  name: string;
  /** Stat % gained per gear level. */
  per: { hp?: number; atk?: number; def?: number; crit?: number };
}
export const GEAR_SLOTS: GearSlotDef[] = [
  { id: 'gun', name: 'Gun', per: { atk: 2.5 } },
  { id: 'armor', name: 'Armor', per: { def: 3, hp: 1 } },
  { id: 'chip', name: 'Chip', per: { atk: 1, hp: 1.5, crit: 0.2 } },
  { id: 'radar', name: 'Radar', per: { hp: 2.5, def: 1.5 } },
];

export function gearTier(level: number): { name: string; color: string } {
  if (level <= 0) return { name: 'Empty', color: '#6a7888' };
  if (level < 10) return { name: 'Green', color: '#5ad05a' };
  if (level < 20) return { name: 'Blue', color: '#4aa8ff' };
  if (level < 30) return { name: 'Purple', color: '#c070ff' };
  return { name: 'Gold', color: '#ffb428' };
}

/** Gear cannot exceed the hero's level. */
export function gearCap(h: HeroState): number {
  return h.level;
}

export function gearUpgradeCost(level: number): Cost {
  const cost: Cost = { iron: Math.round(120 * Math.pow(1.26, level)) };
  if (level >= 8) cost.gold = Math.round(60 * Math.pow(1.28, level - 8));
  return cost;
}

function passiveOf(def: HeroDef): PassiveDef {
  return def.skills[2].passive ?? {};
}

export interface HeroStats extends Stats {
  crit: number;
}

/** A hero's own stats (level, stars, gear, own passive). No squad/troop/global bonuses. */
export function heroStats(h: HeroState): HeroStats {
  const d = heroDef(h.id);
  if (!d) return { hp: 1, atk: 1, def: 1, crit: 5 };
  const lv = Math.max(0, h.level - 1);
  const star = 1 + STAR_STAT_BONUS * h.stars;
  let hp = (d.base.hp + d.growth.hp * lv) * star;
  let atk = (d.base.atk + d.growth.atk * lv) * star;
  let def = (d.base.def + d.growth.def * lv) * star;
  let crit = 5;
  const g = { hp: 0, atk: 0, def: 0, crit: 0 };
  GEAR_SLOTS.forEach((slot, i) => {
    const L = h.gear[i] ?? 0;
    g.hp += (slot.per.hp ?? 0) * L;
    g.atk += (slot.per.atk ?? 0) * L;
    g.def += (slot.per.def ?? 0) * L;
    g.crit += (slot.per.crit ?? 0) * L;
  });
  const p = passiveOf(d);
  const k = skillScale(h.skillLevels[2] ?? 1);
  hp *= 1 + (g.hp + (p.hp ?? 0) * k) / 100;
  atk *= 1 + (g.atk + (p.atk ?? 0) * k) / 100;
  def *= 1 + (g.def + (p.def ?? 0) * k) / 100;
  crit += g.crit + (p.crit ?? 0) * k;
  return { hp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), crit };
}

function skillPowerFactor(h: HeroState): number {
  const sum = (h.skillLevels ?? [1, 1, 1]).reduce((a, b) => a + b, 0);
  return 1 + 0.025 * (sum - 3) + 0.04 * h.stars;
}

/** Power of a single hero (without troops) — shown on hero cards; summed for the 'heroes' power provider. */
export function heroPower(h: HeroState): number {
  const st = heroStats(h);
  return Math.floor(combatPower(st.hp, st.atk, st.def) * skillPowerFactor(h));
}

/** Sum of all owned heroes' power (registered as power provider 'heroes'). */
export function allHeroesPower(s: GameState): number {
  let p = 0;
  for (const h of Object.values(s.heroes.owned)) p += heroPower(h);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------------------------
export function heroLevelCap(s: GameState): number {
  return 5 * Math.max(1, hqLevel(s));
}

/** Hero EXP needed to go from `level` to `level + 1`. */
export function expToNext(level: number): number {
  return Math.round(20 * Math.pow(level, 1.8) + 30);
}

export function canLevelUp(s: GameState, h: HeroState): boolean {
  return h.level < heroLevelCap(s) && s.currencies.heroExp >= expToNext(h.level);
}

/** Levels a hero up to `times` levels (stops at the cap or when EXP runs out). Returns levels gained. */
export function levelUpHero(heroId: string, times = 1): number {
  let gained = 0;
  let level = 0;
  mutate((s) => {
    const h = s.heroes.owned[heroId];
    if (!h) return;
    const cap = heroLevelCap(s);
    while (gained < times && h.level < cap) {
      const c = expToNext(h.level);
      if (s.currencies.heroExp < c) break;
      s.currencies.heroExp -= c;
      h.level++;
      gained++;
    }
    level = h.level;
  });
  if (gained > 0) emit('hero:levelUp', { heroId, level });
  return gained;
}

/** Total EXP needed to gain `n` levels from the current one (ignores the cap). */
export function expForLevels(level: number, n: number): number {
  let t = 0;
  for (let i = 0; i < n; i++) t += expToNext(level + i);
  return t;
}

/** Levels behind the squad-1 average at which newly recruited heroes join. */
export const RECRUIT_LEVEL_GAP = 5;

/**
 * Level a newly unlocked hero joins at (free, no EXP spent): average level of Squad 1's heroes minus 5,
 * at least 1 and never above the hero level cap. Keeps new recruits usable instead of starting at Lv 1.
 */
export function newRecruitLevel(s: GameState): number {
  const sq = s.heroes.squads.find((q) => q.id === 1);
  const lv: number[] = [];
  for (const id of sq?.heroes ?? []) {
    const h = id ? s.heroes.owned[id] : undefined;
    if (h) lv.push(h.level);
  }
  if (!lv.length) return 1;
  const avg = lv.reduce((a, b) => a + b, 0) / lv.length;
  return Math.max(1, Math.min(heroLevelCap(s), Math.floor(avg) - RECRUIT_LEVEL_GAP));
}

/** Level a hero goes back to on reset (the level it joined at for free). */
export function heroBaseLevel(h: HeroState): number {
  return Math.max(1, Math.min(h.level, Math.floor(h.baseLevel ?? 1)));
}

/** Hero EXP a reset refunds: 100% of the EXP spent leveling above the free join level. */
export function heroResetRefund(h: HeroState): number {
  const base = heroBaseLevel(h);
  return expForLevels(base, h.level - base);
}

/**
 * Resets a hero to the level it joined at and refunds 100% of the Hero EXP spent on it (stars, skills and gear
 * are kept). Returns the EXP refunded (0 = nothing to reset).
 */
export function resetHero(heroId: string): number {
  let refund = 0;
  mutate((s) => {
    const h = s.heroes.owned[heroId];
    if (!h) return;
    refund = heroResetRefund(h);
    if (refund <= 0) return;
    h.level = heroBaseLevel(h);
    s.currencies.heroExp += refund;
  });
  return refund;
}

/** Creates a newly unlocked hero at the recruit level (call inside mutate). */
function newRecruitIn(s: GameState, heroId: string): HeroState {
  const lv = newRecruitLevel(s);
  const nh = newHeroState(heroId, lv);
  nh.baseLevel = lv;
  return nh;
}

// ---------------------------------------------------------------------------------------------
// Stars & shards
// ---------------------------------------------------------------------------------------------
export function starCost(h: HeroState): number | null {
  return h.stars >= MAX_STARS ? null : STAR_COSTS[h.stars];
}

export function canStarUp(h: HeroState): boolean {
  const c = starCost(h);
  return c !== null && h.shards >= c;
}

export function starUpHero(heroId: string): boolean {
  let ok = false;
  let stars = 0;
  mutate((s) => {
    const h = s.heroes.owned[heroId];
    if (!h) return;
    const c = starCost(h);
    if (c === null || h.shards < c) return;
    h.shards -= c;
    h.stars++;
    stars = h.stars;
    ok = true;
  });
  if (ok) emit('hero:starUp', { heroId, stars });
  return ok;
}

/** Universal shard item usable for a hero of this rarity. */
export function universalShardItem(rarity: Rarity): string {
  return rarity === 'UR' ? 'shard_universal_ur' : 'shard_universal_ssr';
}

/** Converts universal shard items into this hero's shards. */
export function useUniversalShards(heroId: string, count: number): boolean {
  let ok = false;
  mutate((s) => {
    const h = s.heroes.owned[heroId];
    const d = heroDef(heroId);
    if (!h || !d || count <= 0) return;
    if (!consumeItemIn(s, universalShardItem(d.rarity), count)) return;
    h.shards += count;
    ok = true;
  });
  return ok;
}

/** Adds shards to a hero (owned or not). 10 shards unlock an unowned hero. Call inside mutate(). */
export function addShardsIn(s: GameState, heroId: string, n: number): { unlocked: boolean } {
  if (!heroDef(heroId) || n <= 0) return { unlocked: false };
  const h = s.heroes.owned[heroId];
  if (h) {
    h.shards += n;
    return { unlocked: false };
  }
  const pending = (s.heroes.pendingShards[heroId] ?? 0) + n;
  if (pending >= UNLOCK_SHARDS) {
    const nh = newRecruitIn(s, heroId);
    nh.shards = pending - UNLOCK_SHARDS;
    s.heroes.owned[heroId] = nh;
    delete s.heroes.pendingShards[heroId];
    return { unlocked: true };
  }
  s.heroes.pendingShards[heroId] = pending;
  return { unlocked: false };
}

/** Grants a whole hero; duplicates convert into shards. Call inside mutate(). */
export function grantHeroIn(s: GameState, heroId: string): { isNew: boolean; shards: number } {
  const d = heroDef(heroId);
  if (!d) return { isNew: false, shards: 0 };
  const h = s.heroes.owned[heroId];
  if (h) {
    h.shards += DUP_SHARDS[d.rarity];
    return { isNew: false, shards: DUP_SHARDS[d.rarity] };
  }
  const nh = newRecruitIn(s, heroId);
  const pending = s.heroes.pendingShards[heroId] ?? 0;
  nh.shards = pending;
  delete s.heroes.pendingShards[heroId];
  s.heroes.owned[heroId] = nh;
  return { isNew: true, shards: 0 };
}

// ---------------------------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------------------------
export function skillCap(h: HeroState): number {
  return SKILL_CAP_BY_STARS[Math.min(MAX_STARS, h.stars)];
}

/** skill_medal cost to go from `level` to `level + 1`. */
export function skillMedalCost(rarity: Rarity, level: number): number {
  const m = rarity === 'UR' ? 2 : rarity === 'SSR' ? 1.5 : 1;
  return Math.ceil((1 + level) * m);
}

export function canSkillUp(s: GameState, h: HeroState, idx: number): boolean {
  const d = heroDef(h.id);
  if (!d) return false;
  const lv = h.skillLevels[idx] ?? 1;
  return lv < skillCap(h) && (s.items.skill_medal ?? 0) >= skillMedalCost(d.rarity, lv);
}

export function upgradeSkill(heroId: string, idx: number): boolean {
  let ok = false;
  mutate((s) => {
    const h = s.heroes.owned[heroId];
    const d = heroDef(heroId);
    if (!h || !d) return;
    const lv = h.skillLevels[idx] ?? 1;
    if (lv >= skillCap(h)) return;
    if (!consumeItemIn(s, 'skill_medal', skillMedalCost(d.rarity, lv))) return;
    h.skillLevels[idx] = lv + 1;
    ok = true;
  });
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Gear
// ---------------------------------------------------------------------------------------------
export function canGearUp(s: GameState, h: HeroState, slot: number): boolean {
  const L = h.gear[slot] ?? 0;
  return L < gearCap(h) && canAfford(s, gearUpgradeCost(L));
}

export function upgradeGear(heroId: string, slot: number): boolean {
  let ok = false;
  mutate((s) => {
    const h = s.heroes.owned[heroId];
    if (!h) return;
    const L = h.gear[slot] ?? 0;
    if (L >= gearCap(h)) return;
    if (!spendIn(s, gearUpgradeCost(L))) return;
    h.gear[slot] = L + 1;
    ok = true;
  });
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Red dots
// ---------------------------------------------------------------------------------------------
export function heroSquadOf(s: GameState, heroId: string): number | null {
  for (const sq of s.heroes.squads) if (sq.heroes.includes(heroId)) return sq.id;
  return null;
}

/** True when this hero has an upgrade worth tapping (level for deployed heroes, stars, skills). */
export function heroHasUpgrade(s: GameState, h: HeroState): boolean {
  if (canStarUp(h)) return true;
  const deployed = heroSquadOf(s, h.id) !== null;
  if (!deployed) return false;
  if (canLevelUp(s, h)) return true;
  for (let i = 0; i < 3; i++) if (canSkillUp(s, h, i)) return true;
  return false;
}

/** For HUD red dots on the Heroes button. */
export function anyHeroUpgradable(s: GameState): boolean {
  for (const h of Object.values(s.heroes.owned)) if (heroHasUpgrade(s, h)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// Squads
// ---------------------------------------------------------------------------------------------

/** Squad ids the player can use (1 always; 2-4 via unlocks). */
export function unlockedSquadIds(s: GameState): number[] {
  const out = [1];
  if (isUnlocked(s, 'squad2')) out.push(2);
  if (isUnlocked(s, 'squad3')) out.push(3);
  if (isUnlocked(s, 'squad4')) out.push(4);
  return out;
}

function ensureSquadIn(s: GameState, squadId: number): Squad {
  let sq = s.heroes.squads.find((q) => q.id === squadId);
  if (!sq) {
    sq = { id: squadId, heroes: [null, null, null, null, null] };
    s.heroes.squads.push(sq);
    s.heroes.squads.sort((a, b) => a.id - b.id);
  }
  return sq;
}

export function getSquad(s: GameState, squadId: number): Squad | undefined {
  return s.heroes.squads.find((q) => q.id === squadId);
}

/** Why a squad's line-up can't be changed right now (null = OK). */
export function squadLockReason(s: GameState, squadId: number): string | null {
  return squadBusy(s, squadId) ? `Squad ${squadId} is out on a world march — wait for it to return` : null;
}

/**
 * Puts a hero into a squad slot (or clears it with null). A hero can only be in one squad:
 * it is moved from wherever it was (swapping with the target slot's hero inside the same squad).
 * Squads out on a world march are locked (no heroes in or out). Returns false (with a toast) if refused.
 */
export function assignHero(squadId: number, slot: number, heroId: string | null): boolean {
  const touched = new Set<number>([squadId]);
  let err = null as string | null;
  mutate((s) => {
    err = squadLockReason(s, squadId);
    if (err) return;
    if (heroId) {
      const from = heroSquadOf(s, heroId);
      if (from !== null && from !== squadId && squadBusy(s, from)) {
        err = `${heroDef(heroId)?.callsign ?? 'This hero'} is on a march with Squad ${from}`;
        return;
      }
    }
    const sq = ensureSquadIn(s, squadId);
    const prev = sq.heroes[slot];
    if (heroId) {
      if (!s.heroes.owned[heroId]) return;
      for (const other of s.heroes.squads) {
        const i = other.heroes.indexOf(heroId);
        if (i >= 0) {
          other.heroes[i] = other.id === squadId ? prev ?? null : null;
          touched.add(other.id);
        }
      }
    }
    sq.heroes[slot] = heroId;
  });
  if (err) {
    toast(err, 'bad');
    return false;
  }
  for (const id of touched) emit('squad:changed', { squadId: id });
  return true;
}

/** Same-type formation bonus (% to HP/ATK/DEF): 3 -> 5, 3+2 -> 10, 4 -> 15, 5 -> 20. */
export function typeBonusPct(types: HeroType[]): number {
  const counts: Record<string, number> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  const vals = Object.values(counts).sort((a, b) => b - a);
  const top = vals[0] ?? 0;
  if (top >= 5) return 20;
  if (top === 4) return 15;
  if (top === 3) return vals[1] === 2 ? 10 : 5;
  return 0;
}

export function squadTypes(s: GameState, sq: Squad): HeroType[] {
  const out: HeroType[] = [];
  for (const id of sq.heroes) {
    if (!id || !s.heroes.owned[id]) continue;
    const d = heroDef(id);
    if (d) out.push(d.type);
  }
  return out;
}

/** Aura % a hero receives from passives of squad mates (including its own aura). */
function auraFor(s: GameState, sq: Squad, slot: number, type: HeroType): Stats {
  const out: Stats = { hp: 0, atk: 0, def: 0 };
  sq.heroes.forEach((id) => {
    if (!id) return;
    const h = s.heroes.owned[id];
    const d = heroDef(id);
    if (!h || !d) return;
    const a = passiveOf(d).aura;
    if (!a) return;
    const match =
      a.scope === 'all' || a.scope === type || (a.scope === 'front' && slot <= 1) || (a.scope === 'back' && slot >= 2);
    if (!match) return;
    const k = skillScale(h.skillLevels[2] ?? 1);
    out.hp += (a.hp ?? 0) * k;
    out.atk += (a.atk ?? 0) * k;
    out.def += (a.def ?? 0) * k;
  });
  return out;
}

/**
 * Builds battle-ready combatants for a squad (side 'A'), including troop/research/building bonuses.
 * Empty slots are skipped. Returns [] if the squad has no heroes.
 */
export function squadCombatants(s: GameState, squadId: number): Combatant[] {
  const sq = getSquad(s, squadId);
  if (!sq) return [];
  const alloc = troopAllocation(s)[squadId] ?? [];
  const bonus = typeBonusPct(squadTypes(s, sq));
  const gHp = bonusMult(s, 'hp_pct');
  const gAtk = bonusMult(s, 'atk_pct');
  const gDef = bonusMult(s, 'def_pct');
  const out: BattleUnit[] = [];
  sq.heroes.forEach((id, slot) => {
    if (!id) return;
    const h = s.heroes.owned[id];
    const d = heroDef(id);
    if (!h || !d) return;
    const own = heroStats(h);
    const aura = auraFor(s, sq, slot, d.type);
    const stacks = alloc[slot] ?? [];
    let tHp = 0,
      tAtk = 0,
      tDef = 0,
      troops = 0,
      tier = 0;
    for (const st of stacks) {
      const ts = troopStats(st.tier);
      tHp += ts.hp * st.count;
      tAtk += ts.atk * st.count;
      tDef += ts.def * st.count;
      troops += st.count;
      tier = Math.max(tier, st.tier);
    }
    const typeM = bonusMult(s, `${d.type}_pct`);
    const sqM = 1 + bonus / 100;
    const hp = Math.round((own.hp * (1 + aura.hp / 100) + tHp) * sqM * gHp * typeM);
    const atk = Math.round((own.atk * (1 + aura.atk / 100) + tAtk) * sqM * gAtk * typeM);
    const def = Math.round((own.def * (1 + aura.def / 100) + tDef) * sqM * gDef * typeM);
    out.push({
      uid: `sq${squadId}_${id}`,
      name: d.name,
      side: 'A',
      slot,
      type: d.type,
      rarity: d.rarity,
      model: d.type,
      level: h.level,
      maxHp: hp,
      hp,
      atk,
      def,
      skillId: d.skills[1].id,
      heroId: id,
      skillLv: [...h.skillLevels],
      troops,
      troopTier: tier,
      stars: h.stars,
    });
  });
  return out;
}

function unitPower(c: BattleUnit): number {
  let p = combatPower(c.maxHp, c.atk, c.def);
  if (c.skillLv) {
    const sum = c.skillLv.reduce((a, b) => a + b, 0);
    p *= 1 + 0.025 * (sum - 3) + 0.04 * (c.stars ?? 0);
  }
  return p;
}

/** Power of a list of combatants (heroes with troops, or enemies). */
export function formationPower(units: Combatant[]): number {
  let p = 0;
  for (const c of units) p += unitPower(c as BattleUnit);
  return Math.floor(p);
}

/** Combat power of a squad (for UI and for comparing against enemy recommended power). */
export function squadPower(s: GameState, squadId: number): number {
  return formationPower(squadCombatants(s, squadId));
}

/** True if the squad has at least one hero assigned. */
export function squadReady(s: GameState, squadId: number): boolean {
  const sq = s.heroes.squads.find((q) => q.id === squadId);
  return !!sq && sq.heroes.some((h) => h && s.heroes.owned[h]);
}

/**
 * Soldiers a squad currently leads (its share of the ready soldiers, limited by squadTroopCap; for a squad
 * out on a march, the soldiers it marched with). The world map uses this for march sizes.
 */
export function squadTroops(s: GameState, squadId: number): number {
  const alloc = troopAllocation(s)[squadId] ?? [];
  let n = 0;
  for (const slot of alloc) for (const st of slot) n += st.count;
  return n;
}

/** Heuristic "front-liner" score: defenders with high HP go front. */
function frontScore(d: HeroDef, h: HeroState): number {
  const st = heroStats(h);
  return (d.role === 'defense' ? 1e6 : d.role === 'support' ? 0 : 1e3) + st.hp;
}

/**
 * Quick deploy: fills a squad with the strongest available heroes (not in other squads), trying each
 * type for the same-type bonus. Defenders go to the front row. Refused (false + toast) while the squad is
 * out on a world march; heroes of other squads (busy or not) are never taken.
 */
export function autoFillSquad(squadId: number): boolean {
  let err = null as string | null;
  mutate((s) => {
    err = squadLockReason(s, squadId);
    if (err) return;
    const sq = ensureSquadIn(s, squadId);
    const taken = new Set<string>();
    for (const other of s.heroes.squads) if (other.id !== squadId) other.heroes.forEach((id) => id && taken.add(id));
    const pool = Object.values(s.heroes.owned)
      .filter((h) => !taken.has(h.id) && heroDef(h.id))
      .map((h) => ({ h, d: heroDef(h.id)!, p: heroPower(h) }))
      .sort((a, b) => b.p - a.p);
    if (!pool.length) return;
    let best: typeof pool = [];
    let bestScore = -1;
    for (const t of ['tank', 'aircraft', 'missile', null] as (HeroType | null)[]) {
      const pick = t ? [...pool.filter((x) => x.d.type === t), ...pool.filter((x) => x.d.type !== t)].slice(0, 5) : pool.slice(0, 5);
      const bonus = typeBonusPct(pick.map((x) => x.d.type));
      const score = pick.reduce((a, x) => a + x.p, 0) * (1 + bonus / 100);
      if (score > bestScore) {
        bestScore = score;
        best = pick;
      }
    }
    best.sort((a, b) => frontScore(b.d, b.h) - frontScore(a.d, a.h));
    const heroes: (string | null)[] = [null, null, null, null, null];
    // Front: top 2 front-liners; back: rest with attackers in the middle.
    heroes[0] = best[0]?.h.id ?? null;
    heroes[1] = best[1]?.h.id ?? null;
    const back = best.slice(2).sort((a, b) => (b.d.role === 'attack' ? 1 : 0) - (a.d.role === 'attack' ? 1 : 0));
    const order = [3, 2, 4];
    back.forEach((x, i) => (heroes[order[i]] = x.h.id));
    sq.heroes = heroes;
  });
  if (err) {
    toast(err, 'bad');
    return false;
  }
  emit('squad:changed', { squadId });
  return true;
}

// ---------------------------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------------------------
export const RECRUIT_RATES: Record<Rarity, number> = { UR: 0.02, SSR: 0.18, SR: 0.8 };
export const UR_PITY = 50;
export const FREE_RECRUIT_MS = 24 * 3600 * 1000;
export const RECRUIT_DIAMONDS_1 = 300;
export const RECRUIT_DIAMONDS_10 = 2700;

export type RecruitMethod = 'free' | 'ticket' | 'diamonds';

export interface PullResult {
  heroId: string;
  rarity: Rarity;
  isNew: boolean;
  /** Shards gained (duplicates). */
  shards: number;
}

/** Free-recruit cooldown after the Tavern bonus (`recruit_cd_pct`, % shorter; at most -75%). */
export function freeRecruitCooldownMs(s: GameState): number {
  const pct = Math.max(0, Math.min(75, getBonus(s, 'recruit_cd_pct')));
  return Math.round(FREE_RECRUIT_MS * (1 - pct / 100));
}

export function freeRecruitReady(s: GameState, t = now()): boolean {
  return t >= s.heroes.recruit.freeAt;
}

export function recruitAffordable(s: GameState, count: 1 | 10, method: RecruitMethod): boolean {
  if (method === 'free') return count === 1 && freeRecruitReady(s);
  if (method === 'ticket') return (s.items.recruit_ticket ?? 0) >= count;
  return s.currencies.diamonds >= (count === 10 ? RECRUIT_DIAMONDS_10 : RECRUIT_DIAMONDS_1);
}

function pickHero(rarity: Rarity, rnd: () => number): string {
  const list = HEROES.filter((h) => h.rarity === rarity);
  return list[Math.floor(rnd() * list.length)].id;
}

/** Performs a recruitment. Returns null if it could not be paid. */
export function recruit(count: 1 | 10, method: RecruitMethod, rnd: () => number = Math.random): PullResult[] | null {
  let results: PullResult[] | null = null;
  mutate((s) => {
    if (!recruitAffordable(s, count, method)) return;
    if (method === 'free') s.heroes.recruit.freeAt = now() + freeRecruitCooldownMs(s);
    else if (method === 'ticket') consumeItemIn(s, 'recruit_ticket', count);
    else s.currencies.diamonds -= count === 10 ? RECRUIT_DIAMONDS_10 : RECRUIT_DIAMONDS_1;

    const r = s.heroes.recruit;
    const rolls: { id: string; rarity: Rarity }[] = [];
    for (let i = 0; i < count; i++) {
      if (r.totalPulls === 0 && i === 0) {
        // Scripted first recruit: a strong hero that completes the starter Tank squad.
        const d = heroDef(SCRIPTED_FIRST_RECRUIT)!;
        rolls.push({ id: d.id, rarity: d.rarity });
        r.pity++;
        continue;
      }
      r.pity++;
      let rarity: Rarity;
      const x = rnd();
      if (r.pity >= UR_PITY || x < RECRUIT_RATES.UR) rarity = 'UR';
      else if (x < RECRUIT_RATES.UR + RECRUIT_RATES.SSR) rarity = 'SSR';
      else rarity = 'SR';
      if (rarity === 'UR') r.pity = 0;
      rolls.push({ id: pickHero(rarity, rnd), rarity });
    }
    // Every 10-pull contains at least one SSR or better.
    if (count === 10 && !rolls.some((x) => x.rarity !== 'SR')) {
      const id = pickHero('SSR', rnd);
      rolls[rolls.length - 1] = { id, rarity: 'SSR' };
    }
    r.totalPulls += count;
    results = rolls.map((x) => {
      const g = grantHeroIn(s, x.id);
      return { heroId: x.id, rarity: x.rarity, isNew: g.isNew, shards: g.shards };
    });
  });
  if (results) for (const x of results as PullResult[]) emit('hero:recruited', { heroId: x.heroId, count: 1 });
  return results;
}
