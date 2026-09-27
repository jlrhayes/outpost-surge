// OWNER: runner agent. Gate-runner ("Survival Run") slice. Extend freely.

export interface RunnerState {
  /** Next level to play (1-based). Levels below this are cleared. */
  level: number;
  /** level -> best stars (1-3). */
  stars: Record<number, number>;
  /** Tutorial opening run has been completed. */
  introDone: boolean;
}

export function defaultRunnerState(): RunnerState {
  return { level: 1, stars: {}, introDone: false };
}
