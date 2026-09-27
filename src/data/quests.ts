// OWNER: meta agent. Chapter quests that guide the first hours (GAME_REFERENCE §8).
// Every quest's progress is computed from live state and/or lifetime stat counters, so tasks the player
// already did complete automatically. 8 hand-written chapters, then generated "Frontier" chapters forever.
import type { GameState } from '../core/store';
import type { BuildingType, ModeId, Reward } from '../core/types';
import type { Feature } from '../core/unlocks';
import { districtsCleared } from '../core/unlocks';
import { buildingLevel, buildingsOf, hqLevel } from '../systems/buildings';
import { buildingName } from './buildings';
import { totalPower } from '../core/bonuses';
import { fmt } from '../core/format';

/** Where a quest's "Go" button takes the player. */
export type QuestGo =
  | { kind: 'building'; type: BuildingType; openPanel?: boolean }
  | { kind: 'screen'; id: string; props?: any; feature?: Feature }
  | { kind: 'mode'; mode: ModeId; params?: any; feature?: Feature }
  /** Opens the barracks / hospital screen of the first such building (or focuses the plot to build one). */
  | { kind: 'barracks' }
  | { kind: 'hospital' }
  | { kind: 'research' };

export interface QuestDef {
  id: string;
  text: string;
  target: number;
  progress: (s: GameState) => number;
  reward: Reward;
  go?: QuestGo;
}

export interface ChapterDef {
  index: number;
  title: string;
  quests: QuestDef[];
  /** Chapter-completion chest. */
  reward: Reward;
}

/** Display names used in quest text — sourced from the base module's building definitions. */
export const BUILDING_LABEL: Record<BuildingType, string> = new Proxy({} as Record<BuildingType, string>, {
  get: (_t, k) => buildingName(k as BuildingType),
});

// ---------- progress helpers ----------
const stat = (s: GameState, k: string) => s.stats[k] ?? 0;
const builtCount = (s: GameState, t: BuildingType) => buildingsOf(s, t).filter((b) => b.level >= 1).length;
const heroCount = (s: GameState) => Object.keys(s.heroes.owned).length;
const squadSize = (s: GameState) => s.heroes.squads[0]?.heroes.filter(Boolean).length ?? 0;
const maxHeroLevel = (s: GameState) => Object.values(s.heroes.owned).reduce((m, h) => Math.max(m, h.level), 0);
const researchLevels = (s: GameState) => Object.values(s.meta.research).reduce((a, b) => a + b, 0);
const runnerCleared = (s: GameState) => Math.max(0, s.runner.level - 1, stat(s, 'runnerWins') > 0 ? 1 : 0);

// ---------- quest builders ----------
let seq = 0;
function q(ch: number, text: string, target: number, progress: QuestDef['progress'], reward: Reward, go?: QuestGo): QuestDef {
  return { id: `c${ch}_${seq++}`, text, target, progress, reward, go };
}
const res = (food: number, iron: number, extra: Reward = {}): Reward => ({
  ...extra,
  currencies: { food, iron, ...(extra.currencies ?? {}) },
});

