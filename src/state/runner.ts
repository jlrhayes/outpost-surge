// OWNER: runner agent. Gate-runner ("Special Ops") slice of the save game. Extend freely.
// Keep this file free of runtime imports (it is loaded by the store); progression logic lives in
// src/modes/runner/progress.ts.

export interface RunnerState {
  /** Next level to play (1-based). Levels below this are cleared. */
  level: number;
  /** level -> best stars (1-3). */
  stars: Record<number, number>;
  /** Tutorial opening run has been completed. */
  introDone: boolean;
  /** level -> most soldiers brought home. */
  best: Record<number, number>;
  /** Lifetime runs started / won (quitting counts as a loss). */
  runs: number;
  wins: number;
  /** Level last selected in the level-select screen (0 = follow progress). */
  lastSelected: number;
  /** Rewarded-replay passes stored (max 5); replays of cleared levels without one pay nothing. */
  passes: number;
  /** Absolute time (ms, `now()`) the next pass arrives; 0 while full. */
  passAt: number;
}

export function defaultRunnerState(): RunnerState {
  return { level: 1, stars: {}, introDone: false, best: {}, runs: 0, wins: 0, lastSelected: 0, passes: 5, passAt: 0 };
}
