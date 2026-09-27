// OWNER: runner agent. Special Ops progression: level/chapter gating, rewards, replay passes, recording
// results.
import { game, mutate, type GameState } from '../../core/store';
import { grantIn } from '../../core/economy';
import { emit } from '../../core/events';
import { now } from '../../core/tick';
import { isUnlocked, unlockHint } from '../../core/unlocks';
import { hqLevel, maxTrainTier } from '../../systems/buildings';
import { troopRoom } from '../../systems/troops';
import type { Reward } from '../../core/types';
import { CHAPTERS, LEVEL_COUNT, chapterOf, isBossLevel, LEVELS_PER_CHAPTER } from '../../data/runner';

/** Max soldiers converted into troops per level (first clear) and on rewarded replays. */
export const TROOP_CAP_FIRST = 60;
export const TROOP_CAP_REPLAY = 5;
/** Rewarded replays: passes stored (max) and regen time per pass. Replays without a pass are practice. */
export const PASS_MAX = 5;
export const PASS_REGEN_MS = 30 * 60_000;
/** Soldiers that don't fit in the Drill Ground are sent home as supplies. */
export const OVERFLOW_PAY = { food: 20, iron: 15 };

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

/** Stars from the share of the peak squad that survived: 75% = 3 stars, 45% = 2 stars. */
export function starsFor(survivors: number, peak: number): number {
  if (survivors <= 0) return 0;
  const p = peak > 0 ? survivors / peak : 1;
  return p >= 0.75 ? 3 : p >= 0.45 ? 2 : 1;
}

// ---------------------------------------------------------------------------------------------
// Replay passes (absolute timestamps: offline regen is automatic).

/** Brings the stored passes up to date. Mutates `s`; returns true if anything changed. */
export function refreshPasses(s: GameState, t: number): boolean {
  const r = s.runner;
  if (r.passes >= PASS_MAX) {
    if (r.passAt === 0) return false;
    r.passAt = 0;
    return true;
  }
  if (!r.passAt) {
    r.passAt = t + PASS_REGEN_MS;
    return true;
  }
  if (t < r.passAt) return false;
  const n = 1 + Math.floor((t - r.passAt) / PASS_REGEN_MS);
  r.passes = Math.min(PASS_MAX, r.passes + n);
  r.passAt = r.passes >= PASS_MAX ? 0 : r.passAt + n * PASS_REGEN_MS;
  return true;
}

/** Passes available right now (read-only view for UIs between ticks). */
export function passesNow(s: GameState, t = now()): { passes: number; nextAt: number } {
  const r = s.runner;
  if (r.passes >= PASS_MAX || !r.passAt) return { passes: Math.min(PASS_MAX, r.passes), nextAt: 0 };
  if (t < r.passAt) return { passes: r.passes, nextAt: r.passAt };
  const n = 1 + Math.floor((t - r.passAt) / PASS_REGEN_MS);
  const passes = Math.min(PASS_MAX, r.passes + n);
  return { passes, nextAt: passes >= PASS_MAX ? 0 : r.passAt + n * PASS_REGEN_MS };
}

// ---------------------------------------------------------------------------------------------
// Rewards

/** Splits returning soldiers into troops that fit in the Drill Ground and overflow. */
export function troopSplit(s: GameState, n: number): { troops: number; overflow: number } {
  const troops = Math.max(0, Math.min(n, troopRoom(s)));
  return { troops, overflow: Math.max(0, n - troops) };
}

export interface Payout {
  reward: Reward;
  /** Soldiers that joined the army as troops. */
  troops: number;
  /** Soldiers with no room in the Drill Ground (paid as supplies instead). */
  overflow: number;
}

/**
 * Rewards for winning `level` (not the intro). Troops arrive at the highest tier the Barracks can train,
 * clamped to free Drill Ground space; each soldier that doesn't fit pays OVERFLOW_PAY instead.
 */
