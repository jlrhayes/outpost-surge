// Mode factories for the engine. Modes are created lazily on first visit.
import type { ModeFactory } from '../three/engine';
import type { ModeId } from '../core/types';
import { BaseMode } from './base/BaseMode';
import { WorldMode } from './world/WorldMode';
import { RunnerMode } from './runner/RunnerMode';
import { BattleMode } from './battle/BattleMode';

export const modeFactories: Record<ModeId, ModeFactory> = {
  base: () => new BaseMode(),
  world: () => new WorldMode(),
  runner: () => new RunnerMode(),
  battle: () => new BattleMode(),
};
