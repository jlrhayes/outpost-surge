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
  /** For producers: output banked at an older (lower) level, added on top of accrual since collectedAt. */
  stored?: number;
}

export interface BaseState {
  buildings: BuildingState[];
  /** Number of concurrent construction queues. */
  builders: number;
  /** Districts whose "cleared" reveal the player has already seen in the base scene. */
  districtsSeen: number;
}

export function defaultBaseState(now: number): BaseState {
  const b = (uid: string, type: BuildingType, level: number, plot: number, collectedAt = now) => ({
    uid,
    type,
    level,
    plot,
    upgradeEndsAt: null,
    upgradeStartedAt: null,
    collectedAt,
    stored: 0,
  });
  return {
    buildings: [
      b('hq_1', 'hq', 1, 0),
      b('wall_1', 'wall', 1, 1),
      // A farm that has already been growing for a while, so there is food to collect right away.
      b('farm_1', 'farm', 1, 9, now - 25 * 60 * 1000),
      // A marked-out Parade Yard foundation (level 0): the first construction job of the opening.
      b('drill_1', 'drill', 0, 5),
    ],
    builders: 1,
    districtsSeen: 0,
  };
}
