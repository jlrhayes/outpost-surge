// OWNER: base agent. Building-specific action buttons (Train, Heal, Research, Recruit, ...), shared by the
// building panel and the quick-action strip over a selected building.
import type { GameState } from '../../core/store';
import { goTo, openScreen, toast } from '../../core/nav';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import type { BuildingState } from '../../state/base';
import { BUILDINGS } from '../../data/buildings';
import { bubbleThreshold, uncollected } from '../../systems/buildings';
import { doCollect } from './actions';

export interface BuildingAction {
  id: string;
  label: string;
  icon: string;
  color: 'yellow' | 'green' | 'blue' | 'red' | 'gray' | 'purple';
  run: () => void;
  /** Rendered dimmed (still clickable to explain why). */
  locked?: boolean;
}

function gated(feature: Parameters<typeof isUnlocked>[1], s: GameState, run: () => void): { locked: boolean; run: () => void } {
  const ok = isUnlocked(s, feature);
  return { locked: !ok, run: ok ? run : () => toast(unlockHint(feature), 'bad') };
}

export function buildingActions(s: GameState, b: BuildingState): BuildingAction[] {
  if (b.level < 1) return [];
  const out: BuildingAction[] = [];
  switch (b.type) {
    case 'barracks':
      out.push({ id: 'train', label: 'Train', icon: 'troops', color: 'green', run: () => openScreen('barracks', { uid: b.uid }) });
      break;
    case 'hospital':
      out.push({ id: 'heal', label: 'Heal', icon: 'troops', color: 'green', run: () => openScreen('hospital', { uid: b.uid }) });
      break;
    case 'tech':
      out.push({ id: 'research', label: 'Research', icon: 'power', color: 'blue', ...gated('research', s, () => openScreen('research')) });
      break;
    case 'tavern':
      out.push({ id: 'recruit', label: 'Recruit', icon: 'heroExp', color: 'purple', ...gated('recruit', s, () => openScreen('recruit')) });
      break;
    case 'drill':
      out.push({ id: 'formation', label: 'Squads', icon: 'troops', color: 'blue', run: () => openScreen('formation') });
      break;
    case 'radar':
      out.push({ id: 'world', label: 'World', icon: 'stamina', color: 'blue', ...gated('world', s, () => goTo('world')) });
      break;
    case 'trainingbase':
      out.push({ id: 'heroes', label: 'Heroes', icon: 'heroExp', color: 'purple', run: () => openScreen('heroes') });
      break;
    default:
      break;
  }
  const res = BUILDINGS[b.type].produces;
  if (res) {
    const has = uncollected(s, b) >= Math.min(1, bubbleThreshold(s, b));
    out.push({
      id: 'collect',
      label: 'Collect',
      icon: res,
      color: 'yellow',
      locked: !has,
      run: () => {
        if (!doCollect(b.uid)) toast('Nothing to collect yet', 'info');
      },
    });
  }
  return out;
}
