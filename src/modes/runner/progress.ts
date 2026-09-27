// OWNER: runner agent. Special Ops progression: level/chapter gating, rewards, recording results.
import { game, mutate, type GameState } from '../../core/store';
import { grantIn } from '../../core/economy';
import { emit } from '../../core/events';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import { hqLevel } from '../../systems/buildings';
import { bestTroopTier } from '../../systems/troops';
import type { Reward } from '../../core/types';
import { CHAPTERS, LEVEL_COUNT, chapterOf, isBossLevel, LEVELS_PER_CHAPTER } from '../../data/runner';

/** Max soldiers converted into troops per level (first clear) and on replays. */
export const TROOP_CAP_FIRST = 60;
export const TROOP_CAP_REPLAY = 25;

export function chapterLock(s: GameState, chapter: number): string | null {
  if (!isUnlocked(s, 'runner')) return unlockHint('runner') || 'Locked';
  const ch = CHAPTERS[chapter - 1];
  if (ch && hqLevel(s) < ch.hq) return `Requires HQ ${ch.hq}`;
  return null;
}

/** Null if the level can be played, otherwise a human-readable reason. */
export function levelLock(s: GameState, level: number): string | null {
  if (level < 1 || level > LEVEL_COUNT) return 'Coming soon';
  const cl = chapterLock(s, chapterOf(level));
  if (cl) return cl;
  if (level > s.runner.level) return `Clear level ${level - 1} first`;
  return null;
}

export function isCleared(s: GameState, level: number): boolean {
  return level < s.runner.level;
}

export function totalStars(s: GameState): number {
  let n = 0;
  for (const v of Object.values(s.runner.stars)) n += v;
  return n;
}

export function chapterStars(s: GameState, chapter: number): number {
  let n = 0;
  const first = (chapter - 1) * LEVELS_PER_CHAPTER + 1;
  for (let l = first; l < first + LEVELS_PER_CHAPTER; l++) n += s.runner.stars[l] ?? 0;
  return n;
}

/** Stars from the share of the peak squad that survived. */
export function starsFor(survivors: number, peak: number): number {
  if (survivors <= 0) return 0;
  const p = peak > 0 ? survivors / peak : 1;
  return p >= 0.6 ? 3 : p >= 0.3 ? 2 : 1;
}

/** Rewards for winning `level` (not the intro). Used for the result screen and the level preview. */
export function levelReward(s: GameState, level: number, survivors: number, stars: number, firstClear: boolean): Reward {
  const tier = bestTroopTier(s);
  const troops = Math.min(firstClear ? TROOP_CAP_FIRST : TROOP_CAP_REPLAY, Math.floor(firstClear ? survivors : survivors * 0.5));
  const starMult = 0.7 + 0.15 * Math.max(1, stars);
  const mult = starMult * (firstClear ? 1 : 0.4);
  const currencies: Reward['currencies'] = {
    food: round50((400 + level * 160) * mult),
    iron: round50((300 + level * 120) * mult),
    heroExp: round50((150 + level * 70) * mult),
  };
  if (level >= 9) currencies.gold = round50(level * 30 * mult);
  const items: Reward['items'] = {};
  if (firstClear) {
    currencies.diamonds = 10;
    const ch = chapterOf(level);
    if (isBossLevel(level)) {
      currencies.diamonds += 100 + 50 * (ch - 1);
      items.recruit_ticket = 1 + Math.floor(ch / 2);
    } else if (level % 4 === 0) {
      items.speedup_5m = 2;
    }
  }
  const reward: Reward = { currencies };
  if (Object.keys(items).length) reward.items = items;
  if (troops > 0) reward.troops = { [tier]: troops };
  return reward;
}

/** One-off reward for finishing the opening run. */
export function introReward(s: GameState, survivors: number): Reward {
  const tier = bestTroopTier(s);
  const troops = Math.min(TROOP_CAP_FIRST, survivors);
  const reward: Reward = {
    currencies: { food: 2500, iron: 2000, heroExp: 1200, diamonds: 50 },
  };
  if (troops > 0) reward.troops = { [tier]: troops };
  return reward;
}

export interface RunSummary {
  level: number;
  intro: boolean;
  won: boolean;
  survivors: number;
  peak: number;
  kills: number;
}

export interface RunOutcome extends RunSummary {
  stars: number;
  prevStars: number;
  firstClear: boolean;
  reward: Reward | null;
  /** Next level to offer after this result (null = none). */
  next: number | null;
  nextLock: string | null;
}

/** Records a finished (won, lost or quit) run: grants rewards inside mutate, then emits events. */
export function recordRun(sum: RunSummary): RunOutcome {
  let stars = 0;
  let prevStars = 0;
  let firstClear = false;
  let reward: Reward | null = null;
  mutate((s) => {
    const r = s.runner;
    r.runs++;
    if (sum.intro) {
      if (sum.won) {
        stars = starsFor(sum.survivors, sum.peak);
        if (!r.introDone) {
          reward = introReward(s, sum.survivors);
          grantIn(s, reward);
        }
        r.introDone = true;
      }
      return;
    }
    if (!sum.won) return;
    stars = starsFor(sum.survivors, sum.peak);
    prevStars = r.stars[sum.level] ?? 0;
    firstClear = sum.level >= r.level;
    reward = levelReward(s, sum.level, sum.survivors, stars, firstClear);
    grantIn(s, reward);
    r.wins++;
    if (stars > prevStars) r.stars[sum.level] = stars;
    if (sum.survivors > (r.best[sum.level] ?? 0)) r.best[sum.level] = sum.survivors;
    if (firstClear) r.level = Math.min(LEVEL_COUNT + 1, sum.level + 1);
    s.stats.runnerBestLevel = Math.max(s.stats.runnerBestLevel ?? 0, sum.level);
  });
  // Events after the mutate (quests/daily/stats listen). The tutorial run doesn't count as a Special Ops
  // run (meta derives runnerWins/runnerPlays stats from this event).
  if (!sum.intro) emit('runner:finished', { level: sum.level, won: sum.won, stars });
  if (sum.kills > 0) emit('zombies:killed', { count: sum.kills });
  let next: number | null = null;
  let nextLock: string | null = null;
  if (!sum.intro && sum.won && sum.level < LEVEL_COUNT) {
    next = sum.level + 1;
    nextLock = levelLock(game, next);
  }
  return { ...sum, stars, prevStars, firstClear, reward, next, nextLock };
}

/** Player skipped the opening run from the pause menu: still mark it done and hand out the starter pack. */
export function skipIntro(): void {
  if (game.runner.introDone) return;
  mutate((s) => {
    grantIn(s, introReward(s, 0));
    s.runner.introDone = true;
  });
}

function round50(v: number): number {
  return Math.max(50, Math.round(v / 50) * 50);
}
