// Typed global event bus. Systems emit gameplay events; quests/daily tasks/stats listen.
// Add new events to GameEvents (append-only) when you need them.
import type { BuildingType, CurrencyId, ItemId } from './types';

export interface GameEvents {
  'building:upgradeStarted': { uid: string; type: BuildingType; toLevel: number };
  'building:upgraded': { uid: string; type: BuildingType; level: number };
  'resource:collected': { resource: CurrencyId; amount: number };
  'hero:recruited': { heroId: string; count: number };
  'hero:levelUp': { heroId: string; level: number };
  'hero:starUp': { heroId: string; stars: number };
  'squad:changed': { squadId: number };
  'troops:trained': { tier: number; count: number };
  'troops:healed': { count: number };
  'research:done': { techId: string; level: number };
  'runner:finished': { level: number; won: boolean; stars: number };
  'campaign:stageCleared': { stage: number };
  'world:hordeDefeated': { level: number };
  'world:gathered': { resource: CurrencyId; amount: number };
  'zombies:killed': { count: number };
  'item:used': { itemId: ItemId; count: number };
  'speedup:used': { minutes: number };
  'quest:claimed': { questId: string };
  'ui:screenOpened': { id: string };
}

type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;
const handlers: { [K in keyof GameEvents]?: Handler<K>[] } = {};

export function on<K extends keyof GameEvents>(event: K, fn: Handler<K>): () => void {
  const list = (handlers[event] ??= []) as Handler<K>[];
  list.push(fn);
  return () => {
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
}

export function emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
  const list = handlers[event] as Handler<K>[] | undefined;
  if (!list) return;
  for (const fn of [...list]) {
    try {
      fn(payload);
    } catch (e) {
      console.error(`event handler for ${event} failed`, e);
    }
  }
}
