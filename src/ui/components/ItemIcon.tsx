// Item / reward tiles with rarity frames. OWNER: meta agent.
//   <ItemTile id="speedup_5m" count={3} />            bag-style tile
//   <RewardTile kind="currency" id="food" amount={500} />
import type { ComponentChildren } from 'preact';
import { fmt } from '../../core/format';
import type { ItemId } from '../../core/types';
import { itemDef, type ItemRarity } from '../../data/items';
import { sfx } from '../../core/audio';
import { Icon } from './Icon';

const CURRENCY_RARITY: Record<string, ItemRarity> = {
  food: 'uncommon',
  iron: 'uncommon',
  gold: 'rare',
  diamonds: 'epic',
  heroExp: 'rare',
};
export const CURRENCY_NAME: Record<string, string> = {
  food: 'Food',
  iron: 'Iron',
  gold: 'Gold',
  diamonds: 'Diamonds',
  heroExp: 'Hero EXP',
};

/** Framed square tile (the visual shell shared by items, currencies, troops and heroes). */
export function Tile(props: {
  icon: string;
  rarity: ItemRarity;
  count?: string;
  tag?: string;
  size?: number;
  label?: string;
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  class?: string;
  style?: any;
  children?: ComponentChildren;
}) {
  const size = props.size ?? 64;
  const inner = (
    <>
      <span class="tile-frame" style={{ width: size + 'px', height: size + 'px' }}>
        <span class="tile-shine" />
        <Icon name={props.icon} size={Math.round(size * 0.62)} />
        {props.tag && <span class="tile-tag">{props.tag}</span>}
        {props.count && <span class="tile-count">{props.count}</span>}
        {props.children}
      </span>
      {props.label && <span class="tile-label">{props.label}</span>}
    </>
  );
  const cls = `tile rarity-${props.rarity} ${props.selected ? 'selected' : ''} ${props.dim ? 'dim' : ''} ${props.class ?? ''}`;
  if (props.onClick)
    return (
      <button
        class={cls}
        style={props.style}
        onClick={(e) => {
          e.stopPropagation();
          sfx.click();
          props.onClick?.();
        }}
      >
        {inner}
      </button>
    );
  return (
    <span class={cls} style={props.style}>
      {inner}
    </span>
  );
}

/** Bag-style tile for an item id. */
export function ItemTile(props: { id: ItemId; count?: number; size?: number; label?: boolean; selected?: boolean; onClick?: () => void; style?: any }) {
  const def = itemDef(props.id);
  return (
    <Tile
      icon={def.icon}
      rarity={def.rarity}
      count={props.count !== undefined ? fmt(props.count) : undefined}
      size={props.size}
      label={props.label ? def.name : undefined}
      selected={props.selected}
      onClick={props.onClick}
      style={props.style}
    />
  );
}

/** Just the icon of an item (no frame). */
export function ItemIcon(props: { id: ItemId; size?: number }) {
  return <Icon name={itemDef(props.id).icon} size={props.size ?? 24} />;
}

/**
 * Optional hook for the heroes module: lets reward tiles show real hero names/rarities
 *   registerHeroLookup(id => ({ name: HEROES[id].name, rarity: HEROES[id].rarity }))
 */
type HeroLookup = (id: string) => { name: string; rarity?: 'SR' | 'SSR' | 'UR'; icon?: string } | undefined;
let heroLookup: HeroLookup | null = null;
export function registerHeroLookup(fn: HeroLookup): void {
  heroLookup = fn;
}
function hero(id: string) {
  try {
    return heroLookup?.(id);
  } catch {
    return undefined;
  }
}
const HERO_RARITY: Record<string, ItemRarity> = { SR: 'rare', SSR: 'epic', UR: 'legendary' };

export type RewardEntry =
  | { kind: 'currency'; id: string; amount: number }
  | { kind: 'item'; id: ItemId; amount: number }
  | { kind: 'troops'; tier: number; amount: number }
  | { kind: 'shards'; id: string; amount: number }
  | { kind: 'hero'; id: string };

export function prettyId(id: string): string {
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function rewardEntryName(e: RewardEntry): string {
  switch (e.kind) {
    case 'currency':
      return CURRENCY_NAME[e.id] ?? prettyId(e.id);
    case 'item':
      return itemDef(e.id).name;
    case 'troops':
      return `T${e.tier} Soldiers`;
    case 'shards':
      return `${hero(e.id)?.name ?? prettyId(e.id)} Shards`;
    case 'hero':
      return hero(e.id)?.name ?? prettyId(e.id);
  }
}

export function RewardTile(props: { entry: RewardEntry; size?: number; label?: boolean; style?: any; class?: string }) {
  const e = props.entry;
  const label = props.label ? rewardEntryName(e) : undefined;
  switch (e.kind) {
    case 'currency':
      return <Tile icon={e.id} rarity={CURRENCY_RARITY[e.id] ?? 'common'} count={fmt(e.amount)} size={props.size} label={label} style={props.style} class={props.class} />;
    case 'item': {
      const d = itemDef(e.id);
      return <Tile icon={d.icon} rarity={d.rarity} count={'×' + fmt(e.amount)} size={props.size} label={label} style={props.style} class={props.class} />;
    }
    case 'troops':
      return <Tile icon="troops" rarity="uncommon" tag={'T' + e.tier} count={fmt(e.amount)} size={props.size} label={label} style={props.style} class={props.class} />;
    case 'shards': {
      const h = hero(e.id);
      const r = HERO_RARITY[h?.rarity ?? 'SSR'] ?? 'epic';
      const icon = r === 'legendary' ? 'shard_ur' : r === 'rare' ? 'shard' : 'shard_ssr';
      return <Tile icon={icon} rarity={r} count={'×' + fmt(e.amount)} size={props.size} label={label} style={props.style} class={props.class} />;
    }
    case 'hero': {
      const h = hero(e.id);
      return (
        <Tile
          icon={h?.icon ?? 'hero'}
          rarity={HERO_RARITY[h?.rarity ?? 'UR'] ?? 'legendary'}
          tag="HERO"
          size={props.size}
          label={label}
          style={props.style}
          class={props.class}
        />
      );
    }
  }
}
