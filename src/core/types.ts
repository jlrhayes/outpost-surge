// Shared, cross-module types. Keep this file small and stable: every module depends on it.

/** Resources produced by buildings and stored in warehouses. */
export type ResourceId = 'food' | 'iron' | 'gold';
/** Everything that can appear in a Cost. `heroExp` is the pooled hero-experience currency. */
export type CurrencyId = ResourceId | 'diamonds' | 'heroExp';
export type Cost = Partial<Record<CurrencyId, number>>;

export type HeroType = 'tank' | 'aircraft' | 'missile';
export type HeroRole = 'attack' | 'defense' | 'support';
export type Rarity = 'SR' | 'SSR' | 'UR';

export type BuildingType =
  | 'hq'
  | 'wall'
  | 'barracks'
  | 'drill'
  | 'hospital'
  | 'tech'
  | 'farm'
  | 'ironmine'
  | 'goldmine'
  | 'warehouse'
  | 'tavern'
  | 'tankcenter'
  | 'aircenter'
  | 'missilecenter'
  | 'radar';

/**
 * Well-known item ids used across modules. The meta module (src/data/items.ts) owns
 * names, icons and "use" effects; other modules only grant/consume by id.
 */
export type ItemId =
  | 'recruit_ticket' // 1 hero recruitment
  | 'speedup_1m'
  | 'speedup_5m'
  | 'speedup_1h'
  | 'speedup_8h'
  | 'stamina_potion' // +stamina on the world map
  | 'food_box' // opens into food
  | 'iron_box'
  | 'gold_box'
  | 'exp_box' // opens into heroExp
  | 'skill_medal' // hero skill upgrades
  | 'shard_universal_ssr' // converts into any SSR hero's shards
  | 'shard_universal_ur'
  | (string & {});

/** Anything that can be granted to the player in one go (quest rewards, battle loot, etc). */
export interface Reward {
  currencies?: Cost;
  items?: Partial<Record<ItemId, number>>;
  /** heroDefId -> shard count */
  heroShards?: Record<string, number>;
  /** heroDefId -> grants the hero if not owned (or converts to shards if owned) */
  heroes?: string[];
  /** tier -> soldier count */
  troops?: Record<number, number>;
}

/** Stat/economy bonus keys. Values are summed across providers; *_pct keys are percentages (10 = +10%). */
export type BonusKey =
  | 'atk_pct'
  | 'hp_pct'
  | 'def_pct'
  | 'tank_pct' // all stats of tank heroes
  | 'aircraft_pct'
  | 'missile_pct'
  | 'food_prod_pct'
  | 'iron_prod_pct'
  | 'gold_prod_pct'
  | 'build_speed_pct'
  | 'research_speed_pct'
  | 'train_speed_pct'
  | 'heal_speed_pct'
  | 'march_speed_pct'
  | 'squad_capacity' // flat extra troops per squad
  | 'stamina_max' // flat
  | 'runner_start_soldiers' // flat extra soldiers when a runner level starts
  | 'runner_damage_pct'
  | 'idle_reward_pct'
  | 'storage_pct'
  | (string & {});

/** A single unit in an auto-battle (a hero leading troops, or an enemy). */
export interface Combatant {
  uid: string;
  name: string;
  side: 'A' | 'B';
  /** 0-1 front row, 2-4 back row. Front row is targeted first. */
  slot: number;
  type: HeroType | 'zombie';
  rarity?: Rarity;
  /** Model key understood by src/three/models (e.g. 'tank', 'aircraft', 'missile', 'zombie', 'zombieBrute', 'zombieBoss'). */
  model: string;
  level: number;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  /** Skill energy / cooldown data is owned by the battle system. */
  skillId?: string;
  heroId?: string;
}

export type ModeId = 'base' | 'world' | 'runner' | 'battle';
