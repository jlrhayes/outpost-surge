// OWNER: world agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
//   worldEntity / hordeInfo  { id }   bottom-sheet info panel for a map entity ('base' = own outpost)
//   worldMarch               { id }   march details (recall / speed up)
//   radar                    —        radar mission board
//   worldReports             —        battle & gathering reports (with replays)
//   worldSearch              —        find the nearest horde / resource tile of a level
//   worldStamina             —        stamina status + potions
import type { ComponentType } from 'preact';
import { EntitySheet, MarchSheet } from './sheets';
import { RadarScreen, ReportsScreen, SearchModal, StaminaModal } from './panels';

export const worldScreens: Record<string, ComponentType<any>> = {
  worldEntity: EntitySheet,
  hordeInfo: EntitySheet,
  worldMarch: MarchSheet,
  radar: RadarScreen,
  worldReports: ReportsScreen,
  worldSearch: SearchModal,
  worldStamina: StaminaModal,
};
