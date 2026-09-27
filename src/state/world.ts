// OWNER: world agent. World-map slice. Extend freely.
// Entity/march/report shapes are defined in src/systems/world.ts (type-only import, no runtime cycle).
import type { AllyState, March, RadarState, RaidState, WorldEntity, WorldReport } from '../systems/world';

export interface WorldState {
  seed: number;
  /** Stamina as of `staminaAt` (the world ticker settles regen into this every few minutes). */
  stamina: number;
  /** Timestamp stamina was last recalculated (regen accrues from here). */
  staminaAt: number;
  /** Highest zombie horde level defeated (unlocks the next level). */
  maxHordeLevel: number;
  /** Generated map entities and active marches; shape owned by src/systems/world.ts. */
  entities: WorldEntity[];
  marches: March[];
  /** Entity generator version the current map was created with (regenerates on mismatch). */
  genVersion: number;
  /** Counter for entity/march/report ids. */
  nextId: number;
  /** Battle / gathering reports, newest first. */
  reports: WorldReport[];
  radar: RadarState;
  /** Last time hordes/resources were topped up. */
  lastMaintain: number;
  /** Free stamina claims: timestamp each claim slot is ready again (<= now = ready). */
  staminaClaims: number[];
  /** Rival raids on the player's outpost (schedule, announced raid, shield). */
  raid: RaidState;
  /** AI alliance: daily pool of build helps. */
  allies: AllyState;
}

export function defaultWorldState(now: number): WorldState {
  return {
    seed: Math.floor(Math.random() * 1e9),
    stamina: 120,
    staminaAt: now,
    maxHordeLevel: 0,
    entities: [],
    marches: [],
    genVersion: 0,
    nextId: 1,
    reports: [],
    radar: { missions: [], refreshAt: 0, level: 1, completed: 0 },
    lastMaintain: 0,
    staminaClaims: [0, 0],
    raid: { nextAt: 0, incoming: null, shieldUntil: 0, defended: 0, lost: 0 },
    allies: { day: '', used: 0, helped: {} },
  };
}
