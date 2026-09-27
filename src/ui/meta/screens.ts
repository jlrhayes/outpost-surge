// OWNER: meta agent. Overlay screens this module provides, keyed by id for openScreen(id, props).
import type { ComponentType } from 'preact';
import './meta.css';
import { RewardsScreen } from './RewardsScreen';
import { SpeedupScreen } from './SpeedupScreen';
import { BagScreen } from './BagScreen';
import { QuestsScreen } from './QuestsScreen';
import { DailyScreen } from './DailyScreen';
import { ResearchScreen } from './ResearchScreen';
import { BarracksScreen } from './BarracksScreen';
import { HospitalScreen } from './HospitalScreen';
import { SettingsScreen } from './SettingsScreen';
import { ConfirmModal } from '../components/ConfirmModal';
import { WelcomeBackScreen } from '../hud/WelcomeBack';

export const metaScreens: Record<string, ComponentType<any>> = {
  rewards: RewardsScreen,
  speedup: SpeedupScreen,
  bag: BagScreen,
  quests: QuestsScreen,
  daily: DailyScreen,
  research: ResearchScreen,
  barracks: BarracksScreen,
  hospital: HospitalScreen,
  settings: SettingsScreen,
  /** Generic yes/no dialog: openScreen('confirm', { title, text, onConfirm, ... }) — see ConfirmModal.tsx. */
  confirm: ConfirmModal,
  welcomeBack: WelcomeBackScreen,
};
