// OWNER: world agent. World-map slice. Extend freely.

export interface WorldState {
  seed: number;
  stamina: number;
  /** Timestamp stamina was last recalculated (regen accrues from here). */
  staminaAt: number;
  /** Highest zombie horde level defeated (unlocks the next level). */
  maxHordeLevel: number;
  /** Generated map entities and active marches; shape owned by src/systems/world.ts. */
  entities: unknown[];
  marches: unknown[];
}

export function defaultWorldState(now: number): WorldState {
  return {
    seed: Math.floor(Math.random() * 1e9),
    stamina: 100,
    staminaAt: now,
    maxHordeLevel: 0,
    entities: [],
    marches: [],
  };
}