function build(ch: number, type: BuildingType, reward: Reward): QuestDef {
  return q(ch, `Build a ${BUILDING_LABEL[type]}`, 1, (s) => Math.min(1, buildingLevel(s, type)), reward, { kind: 'building', type, openPanel: true });
}
function upgrade(ch: number, type: BuildingType, level: number, reward: Reward): QuestDef {
  return q(ch, `Upgrade ${BUILDING_LABEL[type]} to Lv ${level}`, level, (s) => buildingLevel(s, type), reward, { kind: 'building', type, openPanel: true });
}
function hq(ch: number, level: number, reward: Reward): QuestDef {
  return q(ch, `Upgrade ${buildingName('hq')} to Lv ${level}`, level, (s) => hqLevel(s), reward, { kind: 'building', type: 'hq', openPanel: true });
}
function own(ch: number, type: BuildingType, n: number, reward: Reward): QuestDef {
  return q(ch, `Own ${n} ${BUILDING_LABEL[type]}s`, n, (s) => builtCount(s, type), reward, { kind: 'building', type });
}
function districts(ch: number, n: number, reward: Reward): QuestDef {
  return q(ch, n === 1 ? 'Clear District 1' : `Clear ${n} districts`, n, (s) => districtsCleared(s), reward, { kind: 'screen', id: 'campaign', feature: 'campaign' });
}
function runner(ch: number, n: number, reward: Reward): QuestDef {
  return q(ch, n === 1 ? 'Win a Special Ops run' : `Clear Special Ops level ${n}`, n, runnerCleared, reward, { kind: 'screen', id: 'runnerLevels', feature: 'runner' });
}
function train(ch: number, n: number, reward: Reward): QuestDef {
  return q(ch, `Train ${fmt(n)} soldiers`, n, (s) => stat(s, 'troopsTrained'), reward, { kind: 'barracks' });
}
function horde(ch: number, level: number, reward: Reward): QuestDef {
  return q(ch, `Defeat a Lv ${level} zombie horde`, level, (s) => s.world.maxHordeLevel, reward, { kind: 'mode', mode: 'world', feature: 'world' });
}
function hordes(ch: number, n: number, reward: Reward): QuestDef {
  return q(ch, `Defeat ${n} zombie hordes`, n, (s) => stat(s, 'hordes'), reward, { kind: 'mode', mode: 'world', feature: 'world' });
}
function research(ch: number, n: number, reward: Reward): QuestDef {
  return q(ch, n === 1 ? 'Complete a research' : `Complete ${n} research levels`, n, researchLevels, reward, { kind: 'research' });
}
function power(ch: number, p: number, reward: Reward): QuestDef {
  return q(ch, `Reach ${fmt(p)} Power`, p, (s) => totalPower(s), reward, { kind: 'screen', id: 'heroes' });
}
function heroLevel(ch: number, lv: number, reward: Reward): QuestDef {
  return q(ch, `Level a hero to Lv ${lv}`, lv, maxHeroLevel, reward, { kind: 'screen', id: 'heroes' });
}

