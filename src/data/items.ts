// OWNER: meta agent. Item definitions: names, icons, bag categories and "use" effects.
// Other modules only grant/consume items by id; unknown ids still show in the bag with a fallback.
import type { GameState } from '../core/store';
import type { ItemId, Reward } from '../core/types';

export type ItemCategory = 'resources' | 'speedups' | 'hero' | 'other';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemUse {
  /** Reward granted per item used. */
  reward?: Reward;
  /** Custom effect for `count` items (inside mutate). Return a short summary for the toast. */
  apply?: (s: GameState, count: number) => string | void;
  /** Button label (default "Use"). */
  label?: string;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  /** Icon registry name (src/ui/components/Icon.tsx). */
  icon: string;
  category: ItemCategory;
  rarity: ItemRarity;
  /** Speed-up items: how much time one item removes from a timer. */
  speedupMs?: number;
  /** Usable from the bag. */
  use?: ItemUse;
  /** Not usable from the bag: a button that takes the player where it is used. */
  goto?: { screen: string; label: string };
  /** Sort order inside its category. */
  sort: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

const DEFS: ItemDef[] = [
  // ---- Resources ----
  {
    id: 'food_box',
    name: 'Ration Crate',
    desc: 'A sealed crate of field rations. Opens into 2,500 Food.',
    icon: 'crate_food',
    category: 'resources',
    rarity: 'uncommon',
    use: { reward: { currencies: { food: 2500 } }, label: 'Open' },
    sort: 1,
  },
  {
    id: 'iron_box',
    name: 'Scrap Crate',
    desc: 'Salvaged plating and bolts. Opens into 2,500 Iron.',
    icon: 'crate_iron',
    category: 'resources',
    rarity: 'uncommon',
    use: { reward: { currencies: { iron: 2500 } }, label: 'Open' },
    sort: 2,
  },
  {
    id: 'gold_box',
    name: 'Coin Crate',
    desc: 'A small crate of trade coins. Opens into 1,000 Gold.',
    icon: 'crate_gold',
    category: 'resources',
    rarity: 'rare',
    use: { reward: { currencies: { gold: 1000 } }, label: 'Open' },
    sort: 3,
  },
  {
    id: 'food_box_l',
    name: 'Ration Pallet',
    desc: 'A full pallet of supplies. Opens into 25,000 Food.',
    icon: 'crate_food',
    category: 'resources',
    rarity: 'epic',
    use: { reward: { currencies: { food: 25000 } }, label: 'Open' },
    sort: 4,
  },
  {
    id: 'iron_box_l',
    name: 'Iron Pallet',
    desc: 'Stacked iron ingots. Opens into 25,000 Iron.',
    icon: 'crate_iron',
    category: 'resources',
    rarity: 'epic',
    use: { reward: { currencies: { iron: 25000 } }, label: 'Open' },
    sort: 5,
  },
  {
    id: 'gold_box_l',
    name: 'Coin Strongbox',
    desc: 'A locked strongbox full of coins. Opens into 10,000 Gold.',
    icon: 'crate_gold',
    category: 'resources',
    rarity: 'epic',
    use: { reward: { currencies: { gold: 10000 } }, label: 'Open' },
    sort: 6,
  },
  {
    id: 'supply_crate',
    name: 'Supply Drop',
    desc: 'An air-dropped crate. Opens into 3,000 Food, 3,000 Iron and a 5-min Speed-Up.',
    icon: 'supply',
    category: 'resources',
    rarity: 'rare',
    use: { reward: { currencies: { food: 3000, iron: 3000 }, items: { speedup_1m: 2 } }, label: 'Open' },
    sort: 7,
  },
  {
    id: 'diamond_pouch',
    name: 'Gem Pouch',
    desc: 'A small velvet pouch. Opens into 50 Diamonds.',
    icon: 'gem_pouch',
    category: 'resources',
    rarity: 'epic',
    use: { reward: { currencies: { diamonds: 50 } }, label: 'Open' },
    sort: 8,
  },

  // ---- Speed-ups ----
  {
    id: 'speedup_1m',
    name: '1-Min Speed-Up',
    desc: 'Cuts 1 minute off any construction, training, research or healing timer.',
    icon: 'speed_1m',
    category: 'speedups',
    rarity: 'common',
    speedupMs: MIN,
    sort: 1,
  },
  {
    id: 'speedup_5m',
    name: '5-Min Speed-Up',
    desc: 'Cuts 5 minutes off any construction, training, research or healing timer.',
    icon: 'speed_5m',
    category: 'speedups',
    rarity: 'uncommon',
    speedupMs: 5 * MIN,
    sort: 2,
  },
  {
    id: 'speedup_1h',
    name: '1-Hour Speed-Up',
    desc: 'Cuts 1 hour off any construction, training, research or healing timer.',
    icon: 'speed_1h',
    category: 'speedups',
    rarity: 'rare',
    speedupMs: HOUR,
    sort: 3,
  },
  {
    id: 'speedup_8h',
    name: '8-Hour Speed-Up',
    desc: 'Cuts 8 hours off any construction, training, research or healing timer.',
    icon: 'speed_8h',
    category: 'speedups',
    rarity: 'epic',
    speedupMs: 8 * HOUR,
    sort: 4,
  },

  // ---- Hero items ----
  {
    id: 'exp_box',
    name: 'Field Manual',
    desc: 'Dog-eared combat notes. Opens into 2,000 Hero EXP.',
    icon: 'manual',
    category: 'hero',
    rarity: 'rare',
    use: { reward: { currencies: { heroExp: 2000 } }, label: 'Open' },
    sort: 1,
  },
  {
    id: 'exp_box_l',
    name: 'Tactics Codex',
    desc: 'A complete officer training course. Opens into 20,000 Hero EXP.',
    icon: 'codex',
    category: 'hero',
    rarity: 'epic',
    use: { reward: { currencies: { heroExp: 20000 } }, label: 'Open' },
    sort: 2,
  },
  {
    id: 'skill_medal',
    name: 'Valor Medal',
    desc: 'Awarded for bravery. Used to upgrade hero skills.',
    icon: 'medal',
    category: 'hero',
    rarity: 'rare',
    goto: { screen: 'heroes', label: 'Heroes' },
    sort: 3,
  },
  {
    id: 'shard_universal_ssr',
    name: 'Epic Wildcard Shard',
    desc: 'Can be converted into shards of any Epic (SSR) hero.',
    icon: 'shard_ssr',
    category: 'hero',
    rarity: 'epic',
    goto: { screen: 'heroes', label: 'Heroes' },
    sort: 4,
  },
  {
    id: 'shard_universal_ur',
    name: 'Legendary Wildcard Shard',
    desc: 'Can be converted into shards of any Legendary (UR) hero.',
    icon: 'shard_ur',
    category: 'hero',
    rarity: 'legendary',
    goto: { screen: 'heroes', label: 'Heroes' },
    sort: 5,
  },

  // ---- Other ----
  {
    id: 'recruit_ticket',
    name: 'Muster Ticket',
    desc: 'Recruits one hero at the Mess Hall.',
    icon: 'ticket',
    category: 'other',
    rarity: 'rare',
    goto: { screen: 'recruit', label: 'Recruit' },
    sort: 1,
  },
  {
    id: 'stamina_potion',
    name: 'Stamina Tonic',
    desc: 'A bitter energy brew. Restores 30 Stamina for world-map attacks.',
    icon: 'potion',
    category: 'other',
    rarity: 'uncommon',
    use: {
      apply: (s, count) => {
        s.world.stamina += 30 * count;
        return `+${30 * count} Stamina`;
      },
    },
    sort: 2,
  },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));

/** Definition for any item id (unknown ids get a generic fallback so the bag never breaks). */
export function itemDef(id: ItemId): ItemDef {
  return (
    ITEMS[id] ?? {
      id,
      name: id
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      desc: 'A useful item.',
      icon: 'box',
      category: 'other',
      rarity: 'common',
      sort: 99,
    }
  );
}

export const RARITY_COLOR: Record<ItemRarity, string> = {
  common: '#8a97a6',
  uncommon: '#4cc24a',
  rare: '#3a9cf0',
  epic: '#b25cff',
  legendary: '#ffae1a',
};

export const SPEEDUP_IDS: ItemId[] = ['speedup_1m', 'speedup_5m', 'speedup_1h', 'speedup_8h'];
