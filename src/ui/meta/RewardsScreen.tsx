// OWNER: meta agent. 'rewards' screen: animated "You received" popup. Display only (caller grants first).
import { useEffect } from 'preact/hooks';
import type { Reward } from '../../core/types';
import { closeScreen } from '../../core/nav';
import { sfx } from '../../core/audio';
import { Btn } from '../components/common';
import { RewardList, rewardEntries } from '../components/RewardList';

export function RewardsScreen(props: { title?: string; reward: Reward; screenKey: number }) {
  useEffect(() => {
    sfx.reward();
  }, []);
  const close = () => closeScreen(props.screenKey);
  const n = rewardEntries(props.reward ?? {}).length;
  return (
    <div class="rewards-overlay" onClick={close}>
      <div class="rewards-glow" />
      <div class="rewards-rays" />
      <div class="rewards-content" onClick={(e) => e.stopPropagation()}>
        <div class="rewards-ribbon">
          <span>{props.title ?? 'You Received'}</span>
        </div>
        {props.title && <div class="rewards-sub">You received</div>}
        <RewardList reward={props.reward ?? {}} size={n > 8 ? 58 : 68} labels animate class="rewards-grid" />
        {n === 0 && <div class="rewards-sub">Nothing this time.</div>}
        <Btn color="yellow" big onClick={close} class="rewards-btn">
          Collect
        </Btn>
      </div>
      <div class="rewards-tap">Tap anywhere to continue</div>
    </div>
  );
}
