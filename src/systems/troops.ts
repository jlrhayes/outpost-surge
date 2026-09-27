// OWNER: meta agent. Soldiers: training in barracks, wounded/healing in hospitals, capacity.
// CONTRACT (used by heroes/battle/world): totalTroops(), bestTroopTier(), applyTroopLosses().
import { game, mutate, type GameState } from '../core/store';
import type { Cost, CurrencyId } from '../core/types';
import { bonusMult } from '../core/bonuses';
import { canAfford, spendIn } from '../core/economy';
import { emit } from '../core/events';
import { now } from '../core/tick';
import { hospitalCapacity, maxTrainTier, trainBatchSize, troopCapacity } from './buildings';
import { HEAL_COST_FACTOR, HEAL_TIME_FACTOR, MAX_TIER, troopTier } from '../data/troops';
import { buildingName } from '../data/buildings';

export function totalTroops(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.meta.troops)) n += v;
  return n;
}

/** Highest tier with at least one ready soldier (1 if none). */
export function bestTroopTier(s: GameState): number {
  let best = 1;
  for (const [t, v] of Object.entries(s.meta.troops)) if (v > 0 && Number(t) > best) best = Number(t);
  return best;
}

export function totalWounded(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.meta.wounded)) n += v;
  return n;
}

/** Soldiers currently in training across all barracks. */
export function troopsInTraining(s: GameState): number {
  return s.meta.training.reduce((n, j) => n + j.count, 0);
}

/** Soldiers currently being healed. */
export function troopsInHealing(s: GameState): number {
  const h = s.meta.healing;
  if (!h) return 0;
  return Object.values(h.troops).reduce((a, b) => a + b, 0);
}

/**
 * Splits `count` losses over the tiers that fought (`from`: tier -> soldiers deployed), proportionally to how
 * many of each tier were deployed (largest remainder), never more than deployed. Returns tier -> losses.
 */
export function lossesByTier(count: number, from: Record<number, number>): Record<number, number> {
  const tiers = Object.entries(from)
    .map(([t, n]) => ({ t: Number(t), n: Math.max(0, Math.floor(n ?? 0)) }))
    .filter((x) => x.n > 0);
  const total = tiers.reduce((a, x) => a + x.n, 0);
  const want = Math.min(Math.floor(count), total);
  const out: Record<number, number> = {};
  if (want <= 0 || total <= 0) return out;
  let given = 0;
  const rem: { t: number; r: number; n: number }[] = [];
  for (const x of tiers) {
    const exact = (want * x.n) / total;
    const k = Math.min(x.n, Math.floor(exact));
    out[x.t] = k;
    given += k;
    rem.push({ t: x.t, r: exact - k, n: x.n });
  }
  // Hand out the rest by largest remainder (ties: higher tier first — they stood in front).
  rem.sort((a, b) => b.r - a.r || b.t - a.t);
  for (let i = 0; given < want && i < rem.length * 2; i++) {
    const x = rem[i % rem.length];
    if ((out[x.t] ?? 0) < x.n) {
      out[x.t] = (out[x.t] ?? 0) + 1;
      given++;
    }
  }
  return out;
}

/**
 * Moves `count` soldiers from ready to wounded. Call inside mutate() after a lost/costly battle.
 * Losses come from the tiers that actually fought: pass `from` (tier -> soldiers deployed, e.g. the squad's
 * troop allocation) to take them proportionally from those tiers; without it (or for any remainder) they are
 * taken highest tier first, mirroring how squads are filled (troopAllocation sends the highest tiers first).
 * Wounded beyond the free hospital capacity die. Returns what happened.
 */
export function applyTroopLosses(s: GameState, count: number, from?: Record<number, number>): { wounded: number; died: number } {
  let left = Math.floor(count);
  let room = Math.max(0, hospitalCapacity(s) - totalWounded(s) - troopsInHealing(s));
  let wounded = 0;
  let died = 0;
  const lose = (t: number, n: number) => {
    const take = Math.min(n, left, Math.max(0, Math.floor(s.meta.troops[t] ?? 0)));
    if (take <= 0) return;
    s.meta.troops[t] -= take;
    const toHospital = Math.min(take, room);
    if (toHospital > 0) s.meta.wounded[t] = (s.meta.wounded[t] ?? 0) + toHospital;
    room -= toHospital;
    wounded += toHospital;
    died += take - toHospital;
    left -= take;
  };
  if (from) {
    const split = lossesByTier(left, from);
    for (const [t, n] of Object.entries(split).sort((a, b) => Number(b[0]) - Number(a[0]))) lose(Number(t), n);
  }
  if (left > 0) {
    const tiers = Object.keys(s.meta.troops)
      .map(Number)
      .sort((a, b) => b - a);
    for (const t of tiers) {
      if (left <= 0) break;
      lose(t, left);
    }
  }
  if (died > 0) s.stats.troopsDied = (s.stats.troopsDied ?? 0) + died;
  if (wounded > 0) s.stats.troopsWounded = (s.stats.troopsWounded ?? 0) + wounded;
  return { wounded, died };
}

/** Power of all ready soldiers (registered as power provider 'troops'). Same per-soldier table as combat. */
export function troopsPower(s: GameState): number {
  let p = 0;
  for (const [t, v] of Object.entries(s.meta.troops)) if (v > 0) p += v * troopTier(Number(t)).power;
  return Math.floor(p);
}

