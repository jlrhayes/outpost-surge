// OWNER: heroes agent. Shared pieces for hero screens: hero cards, reward lists, power tags.
import type { ComponentChildren } from 'preact';
import type { Reward } from '../../core/types';
import { fmt } from '../../core/format';
import { Icon } from '../components/Icon';
import { heroDef } from '../../data/heroes';
import type { HeroState } from '../../state/heroes';
import { heroPower, UNLOCK_SHARDS } from '../../systems/heroes';
import { HeroPortrait } from './HeroPortrait';
import { ItemIcon, Stars, TypeIcon } from './icons';

export function PowerTag(props: { value: number; class?: string; big?: boolean }) {
  return (
    <span class={'power-tag ' + (props.big ? 'big ' : '') + (props.class ?? '')}>
      <Icon name="power" size={props.big ? 20 : 14} />
      {fmt(props.value)}
    </span>
  );
}

export function HeroCard(props: {
  heroId: string;
  hero?: HeroState;
  onClick?: () => void;
  selected?: boolean;
  dot?: boolean;
  badge?: ComponentChildren;
  pendingShards?: number;
  size?: number;
  compact?: boolean;
}) {
  const d = heroDef(props.heroId);
  if (!d) return null;
  const h = props.hero;
  const size = props.size ?? 84;
  return (
    <button
      class={`hero-card rar-${d.rarity} ${props.selected ? 'selected' : ''} ${h ? '' : 'unowned'} ${props.compact ? 'compact' : ''}`}
      style={{ width: size + 'px' }}
      onClick={props.onClick}
    >
      <HeroPortrait heroId={d.id} size={size} frame dim={!h} />
      <span class="hc-type">
        <TypeIcon type={d.type} size={props.compact ? 14 : 18} />
      </span>
      <span class={`hc-rarity rarity-${d.rarity}`}>{d.rarity}</span>
      {h && <span class="hc-level">Lv{h.level}</span>}
      {h && !props.compact && (
        <span class="hc-stars">
          <Stars n={h.stars} size={9} />
        </span>
      )}
      <span class="hc-name">{d.callsign}</span>
      {h && !props.compact && (
        <span class="hc-power">
          <Icon name="power" size={10} />
          {fmt(heroPower(h))}
        </span>
      )}
      {!h && (
        <span class="hc-shards">
          <ItemIcon id="shard" size={10} />
          {props.pendingShards ?? 0}/{UNLOCK_SHARDS}
        </span>
      )}
      {props.badge && <span class="hc-badge">{props.badge}</span>}
      {props.dot && <span class="badge-dot" />}
    </button>
  );
}

/** Compact display of a Reward (currencies, items, hero shards, heroes, troops). */
export function RewardList(props: { reward: Reward; size?: number; class?: string }) {
  const r = props.reward;
  const s = props.size ?? 22;
  const cells: ComponentChildren[] = [];
  for (const [k, v] of Object.entries(r.currencies ?? {})) {
    if (!v) continue;
    cells.push(
      <div class="rw-cell" key={'c' + k}>
        <Icon name={k} size={s} />
        <span>{fmt(v)}</span>
      </div>,
    );
  }
  for (const [k, v] of Object.entries(r.items ?? {})) {
    if (!v) continue;
    cells.push(
      <div class="rw-cell" key={'i' + k}>
        <ItemIcon id={k} size={s} />
        <span>×{fmt(v)}</span>
      </div>,
    );
  }
  for (const [id, v] of Object.entries(r.heroShards ?? {})) {
    cells.push(
      <div class="rw-cell rw-hero" key={'s' + id}>
        <HeroPortrait heroId={id} size={s + 6} frame />
        <span>
          <ItemIcon id="shard" size={11} />×{v}
        </span>
      </div>,
    );
  }
  for (const id of r.heroes ?? []) {
    cells.push(
      <div class="rw-cell rw-hero" key={'h' + id}>
        <HeroPortrait heroId={id} size={s + 6} frame />
        <span>Hero</span>
      </div>,
    );
  }
  for (const [tier, n] of Object.entries(r.troops ?? {})) {
    cells.push(
      <div class="rw-cell" key={'t' + tier}>
        <Icon name="troops" size={s} />
        <span>
          T{tier} ×{n}
        </span>
      </div>,
    );
  }
  return <div class={'reward-list ' + (props.class ?? '')}>{cells}</div>;
}

export function StatRow(props: { label: string; value: ComponentChildren; icon?: ComponentChildren }) {
  return (
    <div class="stat-row">
      <span class="stat-label">
        {props.icon}
        {props.label}
      </span>
      <span class="stat-value">{props.value}</span>
    </div>
  );
}
