// OWNER: base agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';

export const baseScreens: Record<string, ComponentType<any>> = {};
