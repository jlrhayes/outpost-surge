// Player-facing "why is this locked" text for features, using the base module's building name for the HQ
// ("Requires Command Post Lv 4") so HUD toasts match the building panels.
import { UNLOCKS, type Feature } from '../../core/unlocks';
import { buildingName } from '../../data/buildings';

export function lockHint(f: Feature): string {
  const r = UNLOCKS[f];
  const parts: string[] = [];
  if (r.hq) parts.push(`${buildingName('hq')} Lv ${r.hq}`);
  if (r.districts) parts.push(`${r.districts} district${r.districts > 1 ? 's' : ''} cleared`);
  return parts.length ? `Requires ${parts.join(' & ')}` : '';
}
