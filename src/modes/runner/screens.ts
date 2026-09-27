// OWNER: runner agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';
import { RunnerLevels } from './LevelSelect';

export const runnerScreens: Record<string, ComponentType<any>> = {
  /** Special Ops level select. Props: none. */
  runnerLevels: RunnerLevels,
};
