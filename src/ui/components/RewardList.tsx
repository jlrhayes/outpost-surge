// Renders any Reward as a row/grid of framed tiles. OWNER: meta agent.
import type { Reward } from '../../core/types';
import { RewardTile, type RewardEntry } from './ItemIcon';

/** Flattens a Reward into display entries (currencies first, then items, troops, shards, heroes). */
export function rewardEntries(r: Reward): RewardEntry[] {
  const out: RewardEntry[] = [];
  for (const id of ['diamonds', 'gold', 'food', 'iron', 'heroExp']) {
    const v = r.currencies?.[id as keyof NonNullable<Reward['currencies']>];
    if (v) out.push({ kind: 'currency', id, amount: v });
  }
  for (const [id, v] of Object.entries(r.currencies ?? {})) {
    if (v && !['diamonds', 'gold', 'food', 'iron', 'heroExp'].includes(id)) out.push({ kind: 'currency', id, amount: v });
  }
  for (const id of r.heroes ?? []) out.push({ kind: 'hero', id });
  for (const [id, v] of Object.entries(r.items ?? {})) if (v) out.push({ kind: 'item', id, amount: v });
  for (const [t, v] of Object.entries(r.troops ?? {})) if (v) out.push({ kind: 'troops', tier: Number(t), amount: v });
  for (const [id, v] of Object.entries(r.heroShards ?? {})) if (v) out.push({ kind: 'shards', id, amount: v });
  return out;
}

export function RewardList(props: {
  reward: Reward;
  size?: number;
  /** Show names under tiles. */
  labels?: boolean;
  /** Staggered pop-in animation. */
  animate?: boolean;
  /** Centre the tiles (default true). */
  center?: boolean;
  class?: string;
}) {
  const entries = rewardEntries(props.reward);
  return (
    <div class={'reward-list ' + (props.center === false ? '' : 'center ') + (props.class ?? '')}>
      {entries.map((e, i) => (
        <RewardTile
          key={i}
          entry={e}
          size={props.size ?? 56}
          label={props.labels}
          class={props.animate ? 'pop-in' : ''}
          style={props.animate ? { animationDelay: 0.12 + i * 0.07 + 's' } : undefined}
        />
      ))}
    </div>
  );
}

/** Compact inline reward (icon + number), for tight spaces like the quest tracker. */
export function RewardInline(props: { reward: Reward; max?: number }) {
  const entries = rewardEntries(props.reward).slice(0, props.max ?? 3);
  return (
    <span class="reward-inline">
      {entries.map((e, i) => (
        <RewardTile key={i} entry={e} size={30} />
      ))}
    </span>
  );
}
