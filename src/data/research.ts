// OWNER: meta agent. Tech tree: 3 branches (economy / development / combat), each a grid of nodes
// (row = tier, col = 0..2) with prerequisites, per-level bonuses, costs (gold from row 2) and timers.
import type { BonusKey, Cost } from '../core/types';

export type ResearchBranch = 'economy' | 'development' | 'combat';

export interface TechDef {
  id: string;
  name: string;
  desc: string;
  branch: ResearchBranch;
  /** Tier row (0 = top). */
  row: number;
  /** Column 0..2 inside the branch grid. */
  col: number;
  icon: string;
  maxLevel: number;
  /** Bonus granted PER LEVEL. */
  bonus: Partial<Record<BonusKey, number>>;
  /** Other techs (and levels) required before level 1 can be researched. */
  requires: { id: string; level: number }[];
  /** Power added per level. */
  power: number;
}

export const BRANCHES: { id: ResearchBranch; label: string; icon: string; blurb: string }[] = [
  { id: 'economy', label: 'Economy', icon: 'wheat', blurb: 'Production, storage and construction' },
  { id: 'development', label: 'Development', icon: 'gear', blurb: 'Training, healing, marches and squads' },
  { id: 'combat', label: 'Combat', icon: 'swords', blurb: 'Hero and soldier battle strength' },
];

/** Tech Center level needed to research anything in a row. */
export const ROW_TECH_LEVEL = [1, 2, 4, 6, 8, 10];

const T = (d: Omit<TechDef, 'requires'> & { requires?: TechDef['requires'] }): TechDef => ({ requires: [], ...d });