export function levelPayout(s: GameState, level: number, survivors: number, stars: number, firstClear: boolean): Payout {
  const n = Math.min(firstClear ? TROOP_CAP_FIRST : TROOP_CAP_REPLAY, Math.floor(firstClear ? survivors : survivors * 0.5));
  const starMult = 0.7 + 0.15 * Math.max(1, stars);
  const mult = starMult * (firstClear ? 1 : 0.4);
  const currencies: NonNullable<Reward['currencies']> = {
    food: round50((400 + level * 160) * mult),
    iron: round50((300 + level * 120) * mult),
    heroExp: round50((150 + level * 70) * mult),
  };
  if (level >= 9) currencies.gold = round50(level * 30 * mult);
  const items: Reward['items'] = {};
  if (firstClear) {
    currencies.diamonds = 5;
    const ch = chapterOf(level);
    if (isBossLevel(level)) {
      currencies.diamonds += 100 + 50 * (ch - 1);
      items.recruit_ticket = 1 + Math.floor(ch / 2);
    } else if (level % 4 === 0) {
      items.speedup_5m = 2;
    }
  }
  return finish(s, currencies, items, n);
}

/** Back-compat helper (level preview): just the reward. */
export function levelReward(s: GameState, level: number, survivors: number, stars: number, firstClear: boolean): Reward {
  return levelPayout(s, level, survivors, stars, firstClear).reward;
}

/** One-off reward for finishing the opening run. */
export function introPayout(s: GameState, survivors: number): Payout {
  return finish(s, { food: 2500, iron: 2000, heroExp: 1200, diamonds: 50 }, {}, Math.min(TROOP_CAP_FIRST, survivors));
}

function finish(s: GameState, currencies: NonNullable<Reward['currencies']>, items: NonNullable<Reward['items']>, soldiers: number): Payout {
  const { troops, overflow } = troopSplit(s, soldiers);
  if (overflow > 0) {
    currencies.food = (currencies.food ?? 0) + overflow * OVERFLOW_PAY.food;
    currencies.iron = (currencies.iron ?? 0) + overflow * OVERFLOW_PAY.iron;
  }
  const reward: Reward = { currencies };
  if (Object.keys(items).length) reward.items = items;
  if (troops > 0) reward.troops = { [Math.max(1, maxTrainTier(s))]: troops };
  return { reward, troops, overflow };
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
  /** Soldiers that joined the army / were sent home as supplies (no room). */
  troops: number;
  overflow: number;
  /** Replays: a rewarded-replay pass was spent, or none was left (practice run, no rewards). */
  usedPass: boolean;
  practice: boolean;
  passesLeft: number;
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
  let troops = 0;
  let overflow = 0;
  let usedPass = false;
  let practice = false;
  let passesLeft = 0;
  const t = now();
  mutate((s) => {
    const r = s.runner;
    r.runs++;
    refreshPasses(s, t);
    passesLeft = r.passes;
    if (sum.intro) {
      if (sum.won) {
        stars = starsFor(sum.survivors, sum.peak);
        if (!r.introDone) {
          const p = introPayout(s, sum.survivors);
          reward = p.reward;
          troops = p.troops;
          overflow = p.overflow;
          grantIn(s, p.reward);
        }
        r.introDone = true;
      }
      return;
    }
    if (!sum.won) return;
    stars = starsFor(sum.survivors, sum.peak);
    prevStars = r.stars[sum.level] ?? 0;
    firstClear = sum.level >= r.level;
    if (!firstClear) {
      // Rewarded replays cost a pass; without one the run still counts (stars/best) but pays nothing.
      if (r.passes > 0) {
        r.passes--;
        if (!r.passAt) r.passAt = t + PASS_REGEN_MS;
        usedPass = true;
      } else practice = true;
      passesLeft = r.passes;
    }
    if (!practice) {
      const p = levelPayout(s, sum.level, sum.survivors, stars, firstClear);
      reward = p.reward;
      troops = p.troops;
      overflow = p.overflow;
      grantIn(s, p.reward);
    }
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
  return { ...sum, stars, prevStars, firstClear, reward, troops, overflow, usedPass, practice, passesLeft, next, nextLock };
}

/** Player skipped the opening run from the pause menu: still mark it done and hand out the starter pack. */
export function skipIntro(): void {
  if (game.runner.introDone) return;
  mutate((s) => {
    grantIn(s, introPayout(s, 0).reward);
    s.runner.introDone = true;
  });
}

function round50(v: number): number {
  return Math.max(50, Math.round(v / 50) * 50);
}
