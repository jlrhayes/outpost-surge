// OWNER: world agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';

export const worldScreens: Record<string, ComponentType<any>> = {};
