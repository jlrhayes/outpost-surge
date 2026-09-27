// OWNER: meta agent. Using items from the bag, speed-up planning and diamond instant-finish pricing.
import { game, mutate, type GameState } from '../core/store';
import type { ItemId, Reward } from '../core/types';
import { consumeItemIn, grantIn } from '../core/economy';
import { emit } from '../core/events';
import { openScreen, toast } from '../core/nav';
import { sfx } from '../core/audio';
import { fmt } from '../core/format';
import { itemDef, SPEEDUP_IDS } from '../data/items';

export function scaleReward(r: Reward, n: number): Reward {
  const out: Reward = {};
  if (r.currencies) out.currencies = Object.fromEntries(Object.entries(r.currencies).map(([k, v]) => [k, (v ?? 0) * n]));
  if (r.items) out.items = Object.fromEntries(Object.entries(r.items).map(([k, v]) => [k, (v ?? 0) * n]));
  if (r.troops) out.troops = Object.fromEntries(Object.entries(r.troops).map(([k, v]) => [k, v * n]));
  if (r.heroShards) out.heroShards = Object.fromEntries(Object.entries(r.heroShards).map(([k, v]) => [k, v * n]));
  if (r.heroes) out.heroes = [...r.heroes];
  return out;
}

const CURRENCY_LABEL: Record<string, string> = { food: 'Food', iron: 'Iron', gold: 'Gold', diamonds: 'Diamonds', heroExp: 'Hero EXP' };

/** Short one-line description of a reward: "+500 Food, +500 Iron, 2× 5-Min Speed-Up". */
export function rewardSummary(r: Reward): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(r.currencies ?? {})) if (v) parts.push(`+${fmt(v)} ${CURRENCY_LABEL[k] ?? k}`);
  for (const [k, v] of Object.entries(r.items ?? {})) if (v) parts.push(`${v}× ${itemDef(k).name}`);
  for (const [t, v] of Object.entries(r.troops ?? {})) if (v) parts.push(`${fmt(v)} T${t} soldiers`);
  const shards = Object.values(r.heroShards ?? {}).reduce((a, b) => a + b, 0);
  if (shards) parts.push(`${shards} hero shards`);
  if (r.heroes?.length) parts.push(`${r.heroes.length} hero${r.heroes.length > 1 ? 'es' : ''}`);
  return parts.join(', ');
}

/** Uses `count` of an item from the bag. Shows the reward popup / toast. Returns true on success. */
export function useItem(id: ItemId, count = 1): boolean {
  const def = itemDef(id);
  const use = def.use;
  count = Math.floor(count);
  if (!use || count <= 0) return false;
  if ((game.items[id] ?? 0) < count) {
    toast('Not enough items', 'bad');
    return false;
  }
  const out: { summary?: string } = {};
  const reward = use.reward ? scaleReward(use.reward, count) : null;
  mutate((s) => {
    if (!consumeItemIn(s, id, count)) return;
    if (reward) grantIn(s, reward);
    if (use.apply) out.summary = use.apply(s, count) || undefined;
  });
  emit('item:used', { itemId: id, count });
  sfx.reward();
  if (reward) openScreen('rewards', { title: `${def.name} ×${count}`, reward });
  else toast(out.summary ?? `Used ${def.name} ×${count}`, 'good');
  return true;
}

// ---------------- Speed-ups ----------------

export function speedupMs(id: ItemId): number {
  return itemDef(id).speedupMs ?? 0;
}

/** Speed-up item ids, smallest first. */
export function speedupIds(): ItemId[] {
  return [...SPEEDUP_IDS].sort((a, b) => speedupMs(a) - speedupMs(b));
}

/**
 * Chooses speed-up items to cover `remainingMs` with little waste: largest items that fit fully first,
 * then the smallest single item that covers the rest (or everything left if nothing covers it).
 */
export function planSpeedups(s: GameState, remainingMs: number): { plan: Partial<Record<ItemId, number>>; totalMs: number } {
  const ids = speedupIds();
  const avail: Record<string, number> = {};
  for (const id of ids) avail[id] = s.items[id] ?? 0;
  const plan: Partial<Record<ItemId, number>> = {};
  let left = remainingMs;
  let total = 0;
  const take = (id: ItemId, n: number) => {
    if (n <= 0) return;
    plan[id] = (plan[id] ?? 0) + n;
    avail[id] -= n;
    left -= n * speedupMs(id);
    total += n * speedupMs(id);
  };
  for (const id of [...ids].reverse()) {
    const size = speedupMs(id);
    take(id, Math.min(avail[id], Math.floor(left / size)));
  }
  if (left > 0) {
    const cover = ids.find((id) => avail[id] > 0 && speedupMs(id) >= left);
    if (cover) take(cover, 1);
    else for (const id of ids) while (left > 0 && avail[id] > 0) take(id, 1);
  }
  return { plan, totalMs: total };
}

/** Consumes speed-up items (inside mutate) and returns the total ms they remove. */
export function consumeSpeedupsIn(s: GameState, plan: Partial<Record<ItemId, number>>): number {
  let ms = 0;
  for (const [id, n] of Object.entries(plan)) {
    if (!n) continue;
    if (consumeItemIn(s, id, n)) ms += n * speedupMs(id);
  }
  return ms;
}

/** Diamonds needed to finish `ms` instantly (genre-style curve: ~1/min early, cheaper per minute for long timers). */
export function instantFinishCost(ms: number): number {
  if (ms <= 0) return 0;
  const min = ms / 60_000;
  return Math.max(1, Math.ceil(Math.pow(min, 0.88) * 0.9));
}
