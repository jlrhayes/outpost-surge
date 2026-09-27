// OWNER: base agent. Side-effect registrations for this module, imported once at startup:
// registerTicker(...), registerBonusProvider(...), registerPowerProvider(...), on('event', ...).
import { registerTicker } from '../core/tick';
import { registerBonusProvider, registerPowerProvider } from '../core/bonuses';
import { emit, on } from '../core/events';
import { toast } from '../core/nav';
import { sfx } from '../core/audio';
import { game } from '../core/store';
import { buildingBonuses, buildingsPower, completeDueIn, maxCount } from '../systems/buildings';
import { BUILDING_TYPES, buildingName } from '../data/buildings';
import type { BuildingType } from '../core/types';

// Completes finished upgrades/constructions (also after offline time: timers are absolute).
registerTicker('buildings', (s, t) => {
  const done = completeDueIn(s, t);
  if (!done.length) return false;
  // Events must fire after the state change is published (runTickers mutates right after us).
  queueMicrotask(() => {
    for (const d of done) emit('building:upgraded', d);
  });
  return true;
});

registerBonusProvider('buildings', (s) => buildingBonuses(s));
registerPowerProvider('buildings', (s) => buildingsPower(s));

// Feedback for finished jobs, wherever the player is.
let lastCounts: Partial<Record<BuildingType, number>> | null = null;
function snapshotCounts() {
  const out: Partial<Record<BuildingType, number>> = {};
  for (const t of BUILDING_TYPES) out[t] = maxCount(game, t);
  return out;
}

/** Toasts building types whose allowed count just went up (new building or an extra copy). */
function announceUnlocks(delay: number) {
  const before = lastCounts ?? {};
  const after = snapshotCounts();
  const fresh = BUILDING_TYPES.filter((t) => (after[t] ?? 0) > (before[t] ?? 0));
  if (fresh.length) setTimeout(() => toast(`Now buildable: ${fresh.map(buildingName).join(', ')}`, 'info'), delay);
  lastCounts = after;
}

on('building:upgraded', ({ type, level }) => {
  sfx.upgrade();
  toast(level === 1 ? `${buildingName(type)} built!` : `${buildingName(type)} reached Lv ${level}`, 'good');
  if (type === 'hq') announceUnlocks(700);
});

on('campaign:stageCleared', () => announceUnlocks(1500));

// Record unlock counts once the game has loaded so HQ upgrades can announce new buildings.
queueMicrotask(() => {
  lastCounts = snapshotCounts();
});