// ---------- hand-written chapters ----------
function handmade(): ChapterDef[] {
  seq = 0;
  return [
    {
      index: 0,
      title: 'First Light',
      quests: [
        build(1, 'farm', res(300, 300)),
        build(1, 'drill', res(400, 400)),
        build(1, 'barracks', res(400, 400, { items: { speedup_1m: 3 } })),
        districts(1, 1, res(500, 500)),
        q(1, 'Deploy 3 heroes in Squad 1', 3, squadSize, res(300, 300, { currencies: { heroExp: 500 } }), { kind: 'screen', id: 'formation' }),
        hq(1, 2, res(800, 800, { items: { speedup_5m: 1 } })),
      ],
      reward: { currencies: { diamonds: 50, food: 1500, iron: 1500 }, items: { speedup_5m: 2, food_box: 1 } },
    },
    {
      index: 1,
      title: 'Dig In',
      quests: [
        build(2, 'ironmine', res(600, 600)),
        own(2, 'farm', 2, res(600, 600)),
        train(2, 40, res(500, 500, { items: { speedup_1m: 3 } })),
        runner(2, 1, res(600, 600, { items: { exp_box: 1 } })),
        upgrade(2, 'wall', 2, res(800, 800)),
        districts(2, 2, res(800, 800)),
        hq(2, 3, res(1200, 1200, { items: { speedup_5m: 2 } })),
      ],
      reward: { currencies: { diamonds: 60, gold: 300 }, items: { recruit_ticket: 2, iron_box: 1, speedup_5m: 2 } },
    },
    {
      index: 2,
      title: 'Call to Arms',
      quests: [
        districts(3, 3, res(1000, 1000)),
        q(3, 'Recruit a hero', 1, (s) => Math.max(stat(s, 'recruits'), s.heroes.recruit.totalPulls), res(800, 800, { items: { recruit_ticket: 1 } }), { kind: 'screen', id: 'recruit', feature: 'recruit' }),
        upgrade(3, 'barracks', 3, res(1200, 1200)),
        upgrade(3, 'drill', 3, res(1200, 1200)),
        build(3, 'hospital', res(1000, 1000, { items: { speedup_5m: 1 } })),
        heroLevel(3, 5, res(800, 800, { currencies: { heroExp: 1500 } })),
        hq(3, 4, res(2000, 2000, { items: { speedup_5m: 3 } })),
      ],
      reward: { currencies: { diamonds: 80, gold: 600 }, items: { recruit_ticket: 3, exp_box: 2, speedup_1h: 1 } },
    },
    {
      index: 3,
      title: 'Beyond the Wall',
      quests: [
        q(4, 'Visit the World Map', 1, (s) => Math.min(1, stat(s, 'worldVisits')), res(1000, 1000), { kind: 'mode', mode: 'world', feature: 'world' }),
        horde(4, 1, res(1500, 1500, { items: { stamina_potion: 1 } })),
        upgrade(4, 'farm', 4, res(1500, 1500)),
        upgrade(4, 'ironmine', 3, res(1500, 1500)),
        runner(4, 3, res(1500, 1500, { items: { exp_box: 1 } })),
        districts(4, 5, res(2000, 2000)),
        upgrade(4, 'wall', 4, res(2000, 2000)),
        hq(4, 5, res(3000, 3000, { items: { speedup_1h: 1 } })),
      ],
      reward: { currencies: { diamonds: 100, gold: 1000 }, items: { recruit_ticket: 3, supply_crate: 2, stamina_potion: 2 } },
    },
    {
      index: 4,
      title: 'Iron Resolve',
      quests: [
        build(5, 'radar', res(2500, 2500)),
        upgrade(5, 'barracks', 4, res(2500, 2500)),
        train(5, 300, res(3000, 3000, { items: { speedup_5m: 3 } })),
        upgrade(5, 'hospital', 3, res(2500, 2500)),
        horde(5, 3, res(3000, 3000, { items: { stamina_potion: 1 } })),
        districts(5, 8, res(3500, 3500)),
        q(5, 'Use 30 minutes of speed-ups', 30, (s) => stat(s, 'speedupMinutes'), res(2000, 2000, { items: { speedup_5m: 4 } }), { kind: 'screen', id: 'bag' }),
        hq(5, 6, res(5000, 5000, { items: { speedup_1h: 1 } })),
      ],
      reward: { currencies: { diamonds: 120, gold: 2000 }, items: { recruit_ticket: 4, food_box: 2, iron_box: 2, speedup_1h: 1 } },
    },
    {
      index: 5,
      title: 'Armored Column',
      quests: [
        build(6, 'tankcenter', res(4000, 4000)),
        build(6, 'trainingbase', res(4000, 4000, { currencies: { heroExp: 3000 } })),
        q(6, 'Own 5 heroes', 5, heroCount, res(3000, 3000, { items: { recruit_ticket: 1 } }), { kind: 'screen', id: 'recruit', feature: 'recruit' }),
        heroLevel(6, 15, res(3000, 3000, { items: { exp_box: 2 } })),
        upgrade(6, 'tankcenter', 3, res(5000, 5000)),
        runner(6, 6, res(4000, 4000, { items: { skill_medal: 10 } })),
        districts(6, 10, res(5000, 5000, { items: { speedup_1h: 1 } })),
        hq(6, 7, res(8000, 8000, { items: { speedup_1h: 2 } })),
      ],
      reward: { currencies: { diamonds: 150, gold: 4000 }, items: { recruit_ticket: 5, exp_box_l: 1, speedup_1h: 2 } },
    },
    {
      index: 6,
      title: 'Think Tank',
      quests: [
        build(7, 'tech', res(6000, 6000)),
        research(7, 1, res(5000, 5000, { items: { speedup_5m: 3 } })),
        upgrade(7, 'tech', 3, res(8000, 8000)),
        research(7, 5, res(8000, 8000, { currencies: { gold: 2000 } })),
        horde(7, 5, res(8000, 8000, { items: { stamina_potion: 2 } })),
        runner(7, 8, res(8000, 8000, { items: { skill_medal: 15 } })),
        districts(7, 14, res(10000, 10000)),
        hq(7, 8, res(15000, 15000, { items: { speedup_1h: 2 } })),
      ],
      reward: { currencies: { diamonds: 200, gold: 8000 }, items: { recruit_ticket: 6, shard_universal_ssr: 10, speedup_8h: 1 } },
    },
    {
      index: 7,
      title: 'Surge Protocol',
      quests: [
        build(8, 'goldmine', res(10000, 10000)),
        upgrade(8, 'tech', 7, res(15000, 15000, { currencies: { gold: 4000 } })),
        power(8, 50000, res(15000, 15000, { items: { exp_box_l: 1 } })),
        train(8, 1000, res(15000, 15000, { items: { speedup_1h: 1 } })),
        hordes(8, 10, res(15000, 15000, { items: { stamina_potion: 2 } })),
        research(8, 12, res(15000, 15000, { currencies: { gold: 5000 } })),
        districts(8, 20, res(20000, 20000)),
        hq(8, 9, res(25000, 25000, { items: { speedup_8h: 1 } })),
      ],
      reward: { currencies: { diamonds: 300, gold: 15000 }, items: { recruit_ticket: 8, shard_universal_ur: 5, food_box_l: 1, iron_box_l: 1 } },
    },
  ];
}