// ---------------- Training ----------------

export function scaleCost(cost: Cost, n: number, factor = 1): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(cost) as [CurrencyId, number][]) {
    const x = Math.ceil(v * n * factor);
    if (x > 0) out[k] = x;
  }
  return out;
}

export function trainCost(tier: number, count: number): Cost {
  return scaleCost(troopTier(tier).cost, count);
}

export function trainDurationMs(s: GameState, tier: number, count: number): number {
  const base = troopTier(tier).trainSec * count * 1000;
  return Math.max(1000, Math.round(base / bonusMult(s, 'train_speed_pct')));
}

/** Free drill-ground space (ready + in-training soldiers count against capacity). */
export function troopRoom(s: GameState): number {
  return Math.max(0, troopCapacity(s) - totalTroops(s) - troopsInTraining(s));
}

export function trainingJobFor(s: GameState, barracksUid: string) {
  return s.meta.training.find((j) => j.barracksUid === barracksUid) ?? null;
}

// ---------------- Healing ----------------

export function healCost(troops: Record<number, number>): Cost {
  const out: Cost = {};
  for (const [t, n] of Object.entries(troops)) {
    const c = scaleCost(troopTier(Number(t)).cost, n, HEAL_COST_FACTOR);
    for (const [k, v] of Object.entries(c) as [CurrencyId, number][]) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function healDurationMs(s: GameState, troops: Record<number, number>): number {
  let sec = 0;
  for (const [t, n] of Object.entries(troops)) sec += troopTier(Number(t)).trainSec * n * HEAL_TIME_FACTOR;
  return Math.max(1000, Math.round((sec * 1000) / bonusMult(s, 'heal_speed_pct')));
}

/** Picks `count` wounded soldiers to heal, highest tiers first. */
export function pickWounded(s: GameState, count: number): Record<number, number> {
  const out: Record<number, number> = {};
  let left = count;
  for (let t = MAX_TIER; t >= 1 && left > 0; t--) {
    const n = Math.min(left, s.meta.wounded[t] ?? 0);
    if (n > 0) {
      out[t] = n;
      left -= n;
    }
  }
  return out;
}

// ---------------- Actions & tickers ----------------

/**
 * Starts a training batch at a barracks. Returns an error message, or null on success.
 * The batch is trimmed to the free drill-ground space (and the barracks batch size); it only fails when
 * there is no room at all.
 */
export function startTraining(barracksUid: string, tier: number, count: number): string | null {
  const s = game;
  count = Math.floor(count);
  if (count <= 0) return 'Choose how many soldiers to train';
  if (tier > maxTrainTier(s)) return 'Upgrade the Barracks to train this tier';
  if (trainingJobFor(s, barracksUid)) return 'This Barracks is already training';
  const room = troopRoom(s);
  if (room <= 0) return `${buildingName('drill')} is full — upgrade it to house more soldiers`;
  count = Math.min(count, room, trainBatchSize(s, barracksUid));
  if (count <= 0) return 'Batch too large for this Barracks';
  const cost = trainCost(tier, count);
  if (!canAfford(s, cost)) return 'Not enough resources';
  mutate((st) => {
    spendIn(st, cost);
    const t = now();
    st.meta.training.push({ barracksUid, tier, count, startedAt: t, endsAt: t + trainDurationMs(st, tier, count) });
  });
  return null;
}

/** Starts healing up to `count` wounded soldiers (highest tiers first). Returns an error or null. */
export function startHealing(hospitalUid: string, count: number): string | null {
  const s = game;
  if (s.meta.healing) return 'Already healing soldiers';
  const troops = pickWounded(s, Math.floor(count));
  if (!Object.keys(troops).length) return 'No wounded soldiers';
  const cost = healCost(troops);
  if (!canAfford(s, cost)) return 'Not enough resources';
  mutate((st) => {
    spendIn(st, cost);
    for (const [tier, n] of Object.entries(troops)) {
      const k = Number(tier);
      st.meta.wounded[k] = Math.max(0, (st.meta.wounded[k] ?? 0) - n);
    }
    const t = now();
    st.meta.healing = { hospitalUid, troops, startedAt: t, endsAt: t + healDurationMs(st, troops) };
  });
  return null;
}

/** 1 Hz: completes finished training batches and heals. Events fire right after the tick's mutate. */
export function troopsTicker(s: GameState, t: number): boolean {
  let changed = false;
  if (s.meta.training.length) {
    const done = s.meta.training.filter((j) => j.endsAt <= t);
    if (done.length) {
      s.meta.training = s.meta.training.filter((j) => j.endsAt > t);
      for (const j of done) {
        s.meta.troops[j.tier] = (s.meta.troops[j.tier] ?? 0) + j.count;
        queueMicrotask(() => emit('troops:trained', { tier: j.tier, count: j.count }));
      }
      changed = true;
    }
  }
  const h = s.meta.healing;
  if (h && h.endsAt <= t) {
    let n = 0;
    for (const [tier, c] of Object.entries(h.troops)) {
      const k = Number(tier);
      s.meta.troops[k] = (s.meta.troops[k] ?? 0) + c;
      n += c;
    }
    s.meta.healing = null;
    queueMicrotask(() => emit('troops:healed', { count: n }));
    changed = true;
  }
  return changed;
}
