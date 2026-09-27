// OWNER: base agent. Base-building slice of the save game. Extend freely (keep defaults in defaultBaseState).
import type { BuildingType } from '../core/types';

export interface BuildingState {
  /** Unique instance id, e.g. 'farm_1'. */
  uid: string;
  type: BuildingType;
  level: number;
  /** Index of the plot this building occupies on the base layout. */
  plot: number;
  /** Timestamp (ms) when the current upgrade finishes, or null if idle. Level 0 + upgradeEndsAt = under construction. */
  upgradeEndsAt: number | null;
  upgradeStartedAt: number | null;
  /** For producers: timestamp of last collection (production accrues from here, capped by storage). */
  collectedAt: number;
}

export interface BaseState {
  buildings: BuildingState[];
  /** Number of concurrent construction queues. */
  builders: number;
}

export function defaultBaseState(now: number): BaseState {
  return {
    buildings: [
      { uid: 'hq_1', type: 'hq', level: 1, plot: 0, upgradeEndsAt: null, upgradeStartedAt: null, collectedAt: now },
    ],
    builders: 2,
  };
}
