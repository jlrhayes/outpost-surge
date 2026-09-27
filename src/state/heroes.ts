// OWNER: heroes agent. Heroes, squads, recruitment and campaign slice. Extend freely.
import { STARTER_HEROES, STARTER_SQUAD } from '../data/heroes';

export interface HeroState {
  /** Hero definition id (src/data/heroes.ts). */
  id: string;
  level: number;
  /** Unused (hero EXP is a pooled currency, spent directly on levels). Kept for save compatibility. */
  exp: number;
  /** 0..5 */
  stars: number;
  /** Shards toward the next star. */
  shards: number;
  /** [auto, active, passive] skill levels (1-based). */
  skillLevels: number[];
  /** Gear slot levels (gun, armor, chip, radar). 0 = not equipped. */
  gear: number[];
  /** Level the hero joined at for free (new recruits join near the squad's level); "Reset hero" returns here. Missing = 1. */
  baseLevel?: number;
}

export interface Squad {
  id: number;
  /** Five slots: 0-1 front row, 2-4 back row. Hero def ids or null. */
  heroes: (string | null)[];
}

export interface HeroesState {
  owned: Record<string, HeroState>;
  /** Shards collected for heroes that are not owned yet (10 unlock the hero). */
  pendingShards: Record<string, number>;
  squads: Squad[];
  recruit: { pity: number; freeAt: number; totalPulls: number };
  /** Campaign (district battles). `stage` = next district to fight (1-based). */
  campaign: { stage: number; idleClaimedAt: number; lastResult: '' | 'win' | 'loss' };
}

export function newHeroState(id: string, level = 1): HeroState {
  return { id, level, exp: 0, stars: 0, shards: 0, skillLevels: [1, 1, 1], gear: [0, 0, 0, 0], baseLevel: level };
}

export function defaultHeroesState(now: number): HeroesState {
  const owned: Record<string, HeroState> = {};
  for (const id of STARTER_HEROES) owned[id] = newHeroState(id);
  return {
    owned,
    pendingShards: {},
    squads: [{ id: 1, heroes: [...STARTER_SQUAD] }],
    // freeAt = now: the first free recruit is available immediately.
    recruit: { pity: 0, freeAt: now, totalPulls: 0 },
    campaign: { stage: 1, idleClaimedAt: now, lastResult: '' },
  };
}
