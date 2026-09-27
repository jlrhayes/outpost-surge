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
