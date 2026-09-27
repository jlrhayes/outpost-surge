// OWNER: heroes agent. Heroes, squads, recruitment and campaign slice. Extend freely.

export interface HeroState {
  /** Hero definition id (src/data/heroes.ts). */
  id: string;
  level: number;
  exp: number;
  stars: number;
  /** Shards toward the next star. */
  shards: number;
  skillLevels: number[];
  /** Gear slot levels (weapon, armor, chip, radar). */
  gear: number[];
}

export interface Squad {
  id: number;
  /** Five slots: 0-1 front row, 2-4 back row. Hero def ids or null. */
  heroes: (string | null)[];
}

export interface HeroesState {
  owned: Record<string, HeroState>;
  squads: Squad[];
  recruit: { pity: number; freeAt: number; totalPulls: number };
  /** Campaign (auto-battle stages). `stage` = next stage to fight (1-based). */
  campaign: { stage: number; idleClaimedAt: number };
}

export function defaultHeroesState(now: number): HeroesState {
  return {
    owned: {},
    squads: [{ id: 1, heroes: [null, null, null, null, null] }],
    recruit: { pity: 0, freeAt: now, totalPulls: 0 },
    campaign: { stage: 1, idleClaimedAt: now },
  };
}
