// Per-mode HUD components (rendered above the 3D canvas). Each file is owned by that mode's agent.
import type { ComponentType } from 'preact';
import type { ModeId } from '../core/types';
import { BaseModeHud } from './base/BaseModeHud';
import { WorldHud } from './world/WorldHud';
import { RunnerHud } from './runner/RunnerHud';
import { BattleHud } from './battle/BattleHud';

export const HUDS: Record<ModeId, ComponentType<{ params?: any }>> = {
  base: BaseModeHud,
  world: WorldHud,
  runner: RunnerHud,
  battle: BattleHud,
};
