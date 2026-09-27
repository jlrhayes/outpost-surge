// OWNER: base agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';
import { BuildingPanel, BuildersModal } from './BuildingPanel';
import { BuildMenu } from './BuildMenu';

export const baseScreens: Record<string, ComponentType<any>> = {
  buildingPanel: BuildingPanel,
  buildMenu: BuildMenu,
  /** Builder queues: running jobs, speed-ups, hire the 2nd builder. Props: { forUid?: string } */
  baseBuilders: BuildersModal,
};
