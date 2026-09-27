// OWNER: base agent. Side-effect registrations for this module, imported once at startup:
// registerTicker(...), registerBonusProvider(...), registerPowerProvider(...), on('event', ...).
import { registerTicker } from '../core/tick';
import { registerBonusProvider, registerPowerProvider } from '../core/bonuses';
import { emit, on } from '../core/events';
import { toast } from '../core/nav';
import { sfx } from '../core/audio';
import { game, mutate } from '../core/store';
import { buildingBonuses, buildingsPower, completeDueIn, maxCount } from '../systems/buildings';
import { BUILDINGS, BUILDING_TYPES, PLOTS, START_PLOTS, buildingName } from '../data/buildings';
import type { BuildingType } from '../core/types';

// Save repair: every outpost has exactly one Command Post (plot 0) and one Bulwark Gate (plot 1).
// Older/foreign saves may lack them (the gate cannot be placed from a build menu).
{
  const need: [BuildingType, number][] = [
    ['hq', START_PLOTS.hq],
    ['wall', START_PLOTS.wall],
  ];
  const missing = need.filter(([type]) => !game.base.buildings.some((b) => b.type === type));
  if (missing.length) {
    mutate((s) => {
      for (const [type, plot] of missing) {
        // Free the fixed plot if something else squats on it.
        const other = s.base.buildings.find((b) => b.plot === plot);
        if (other) {
          const kind = BUILDINGS[other.type]?.plot;
          const free = PLOTS.find((p) => p.kind === kind && p.district === 0 && !s.base.buildings.some((b) => b.plot === p.id));
          if (free) other.plot = free.id;
        }
        s.base.buildings.push({ uid: `${type}_1`, type, level: 1, plot, upgradeEndsAt: null, upgradeStartedAt: null, collectedAt: Date.now(), stored: 0 });
      }
    });
  }
}

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
