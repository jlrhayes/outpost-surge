// OWNER: runner agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';

export const runnerScreens: Record<string, ComponentType<any>> = {};
