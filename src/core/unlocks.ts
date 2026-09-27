// Feature unlock rules shared by the HUD, quests and each feature's entry points.
// A feature unlocks when ALL its conditions are met. Tune here (lead-owned; ask before changing).
import type { GameState } from './store';
import { hqLevel } from '../systems/buildings';
import { buildingName } from '../data/buildings';

export type Feature =
  | 'campaign' // district-clearing auto-battles around the base
  | 'runner' // Special Ops gate-runner levels
  | 'recruit' // tavern recruitment
  | 'world' // world map
  | 'research' // tech center research
  | 'radar' // radar mission board on the world map
  | 'daily' // daily tasks
  | 'squad2'
  | 'squad3'
  | 'squad4';

interface Rule {
  label: string;
  /** Minimum HQ level. */
  hq?: number;
  /** Minimum number of cleared districts (campaign stages). */
  districts?: number;
}

export const UNLOCKS: Record<Feature, Rule> = {
  campaign: { label: 'Districts' },
  runner: { label: 'Special Ops', hq: 2 },
  recruit: { label: 'Recruitment', districts: 3 },
  daily: { label: 'Daily Tasks', hq: 2 },
  world: { label: 'World Map', hq: 4 },
  radar: { label: 'Radar Missions', hq: 5 },
  research: { label: 'Research', hq: 7 },
  squad2: { label: '2nd Squad', hq: 8 },
  squad3: { label: '3rd Squad', hq: 14 },
  squad4: { label: '4th Squad', hq: 20 },
};

export function districtsCleared(s: GameState): number {
  return Math.max(0, s.heroes.campaign.stage - 1);
}

export function isUnlocked(s: GameState, f: Feature): boolean {
  const r = UNLOCKS[f];
  if (r.hq && hqLevel(s) < r.hq) return false;
  if (r.districts && districtsCleared(s) < r.districts) return false;
  return true;
}

/** Human-readable requirement, e.g. "Requires Command Post Lv 4". */
export function unlockHint(f: Feature): string {
  const r = UNLOCKS[f];
  const parts: string[] = [];
  if (r.hq) parts.push(`${buildingName('hq')} Lv ${r.hq}`);
  if (r.districts) parts.push(`${r.districts} district${r.districts > 1 ? 's' : ''} cleared`);
  return parts.length ? `Requires ${parts.join(' & ')}` : '';
}
