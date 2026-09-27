// OWNER: base agent. Building rules: upgrades, construction queue, production, gating.
// The exported query functions below are a CONTRACT used by other modules — keep their signatures.
import type { GameState } from '../core/store';
import type { BuildingType } from '../core/types';
import type { BuildingState } from '../state/base';

/** Headquarters level (gates most content). */
export function hqLevel(s: GameState): number {
  return buildingLevel(s, 'hq');
}

/** Highest level among buildings of this type (0 if none built). */
export function buildingLevel(s: GameState, type: BuildingType): number {
  let lv = 0;
  for (const b of s.base.buildings) if (b.type === type && b.level > lv) lv = b.level;
  return lv;
}

/** All building instances of a type. */
export function buildingsOf(s: GameState, type: BuildingType): BuildingState[] {
  return s.base.buildings.filter((b) => b.type === type);
}

export function getBuilding(s: GameState, uid: string): BuildingState | undefined {
  return s.base.buildings.find((b) => b.uid === uid);
}

/** Per-hour production of a resource across all producers (after bonuses). */
export function productionPerHour(s: GameState, resource: 'food' | 'iron' | 'gold'): number {
  return 0;
}

// ---- Building-derived capacities (CONTRACT: used by troops/heroes modules; base agent tunes formulas) ----

/** Max ready soldiers the base can house (Drill Grounds). */
export function troopCapacity(s: GameState): number {
  return 200 + buildingsOf(s, 'drill').reduce((n, b) => n + b.level * 150, 0);
}

/** Max wounded soldiers hospitals can hold; overflow dies. */
export function hospitalCapacity(s: GameState): number {
  return buildingsOf(s, 'hospital').reduce((n, b) => n + b.level * 200, 0);
}

/** Highest soldier tier trainable (from Barracks level), 1..10. */
export function maxTrainTier(s: GameState): number {
  const lv = buildingLevel(s, 'barracks');
  return Math.max(1, Math.min(10, Math.ceil(lv / 3)));
}

/** Soldiers per training batch at one barracks. */
export function trainBatchSize(s: GameState, barracksUid?: string): number {
  const b = barracksUid ? getBuilding(s, barracksUid) : undefined;
  const lv = b ? b.level : buildingLevel(s, 'barracks');
  return 20 + lv * 20;
}

/** Soldiers each hero of this type can lead into battle (march size per hero). Includes type-center bonuses. */
export function marchSizePerHero(s: GameState, heroType: 'tank' | 'aircraft' | 'missile'): number {
  const center = heroType === 'tank' ? 'tankcenter' : heroType === 'aircraft' ? 'aircenter' : 'missilecenter';
  return 40 + hqLevel(s) * 20 + buildingLevel(s, center) * 10;
}

/** Remaining time (ms) at or below which a construction can be finished for free. */
export function freeFinishMs(s: GameState): number {
  return 5 * 60 * 1000;
}
