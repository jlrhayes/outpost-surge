// OWNER: meta agent. 'featureUnlocked' popup: "New feature unlocked!" with icon, one-line pitch and a Go button.
// Opened once per feature by the unlock watcher in src/init/meta.ts. Props: { features: Feature[] }.
import { useEffect } from 'preact/hooks';
import type { Feature } from '../../core/unlocks';
import { UNLOCKS } from '../../core/unlocks';
import { closeScreen, goTo, openScreen } from '../../core/nav';
import { sfx } from '../../core/audio';
import { questGo } from '../../systems/quests';
import { Btn } from '../components/common';
import { Icon } from '../components/Icon';

interface FeatureInfo {
  icon: string;
  text: string;
  go: () => void;
}

export const FEATURE_INFO: Partial<Record<Feature, FeatureInfo>> = {
  runner: {
    icon: 'truck',
    text: 'Lead your squad through gate runs: surviving soldiers join your army.',
    go: () => openScreen('runnerLevels'),
  },
  daily: {
    icon: 'calendar',
    text: 'Finish daily tasks to fill five reward chests every day.',
    go: () => openScreen('daily'),
  },
  recruit: {
    icon: 'ticket',
    text: 'Recruit new heroes with tickets or diamonds, plus a free pull every day.',
    go: () => openScreen('recruit'),
  },
  world: {
    icon: 'globe',
    text: 'Leave the outpost to hunt zombie hordes and gather resources.',
    go: () => goTo('world'),
  },
  radar: {
    icon: 'target',
    text: 'Scout missions on the world map for free loot and survivor rescues.',
    go: () => {
      goTo('world');
      openScreen('radar');
    },
  },
  research: {
    icon: 'flask',
    text: 'Research permanent bonuses for combat, economy and building speed.',
    go: () => questGo({ kind: 'research' }),
  },
  squad2: { icon: 'formation', text: 'Field a second squad of five heroes.', go: () => openScreen('formation', { squadId: 2 }) },
  squad3: { icon: 'formation', text: 'Field a third squad of five heroes.', go: () => openScreen('formation', { squadId: 3 }) },
  squad4: { icon: 'formation', text: 'Field a fourth squad of five heroes.', go: () => openScreen('formation', { squadId: 4 }) },
};

export function FeatureUnlockScreen(props: { features: Feature[]; screenKey: number }) {
  useEffect(() => {
    sfx.win();
  }, []);
  const close = () => closeScreen(props.screenKey);
  const list = props.features.filter((f) => FEATURE_INFO[f]);
  return (
    <div class="modal-backdrop fu-backdrop" onClick={close}>
      <div class="modal fu-modal" onClick={(e) => e.stopPropagation()}>
        <div class="fu-rays" />
        <div class="fu-ribbon">{list.length > 1 ? 'New Features Unlocked!' : 'New Feature Unlocked!'}</div>
        <div class="fu-list">
          {list.map((f) => {
            const info = FEATURE_INFO[f]!;
            return (
              <div class="fu-row" key={f}>
                <span class="fu-icon">
                  <Icon name={info.icon} size={40} />
                </span>
                <div class="fu-main">
                  <div class="fu-name">{UNLOCKS[f].label}</div>
                  <div class="fu-text">{info.text}</div>
                </div>
                <Btn
                  color="green"
                  onClick={() => {
                    close();
                    info.go();
                  }}
                >
                  Go
                </Btn>
              </div>
            );
          })}
        </div>
        <Btn color="gray" small class="fu-later" onClick={close}>
          Later
        </Btn>
      </div>
    </div>
  );
}