export const TECHS: TechDef[] = [
  // ---------------- Economy ----------------
  T({ id: 'eco_crops', name: 'Crop Rotation', desc: 'Smarter planting schedules boost Food output.', branch: 'economy', row: 0, col: 0, icon: 'food', maxLevel: 10, bonus: { food_prod_pct: 3 }, power: 60 }),
  T({ id: 'eco_drills', name: 'Deep Drilling', desc: 'Longer drill bits reach richer iron seams.', branch: 'economy', row: 0, col: 2, icon: 'iron', maxLevel: 10, bonus: { iron_prod_pct: 3 }, power: 60 }),
  T({ id: 'eco_build', name: 'Rapid Scaffolding', desc: 'Prefabricated frames speed up construction.', branch: 'economy', row: 1, col: 1, icon: 'hammer', maxLevel: 10, bonus: { build_speed_pct: 2 }, power: 90, requires: [{ id: 'eco_crops', level: 2 }, { id: 'eco_drills', level: 2 }] }),
  T({ id: 'eco_storage', name: 'Reinforced Silos', desc: 'Producers hold more before they fill up.', branch: 'economy', row: 2, col: 0, icon: 'crate_food', maxLevel: 5, bonus: { storage_pct: 5 }, power: 80, requires: [{ id: 'eco_build', level: 2 }] }),
  T({ id: 'eco_mint', name: 'Coin Press', desc: 'Refined minting yields more Gold.', branch: 'economy', row: 2, col: 2, icon: 'gold', maxLevel: 10, bonus: { gold_prod_pct: 3 }, power: 100, requires: [{ id: 'eco_build', level: 2 }] }),
  T({ id: 'eco_grants', name: 'Lab Funding', desc: 'Well-funded labs research faster.', branch: 'economy', row: 3, col: 1, icon: 'flask', maxLevel: 10, bonus: { research_speed_pct: 2 }, power: 120, requires: [{ id: 'eco_storage', level: 2 }, { id: 'eco_mint', level: 2 }] }),
  T({ id: 'eco_scav', name: 'Scavenger Routes', desc: 'Your loot trucks bring back more while you are away.', branch: 'economy', row: 4, col: 0, icon: 'truck', maxLevel: 10, bonus: { idle_reward_pct: 4 }, power: 140, requires: [{ id: 'eco_grants', level: 3 }] }),
  T({ id: 'eco_masonry', name: 'Master Masonry', desc: 'Veteran crews build even faster.', branch: 'economy', row: 4, col: 2, icon: 'hammer', maxLevel: 10, bonus: { build_speed_pct: 3 }, power: 160, requires: [{ id: 'eco_grants', level: 3 }] }),

  // ---------------- Development ----------------
  T({ id: 'dev_drill', name: 'Drill Sergeants', desc: 'Tougher instructors train soldiers faster.', branch: 'development', row: 0, col: 1, icon: 'troops', maxLevel: 10, bonus: { train_speed_pct: 3 }, power: 60 }),
  T({ id: 'dev_medic', name: 'Field Medicine', desc: 'Better triage heals the wounded faster.', branch: 'development', row: 1, col: 0, icon: 'hospital', maxLevel: 10, bonus: { heal_speed_pct: 4 }, power: 70, requires: [{ id: 'dev_drill', level: 2 }] }),
  T({ id: 'dev_roads', name: 'Road Clearing', desc: 'Cleared highways let squads march faster.', branch: 'development', row: 1, col: 2, icon: 'boot', maxLevel: 10, bonus: { march_speed_pct: 3 }, power: 70, requires: [{ id: 'dev_drill', level: 2 }] }),
  T({ id: 'dev_endure', name: 'Endurance Regimen', desc: 'Raises maximum world-map Stamina.', branch: 'development', row: 2, col: 1, icon: 'stamina', maxLevel: 5, bonus: { stamina_max: 5 }, power: 100, requires: [{ id: 'dev_medic', level: 2 }, { id: 'dev_roads', level: 2 }] }),
  T({ id: 'dev_logistics', name: 'Squad Logistics', desc: 'Each squad can lead extra soldiers.', branch: 'development', row: 3, col: 0, icon: 'shield', maxLevel: 10, bonus: { squad_capacity: 25 }, power: 150, requires: [{ id: 'dev_endure', level: 2 }] }),
  T({ id: 'dev_deploy', name: 'Rapid Deployment', desc: 'Special Ops runs start with extra soldiers.', branch: 'development', row: 3, col: 2, icon: 'truck', maxLevel: 5, bonus: { runner_start_soldiers: 2 }, power: 120, requires: [{ id: 'dev_endure', level: 2 }] }),
  T({ id: 'dev_bootcamp', name: 'Boot Camp', desc: 'Intensive programs cut training time further.', branch: 'development', row: 4, col: 1, icon: 'troops', maxLevel: 10, bonus: { train_speed_pct: 4 }, power: 170, requires: [{ id: 'dev_logistics', level: 3 }, { id: 'dev_deploy', level: 2 }] }),

  // ---------------- Combat ----------------
  T({ id: 'cmb_atk', name: 'Ballistics', desc: 'Improved munitions raise all squad attack.', branch: 'combat', row: 0, col: 0, icon: 'swords', maxLevel: 10, bonus: { atk_pct: 1.5 }, power: 110 }),
  T({ id: 'cmb_hp', name: 'Body Armor', desc: 'Layered vests raise all squad HP.', branch: 'combat', row: 0, col: 2, icon: 'heart', maxLevel: 10, bonus: { hp_pct: 1.5 }, power: 110 }),
  T({ id: 'cmb_def', name: 'Composite Plating', desc: 'Composite plates raise all squad defense.', branch: 'combat', row: 1, col: 1, icon: 'shield', maxLevel: 10, bonus: { def_pct: 1.5 }, power: 120, requires: [{ id: 'cmb_atk', level: 2 }, { id: 'cmb_hp', level: 2 }] }),
  T({ id: 'cmb_tank', name: 'Heavy Armor Doctrine', desc: 'All stats of Tank heroes.', branch: 'combat', row: 2, col: 0, icon: 'type_tank', maxLevel: 10, bonus: { tank_pct: 2 }, power: 150, requires: [{ id: 'cmb_def', level: 2 }] }),
  T({ id: 'cmb_air', name: 'Air Superiority', desc: 'All stats of Aircraft heroes.', branch: 'combat', row: 2, col: 1, icon: 'type_aircraft', maxLevel: 10, bonus: { aircraft_pct: 2 }, power: 150, requires: [{ id: 'cmb_def', level: 2 }] }),
  T({ id: 'cmb_missile', name: 'Guided Payloads', desc: 'All stats of Missile heroes.', branch: 'combat', row: 2, col: 2, icon: 'type_missile', maxLevel: 10, bonus: { missile_pct: 2 }, power: 150, requires: [{ id: 'cmb_def', level: 2 }] }),
  T({ id: 'cmb_runner', name: 'Assault Rifles', desc: 'Squads deal more damage in Special Ops runs.', branch: 'combat', row: 3, col: 1, icon: 'target', maxLevel: 10, bonus: { runner_damage_pct: 4 }, power: 160, requires: [{ id: 'cmb_tank', level: 1 }, { id: 'cmb_air', level: 1 }, { id: 'cmb_missile', level: 1 }] }),
  T({ id: 'cmb_elite', name: 'Elite Tactics', desc: 'Combined-arms drills raise attack and HP.', branch: 'combat', row: 4, col: 1, icon: 'star', maxLevel: 10, bonus: { atk_pct: 2, hp_pct: 2 }, power: 250, requires: [{ id: 'cmb_runner', level: 3 }] }),
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

/** Cost to research `def` up to `level` (1-based). Gold joins from row 2 onward. */
export function techCost(def: TechDef, level: number): Cost {
  const base = 400 * Math.pow(2.1, def.row);
  const k = base * Math.pow(1.6, level - 1);
  const cost: Cost = { food: Math.round(k / 10) * 10, iron: Math.round((k * 0.9) / 10) * 10 };
  if (def.row >= 2) cost.gold = Math.round((k * 0.35) / 10) * 10;
  return cost;
}

/** Base duration (ms, before research-speed bonus) to research `def` up to `level`. */
export function techTimeMs(def: TechDef, level: number): number {
  const baseSec = 40 * Math.pow(1.9, def.row);
  return Math.round(baseSec * Math.pow(1.45, level - 1)) * 1000;
}

export function techsOf(branch: ResearchBranch): TechDef[] {
  return TECHS.filter((t) => t.branch === branch);
}

const PCT_LABEL: Partial<Record<BonusKey, string>> = {
  atk_pct: 'Squad ATK',
  hp_pct: 'Squad HP',
  def_pct: 'Squad DEF',
  tank_pct: 'Tank hero stats',
  aircraft_pct: 'Aircraft hero stats',
  missile_pct: 'Missile hero stats',
  food_prod_pct: 'Food production',
  iron_prod_pct: 'Iron production',
  gold_prod_pct: 'Gold production',
  build_speed_pct: 'Construction speed',
  research_speed_pct: 'Research speed',
  train_speed_pct: 'Training speed',
  heal_speed_pct: 'Healing speed',
  march_speed_pct: 'March speed',
  idle_reward_pct: 'Idle rewards',
  storage_pct: 'Producer storage',
  runner_damage_pct: 'Special Ops damage',
};
const FLAT_LABEL: Partial<Record<BonusKey, string>> = {
  squad_capacity: 'Soldiers per squad',
  stamina_max: 'Max stamina',
  runner_start_soldiers: 'Special Ops starting soldiers',
};

/** "Food production +6%" style lines for a bonus map. */
export function bonusLines(b: Partial<Record<BonusKey, number>>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (!v) continue;
    const r = Math.round(v * 10) / 10;
    if (PCT_LABEL[k]) out.push(`${PCT_LABEL[k]} +${r}%`);
    else out.push(`${FLAT_LABEL[k] ?? k} +${r}`);
  }
  return out;
}

export function scaleBonus(b: Partial<Record<BonusKey, number>>, level: number): Partial<Record<BonusKey, number>> {
  const out: Partial<Record<BonusKey, number>> = {};
  for (const [k, v] of Object.entries(b)) out[k] = (v ?? 0) * level;
  return out;
}
