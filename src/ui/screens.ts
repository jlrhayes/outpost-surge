// Merges per-module screen registries. Modules add screens in THEIR OWN registry file, not here.
import type { ComponentType } from 'preact';
import { baseScreens } from '../modes/base/screens';
import { heroScreens } from './heroes/screens';
import { worldScreens } from '../modes/world/screens';
import { runnerScreens } from '../modes/runner/screens';
import { metaScreens } from './meta/screens';

export const SCREENS: Record<string, ComponentType<any>> = {
  ...metaScreens,
  ...baseScreens,
  ...heroScreens,
  ...worldScreens,
  ...runnerScreens,
};