const HANDMADE = handmade();
export const HANDMADE_CHAPTERS = HANDMADE.length;

/** Endless generated chapters after the hand-written ones keep the tracker pointing somewhere useful. */
function generated(index: number): ChapterDef {
  const k = index - HANDMADE.length + 1; // 1, 2, 3...
  const ch = index + 1;
  const hqTarget = 9 + k;
  const m = Math.pow(1.6, k);
  const r = (n: number, extra: Reward = {}) => res(Math.round(20000 * m * n), Math.round(20000 * m * n), extra);
  const rotate: BuildingType[] = ['wall', 'barracks', 'drill', 'tankcenter', 'hospital'];
  const b = rotate[k % rotate.length];
  seq = 0;
  const quests: QuestDef[] = [
    upgrade(ch, b, hqTarget - 1, r(1)),
    upgrade(ch, 'tech', hqTarget - 1, r(1, { currencies: { gold: Math.round(5000 * m) } })),
    districts(ch, 20 + k * 5, r(1.2, { items: { speedup_1h: 1 } })),
    horde(ch, 5 + k * 2, r(1, { items: { stamina_potion: 2 } })),
    train(ch, 1000 + k * 1000, r(1, { items: { speedup_1h: 1 } })),
    research(ch, 12 + k * 6, r(1)),
    power(ch, Math.round((50000 * Math.pow(1.5, k)) / 1000) * 1000, r(1.2, { items: { exp_box_l: 1 } })),
    hq(ch, hqTarget, r(1.5, { items: { speedup_8h: 1 } })),
  ];
  // ids must be stable & unique per chapter
  quests.forEach((qd, i) => (qd.id = `g${ch}_${i}`));
  return {
    index,
    title: `Frontier ${k}`,
    quests,
    reward: {
      currencies: { diamonds: 300 + k * 50, gold: Math.round(15000 * m) },
      items: { recruit_ticket: 8, speedup_8h: 1, shard_universal_ssr: 10 },
    },
  };
}

const genCache = new Map<number, ChapterDef>();
export function getChapter(index: number): ChapterDef {
  if (index < HANDMADE.length) return HANDMADE[index];
  let c = genCache.get(index);
  if (!c) genCache.set(index, (c = generated(index)));
  return c;
}
