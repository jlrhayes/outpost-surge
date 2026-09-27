// OWNER: runner agent. "Special Ops" gate-runner level data.
// 48 levels in 6 chapters of 8. Each level is generated deterministically from a seeded recipe plus
// hand-tuned per-chapter parameters. The generator tracks an *expected* squad (size + weapon) as it lays
// out the road, so gate numbers, wave sizes, barrel HP and boss HP scale with what a decent player has.
import { hashSeed, mulberry32 } from '../core/rng';

export const LEVELS_PER_CHAPTER = 8;
export const CHAPTER_COUNT = 6;
export const LEVEL_COUNT = LEVELS_PER_CHAPTER * CHAPTER_COUNT;

/** Simulation constants shared by the generator (for balancing) and the runner mode. */
export const SIM = {
  /** Road spans x in [-roadHalf, roadHalf]. */
  roadHalf: 4,
  /** Gate panel centre offset from the road centre. */
  laneX: 2,
  /** Shots per soldier per second (logical). */
  fireRate: 2,
  /**
   * Visual bullets per second before fire-rate upgrades; each carries the pooled damage of many shots.
   * Every bullet that hits a gate adds +1, so this cap is also the gate "income" rate.
   */
  bulletCap: 12,
  bulletSpeed: 46,
  bulletRange: 31,
  /** Extra bullets per volley ("multi-shot") carry this fraction of a full bullet's damage. */
  multiDamage: 0.6,
  maxMulti: 3,
  maxCount: 99999,
  /** Distance ahead at which zombie waves wake up and start walking. */
  waveWake: 62,
  /** Distance the boss spawns ahead of the squad. */
  bossSpawn: 36,
};

export type RunnerTheme = 'outskirts' | 'docks' | 'highway' | 'mall' | 'frost' | 'core';

export interface ThemePalette {
  skyTop: number;
  skyHorizon: number;
  fog: number;
  ground: number;
  groundAlt: number;
  asphalt: number;
  sidewalk: number;
  ruin: number;
  ruinAlt: number;
  /** Relative weight of vegetation props (0 = none). */
  green: number;
}

export const THEMES: Record<RunnerTheme, ThemePalette> = {
  outskirts: { skyTop: 0x4d9be6, skyHorizon: 0xcfe6f5, fog: 0xcfe0ea, ground: 0x9aa05c, groundAlt: 0x857f4c, asphalt: 0x4a4d53, sidewalk: 0xb8b0a0, ruin: 0xa89f92, ruinAlt: 0x8c7f70, green: 1 },
  docks: { skyTop: 0x3f86d0, skyHorizon: 0xc6e0ee, fog: 0xc2d8e4, ground: 0x7e8a86, groundAlt: 0x5f6e70, asphalt: 0x45494e, sidewalk: 0xa7a8a2, ruin: 0x8a6e5a, ruinAlt: 0x5f7382, green: 0.3 },
  highway: { skyTop: 0x5a90d6, skyHorizon: 0xf0d7b5, fog: 0xe8d6bd, ground: 0xb49a6c, groundAlt: 0x9a7d55, asphalt: 0x3f4247, sidewalk: 0xbfb49c, ruin: 0x9a8a78, ruinAlt: 0x6b5b4d, green: 0.35 },
  mall: { skyTop: 0x5b8fd8, skyHorizon: 0xd9e4ef, fog: 0xd5dfe8, ground: 0x8e9188, groundAlt: 0x7c7f78, asphalt: 0x4b4d52, sidewalk: 0xc9c2b4, ruin: 0xb7aea0, ruinAlt: 0x7f8fa0, green: 0.5 },
  frost: { skyTop: 0x6d9ed8, skyHorizon: 0xe8f1f8, fog: 0xe4edf4, ground: 0xdfe8ee, groundAlt: 0xc3d0da, asphalt: 0x565b63, sidewalk: 0xd6dde2, ruin: 0x9ba3ac, ruinAlt: 0x7b8591, green: 0.6 },
  core: { skyTop: 0x5d6fae, skyHorizon: 0xd8c9cf, fog: 0xcdbfc8, ground: 0x7c7a5c, groundAlt: 0x6a5e52, asphalt: 0x3e3f44, sidewalk: 0xa39c92, ruin: 0x8a7f86, ruinAlt: 0x5f5664, green: 0.25 },
};

export interface ChapterDef {
  id: number;
  name: string;
  tagline: string;
  /** Minimum HQ level to enter this chapter. */
  hq: number;
  theme: RunnerTheme;
  /** Name of the big boss guarding the chapter's final level. */
  bossName: string;
}

export const CHAPTERS: ChapterDef[] = [
  { id: 1, name: 'Dustline Outskirts', tagline: 'Punch a road out of the fallen suburbs.', hq: 2, theme: 'outskirts', bossName: 'Rotbelly' },
  { id: 2, name: 'Rustwater Docks', tagline: 'Push through the flooded harbour yards.', hq: 3, theme: 'docks', bossName: 'Barnacle Brute' },
  { id: 3, name: 'Cinder Highway', tagline: 'Burned-out traffic and hungry packs.', hq: 5, theme: 'highway', bossName: 'Cinder Maw' },
  { id: 4, name: 'Hollow Mall', tagline: 'The shopping district is crawling.', hq: 7, theme: 'mall', bossName: 'The Mannequin King' },
  { id: 5, name: 'Frostbite Rail Yard', tagline: 'Cold steel, colder zombies.', hq: 9, theme: 'frost', bossName: 'Rimeback' },
  { id: 6, name: 'The Blight Core', tagline: 'Strike at the heart of the infestation.', hq: 12, theme: 'core', bossName: 'Blight Colossus' },
];

const BOSS_NAMES = ['Stomper', 'Mauler', 'Crusher', 'Slammer', 'Wrecker', 'Gnasher', 'Lurcher', 'Bonegrinder'];

export type ZombieKind = 'walker' | 'runner' | 'elite' | 'brute';
export type GateKind = 'add' | 'mul' | 'rate' | 'dmg';

export interface GateDef {
  /** Distance along the road. */
  d: number;
  /** -1 = left half of the road, +1 = right half. */
  side: -1 | 1;
  kind: GateKind;
  /** add: signed soldiers. mul: factor (negative = divide, see MUL_LADDER). rate/dmg: signed percent. */
  value: number;
  /** Bullet hits needed to raise the value one step (add gates: 1). */
  step: number;
}

export type BarrelReward = 'soldiers' | 'rate' | 'dmg' | 'multi' | 'tank' | 'rocket' | 'explosive';

export interface BarrelDef {
  d: number;
  x: number;
  hp: number;
  reward: BarrelReward;
  /** soldiers: count; rate/dmg: percent; multi: extra bullets; explosive: blast damage. */
  amount: number;
  /** Rolls toward the squad. */
  roll: boolean;
}

export interface SpawnDef {
  kind: ZombieKind;
  x: number;
  /** Depth offset behind the wave's front line. */
  dd: number;
}

export interface WaveDef {
  d: number;
  hp: Record<ZombieKind, number>;
  spawns: SpawnDef[];
}

export interface BossDef {
  name: string;
  hp: number;
  /** Walk speed toward the squad (units/s). */
  speed: number;
  /** Soldiers crushed per smash once it reaches the squad. */
  smash: number;
  scale: number;
  big: boolean;
  /** Seconds between minion packs (0 = none). */
  minionEvery: number;
  minionHp: number;
}

export interface CaptionDef {
  d: number;
  text: string;
  /** Seconds on screen. */
  dur: number;
}

export interface LevelDef {
  level: number;
  chapter: number;
  /** 1..8 within the chapter. */
  index: number;
  intro: boolean;
  /** "2-5" style label. */
  label: string;
  theme: RunnerTheme;
  /** Forward run speed (units/s). */
  speed: number;
  /** Distance at which the boss arena starts (the squad stops there). */
  length: number;
  startSoldiers: number;
  contact: Record<ZombieKind, number>;
  zspeed: Record<ZombieKind, number>;
  gates: GateDef[];
  barrels: BarrelDef[];
  waves: WaveDef[];
  boss: BossDef;
  captions: CaptionDef[];
  /** Kinds of zombies that appear (for the level preview). */
  threats: ZombieKind[];
  /** Rough expected soldier count at the boss for a decent run (preview only). */
  expected: number;
}

/** Multiplier gate ladder: negative = divide. Each `step` hits climbs one rung. */
export const MUL_LADDER = [-4, -3, -2, 2, 3, 4, 5];

export function mulStepUp(v: number): number {
  const i = MUL_LADDER.indexOf(v);
  if (i < 0) return v;
  return MUL_LADDER[Math.min(MUL_LADDER.length - 1, i + 1)];
}

export function gateIsGood(kind: GateKind, value: number): boolean {
  return kind === 'mul' ? value > 0 : value >= 0;
}

export function chapterOf(level: number): number {
  return Math.min(CHAPTER_COUNT, Math.max(1, Math.ceil(level / LEVELS_PER_CHAPTER)));
}

export function levelInChapter(level: number): number {
  return ((level - 1) % LEVELS_PER_CHAPTER) + 1;
}

export function isBossLevel(level: number): boolean {
  return level % LEVELS_PER_CHAPTER === 0;
}

export function levelLabel(level: number): string {
  return `${chapterOf(level)}-${levelInChapter(level)}`;
}

// ---------------------------------------------------------------------------------------------
// Per-chapter tuning. `alpha` = share of the squad's expected kill capacity a wave carries
// (higher = more leaks = harder); `red` = how punishing red gates are.
interface ChapterTune {
  speed: number;
  start: number;
  alpha0: number;
  alpha1: number;
  bossSec: number;
  red: number;
  peak: number;
}

const TUNE: ChapterTune[] = [
  { speed: 8.2, start: 5, alpha0: 0.44, alpha1: 0.72, bossSec: 5, red: 0.2, peak: 200 },
  { speed: 8.6, start: 7, alpha0: 0.66, alpha1: 0.86, bossSec: 5.5, red: 0.35, peak: 300 },
  { speed: 9.0, start: 9, alpha0: 0.78, alpha1: 0.98, bossSec: 6, red: 0.5, peak: 420 },
  { speed: 9.3, start: 11, alpha0: 0.9, alpha1: 1.1, bossSec: 6.5, red: 0.6, peak: 560 },
  { speed: 9.6, start: 13, alpha0: 1.0, alpha1: 1.2, bossSec: 7, red: 0.7, peak: 720 },
  { speed: 10.0, start: 15, alpha0: 1.1, alpha1: 1.3, bossSec: 7.5, red: 0.8, peak: 900 },
];

/** Tracks what a decent player's squad looks like at each point of the road. */
class Expect {
  count: number;
  rate = 1;
  dmg = 1;
  multi = 0;
  constructor(
    start: number,
    private speed: number,
  ) {
    this.count = start;
  }
  bulletsPerSec(): number {
    return Math.min(SIM.bulletCap * this.rate, this.count * SIM.fireRate * this.rate) * (1 + this.multi);
  }
  dps(): number {
    return this.count * SIM.fireRate * this.rate * this.dmg * (1 + SIM.multiDamage * this.multi);
  }
  /** Hits a player can pour into one gate while approaching it (gate in range for range/speed seconds). */
  gateHits(): number {
    return this.bulletsPerSec() * (SIM.bulletRange / this.speed) * 0.8;
  }
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function levelDef(level: number, intro = false): LevelDef {
  if (intro) return introLevel();
  level = clamp(Math.floor(level) || 1, 1, LEVEL_COUNT);
  const chapter = chapterOf(level);
  const index = levelInChapter(level);
  const tune = TUNE[chapter - 1];
  const ch = CHAPTERS[chapter - 1];
  const t = (level - 1) / (LEVEL_COUNT - 1);
  const k = (index - 1) / (LEVELS_PER_CHAPTER - 1);
  const boss = isBossLevel(level);
  const rng = mulberry32(hashSeed('outpost-surge-runner-' + level));
  const r = (a: number, b: number) => a + (b - a) * rng();
  const ri = (a: number, b: number) => Math.floor(r(a, b + 0.999));

  const speed = tune.speed + k * 0.4;
  const alpha = tune.alpha0 + (tune.alpha1 - tune.alpha0) * k + (boss ? 0.05 : 0);
  const exp = new Expect(tune.start + Math.floor(k * 2), speed);
  const peak = tune.peak * (0.75 + 0.5 * k);

  const nGates = clamp(Math.round(6 + t * 3 + r(-0.4, 1.2)), 6, 10);
  const nWaves = clamp(Math.round(4 + t * 3.4 + r(-0.4, 0.6)), 4, 8);
  const nBarrels = clamp(3 + ri(0, 2), 3, 5);
  const allowRunner = level >= 3;
  const allowBrute = level >= 5;
  const allowElite = level >= 10;

  // Distribute waves & barrels over the gate segments.
  const waveSeg: number[] = new Array(nGates + 1).fill(0);
  waveSeg[nGates] = 1; // final wave before the boss
  let wavesLeft = nWaves - 1;
  for (let pass = 0; wavesLeft > 0 && pass < 4; pass++) {
    for (let i = 1; i < nGates && wavesLeft > 0; i++) {
      if (waveSeg[i] > pass) continue;
      if (pass === 0 && rng() < 0.3 && wavesLeft < nGates - i) continue;
      waveSeg[i]++;
      wavesLeft--;
    }
  }
  const barrelSeg: number[] = new Array(nGates + 1).fill(0);
  barrelSeg[0] = 1;
  let barrelsLeft = nBarrels - 1;
  while (barrelsLeft > 0) {
    const i = ri(1, nGates - 1);
    if (barrelSeg[i] >= 1 && rng() < 0.7) continue;
    barrelSeg[i]++;
    barrelsLeft--;
  }

  const gates: GateDef[] = [];
  const barrels: BarrelDef[] = [];
  const waves: WaveDef[] = [];
  let helperGiven = level < 2;
  let weaponGates = 0;
  let explosivesLeft = level < 5 ? 1 : 2;

  const start = tune.start + Math.floor(k * 2);
  let d = speed * 3.2;
  for (let seg = 0; seg <= nGates; seg++) {
    const len = seg === nGates ? speed * 4.5 : speed * r(6, 7.8);
    const d0 = d;
    // Wave positions for this segment (zombies wake ~62 units ahead and walk toward the squad).
    const waveDs: number[] = [];
    for (let w = 0; w < waveSeg[seg]; w++) waveDs.push(d0 + len * (waveSeg[seg] > 1 ? 0.35 + 0.45 * w : 0.55) + 6);
    // Barrels early in the segment so there's time to shoot them.
    for (let b = 0; b < barrelSeg[seg]; b++) {
      let bd = d0 + len * (0.22 + 0.3 * b);
      let reward: BarrelReward;
      if (seg === 0) reward = 'soldiers';
      else if (!helperGiven && rng() < 0.45) {
        reward = rng() < 0.5 ? 'tank' : 'rocket';
        helperGiven = true;
      } else if (waveDs.length > 0 && explosivesLeft > 0 && rng() < 0.35) {
        reward = 'explosive';
        explosivesLeft--;
      }
      else
        reward = pickW(rng, [
          ['soldiers', 3],
          ['rate', 1.2],
          ['dmg', 1.2],
          ['multi', exp.multi < 2 ? 0.8 : 0],
        ]) as BarrelReward;
      // Explosive drums sit in a wave's front line: shoot them as the horde walks past.
      if (reward === 'explosive') bd = waveDs[0] - 1.5;
      const hpSec = reward === 'explosive' ? 0.2 : reward === 'tank' || reward === 'rocket' ? r(1.2, 1.6) : r(0.7, 1.3);
      const hp = niceNum(Math.max(6, exp.dps() * hpSec));
      let amount = 0;
      if (reward === 'soldiers') amount = Math.round(peak * r(0.06, 0.12)) + 3;
      else if (reward === 'rate') amount = 25;
      else if (reward === 'dmg') amount = 35;
      else if (reward === 'multi') amount = 1;
      const x = reward === 'explosive' ? r(-1.5, 1.5) : pick(rng, [-2, 2, -2, 2, 0]);
      barrels.push({ d: bd, x, hp, reward, amount, roll: reward !== 'explosive' && t > 0.15 && rng() < 0.3 });
      // Expected effect of picking it up.
      if (reward === 'soldiers') exp.count += amount * 0.85;
      else if (reward === 'rate') exp.rate *= 1.2;
      else if (reward === 'dmg') exp.dmg *= 1.3;
      else if (reward === 'multi') exp.multi = Math.min(SIM.maxMulti, exp.multi + 1);
      else if (reward === 'tank' || reward === 'rocket') exp.dmg *= 1.15;
    }
    for (const wd of waveDs) {
      const wave = makeWave(rng, wd, exp, alpha, level, { allowRunner, allowBrute, allowElite, final: seg === nGates });
      waves.push(wave);
      // Explosive drums next to this wave get a blast worth several walkers.
      for (const b of barrels) if (b.reward === 'explosive' && b.amount === 0) b.amount = Math.round(wave.hp.walker * 8 + 6);
      exp.count *= 1 - 0.1 * alpha;
    }
    d = d0 + len;
    if (seg < nGates) {
      const target = start + (peak - start) * Math.pow((seg + 1) / nGates, 1.15);
      const pair = makeGatePair(rng, d, exp, tune.red, t, seg, weaponGates < 2, target);
      if (pair.some((g) => g.kind === 'rate' || g.kind === 'dmg')) weaponGates++;
      gates.push(...pair);
      exp.count = Math.max(exp.count + 1, expectedAfter(pair, exp));
    }
  }
  const length = d;

  const threats: ZombieKind[] = ['walker'];
  if (waves.some((w) => w.spawns.some((s) => s.kind === 'runner'))) threats.push('runner');
  if (waves.some((w) => w.spawns.some((s) => s.kind === 'elite'))) threats.push('elite');
  if (waves.some((w) => w.spawns.some((s) => s.kind === 'brute'))) threats.push('brute');

  const bossHp = niceNum(exp.dps() * tune.bossSec * (boss ? 1.4 : 1) * (0.9 + 0.2 * k));
  const walkerHp = waves[waves.length - 1].hp.walker;
  const captions: CaptionDef[] = [];
  if (level === 1) captions.push({ d: 14, text: 'Shoot red gates to raise their numbers!', dur: 3.5 });
  if (level === 3) captions.push({ d: 14, text: 'Sprinters incoming: shoot the fast ones first!', dur: 3.5 });
  if (level === 5) captions.push({ d: 14, text: 'Brutes crush several soldiers at once. Focus fire!', dur: 3.5 });
  if (level === 10) captions.push({ d: 14, text: 'Elite zombies take a beating. Keep your squad big!', dur: 3.5 });

  return {
    level,
    chapter,
    index,
    intro: false,
    label: levelLabel(level),
    theme: ch.theme,
    speed,
    length,
    startSoldiers: start,
    contact: {
      walker: 1,
      runner: 2 + Math.floor(t * 3),
      elite: Math.max(3, Math.round(exp.count * 0.025)),
      brute: Math.max(6, Math.round(exp.count * 0.07)),
    },
    zspeed: { walker: 1.5 + t * 0.6, runner: 5.2 + t * 1.5, elite: 1.7 + t * 0.5, brute: 1.15 + t * 0.3 },
    gates,
    barrels,
    waves,
    boss: {
      name: boss ? ch.bossName : pick(rng, BOSS_NAMES),
      hp: bossHp,
      speed: 1.5 + t * 0.9,
      smash: Math.max(2, Math.round(exp.count * (0.06 + 0.06 * t))),
      scale: boss ? 1.35 : 1,
      big: boss,
      minionEvery: boss ? 3.4 : t > 0.45 ? 6 : 0,
      minionHp: Math.max(1, Math.round(walkerHp * 0.7)),
    },
    captions,
    threats,
    expected: Math.round(exp.count),
  };
}

/** Squad after a gate pair for a player who picks well and pours most of their fire into their gate. */
function expectedAfter(pair: GateDef[], exp: Expect): number {
  let best = 0;
  const h = exp.gateHits() * 0.85;
  for (const g of pair) {
    let v = exp.count;
    if (g.kind === 'add') v = exp.count + g.value + h;
    else if (g.kind === 'mul') v = g.value > 0 ? exp.count * g.value : exp.count / -g.value;
    best = Math.max(best, v);
  }
  return best;
}

/**
 * One gate encounter. `target` is where a decent player's squad should be after this gate; the good
 * option is sized so that (value + the hits they pour into it) lands near it. Multipliers only show up
 * when the squad is well behind the curve, so growth stays readable instead of exploding.
 */
function makeGatePair(rng: () => number, d: number, exp: Expect, red: number, t: number, i: number, allowWeapon: boolean, target: number): GateDef[] {
  const r = (a: number, b: number) => a + (b - a) * rng();
  const E = exp.count;
  const H = exp.gateHits();
  const income = H * 0.75;
  const need = target - E;
  // Blue value that gets a player who shoots it to ~target (never less than a token +3).
  const good = (jit = 1) => Math.max(3, Math.round((need - income) * jit + E * 0.05));
  // Climbing a multiplier rung takes nearly a full approach of focused fire.
  const mulStep = Math.max(8, Math.round(H * 0.95));
  const behind = target > E * 1.7;
  const ahead = E > target * 1.1;
  // The first gate of every level is a friendly "pick the blue one" pair.
  const tpl =
    i === 0
      ? 'addSub'
      : pickW(rng, [
          ['addSub', 1],
          ['mulAdd', behind ? 1.1 : 0],
          ['flip', 0.3 + t * 0.4 + (ahead ? 0.4 : 0)],
          ['mulDiv', behind && i >= 2 ? 0.3 + t * 0.4 : 0],
          ['divSub', ahead && t > 0.25 ? 0.5 : 0],
          ['weapon', allowWeapon ? 0.45 : 0],
          ['trap', i >= 2 ? t * 0.5 + (ahead ? 0.5 : 0) : 0],
        ]);
  let a: Omit<GateDef, 'd' | 'side'>;
  let b: Omit<GateDef, 'd' | 'side'>;
  const add = (v: number) => ({ kind: 'add' as const, value: Math.round(v), step: 1 });
  switch (tpl) {
    case 'mulAdd': {
      const f = target > E * 2.6 && t > 0.3 ? 3 : 2;
      a = { kind: 'mul', value: f, step: mulStep };
      b = add(Math.max(3, E * (f - 1) * r(0.6, 0.95) - income * 0.5));
      break;
    }
    case 'flip':
      // Both red: pour fire into the smaller one to turn it blue.
      a = add(-(H * r(0.3, 0.55) + 2));
      b = add(-(H * r(0.9, 1.3) + E * red * 0.3 + 4));
      break;
    case 'mulDiv':
      a = { kind: 'mul', value: 2, step: mulStep };
      b = { kind: 'mul', value: rng() < 0.6 ? -2 : -3, step: mulStep };
      break;
    case 'divSub':
      // Both bad: take the lesser evil (or shoot the minus gate up).
      a = { kind: 'mul', value: -2, step: mulStep };
      b = add(-(E * r(0.25, 0.4) + income * 0.6));
      break;
    case 'weapon': {
      const kind = rng() < 0.5 ? 'rate' : 'dmg';
      const neg = rng() < red * 0.6;
      a = { kind, value: neg ? -Math.round(r(10, 20)) : Math.round(r(15, 30)), step: 3 };
      b = add(good(r(0.7, 1)));
      break;
    }
    case 'trap':
      a = add(-(E * r(0.6, 0.9) + H * 1.1 + 5));
      b = add(good(r(0.8, 1)));
      break;
    default:
      a = add(good(r(0.85, 1.15)));
      b = add(-(E * r(0.2, 0.45) + H * red + 2));
  }
  const s: -1 | 1 = rng() < 0.5 ? -1 : 1;
  return [
    { ...a, d, side: s },
    { ...b, d, side: (-s) as -1 | 1 },
  ];
}

function makeWave(
  rng: () => number,
  d: number,
  exp: Expect,
  alpha: number,
  level: number,
  opt: { allowRunner: boolean; allowBrute: boolean; allowElite: boolean; final: boolean },
): WaveDef {
  const r = (a: number, b: number) => a + (b - a) * rng();
  const budget = exp.dps() * 2.7 * alpha * (opt.final ? 1.25 : 1);
  // Aim for ~18-30 walker-equivalents per wave; walker HP absorbs the rest.
  const target = 16 + Math.min(14, level * 0.5);
  const walker = Math.max(1, Math.round(budget / target));
  const hp: Record<ZombieKind, number> = {
    walker,
    runner: Math.max(1, Math.round(walker * 0.6)),
    elite: Math.max(4, Math.round(walker * 4)),
    brute: Math.max(8, Math.round(walker * 11)),
  };
  let units = budget / walker; // walker-equivalents
  const spawns: SpawnDef[] = [];
  // Brutes lead from the back-centre.
  if (opt.allowBrute && rng() < 0.55 + (opt.final ? 0.3 : 0)) {
    const n = Math.min(3, Math.max(1, Math.floor(units / 30)));
    for (let i = 0; i < n; i++) spawns.push({ kind: 'brute', x: (i - (n - 1) / 2) * 2.2, dd: 5 + r(0, 1.5) });
    units -= n * 11;
  }
  if (opt.allowElite && rng() < 0.6) {
    const n = Math.min(4, Math.max(1, Math.floor(units / 20)));
    for (let i = 0; i < n; i++) spawns.push({ kind: 'elite', x: r(-2.8, 2.8), dd: r(2, 4) });
    units -= n * 4;
  }
  if (opt.allowRunner && rng() < 0.6) {
    const n = clamp(Math.round(units * r(0.15, 0.3) / 0.6), 3, 10);
    const cx = r(-2, 2);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 3);
      spawns.push({ kind: 'runner', x: clamp(cx + ((i % 3) - 1) * 0.9, -3.6, 3.6), dd: 10 + row * 1.2 });
    }
    units -= n * 0.6;
  }
  const n = clamp(Math.round(units), 4, 42);
  const shape = pick(rng, ['block', 'block', 'column', 'wedge', 'scatter'] as const);
  for (let i = 0; i < n; i++) {
    let x = 0;
    let dd = 0;
    if (shape === 'block') {
      const cols = n > 20 ? 7 : 5;
      x = ((i % cols) - (cols - 1) / 2) * (6.8 / cols) + r(-0.15, 0.15);
      dd = Math.floor(i / cols) * 1.1;
    } else if (shape === 'column') {
      const cx = rng() < 0.5 ? -2 : 2;
      x = cx + ((i % 3) - 1) * 0.85 + r(-0.1, 0.1);
      dd = Math.floor(i / 3) * 0.95;
    } else if (shape === 'wedge') {
      const row = Math.floor(Math.sqrt(i));
      const inRow = i - row * row;
      x = clamp((inRow - row) * 0.55, -3.6, 3.6);
      dd = row * 1.1;
    } else {
      x = r(-3.5, 3.5);
      dd = r(0, 9);
    }
    spawns.push({ kind: 'walker', x, dd });
  }
  return { d, hp, spawns };
}

function introLevel(): LevelDef {
  const W = (kind: ZombieKind, x: number, dd: number): SpawnDef => ({ kind, x, dd });
  const block = (n: number, cols: number, x0 = 0, spread = 6.4): SpawnDef[] => {
    const out: SpawnDef[] = [];
    for (let i = 0; i < n; i++) out.push(W('walker', x0 + ((i % cols) - (cols - 1) / 2) * (spread / cols), Math.floor(i / cols) * 1.1));
    return out;
  };
  return {
    level: 1,
    chapter: 1,
    index: 1,
    intro: true,
    label: 'Prologue',
    theme: 'outskirts',
    speed: 8.6,
    length: 318,
    startSoldiers: 4,
    contact: { walker: 1, runner: 2, elite: 3, brute: 5 },
    zspeed: { walker: 1.5, runner: 5, elite: 1.7, brute: 1.2 },
    gates: [
      { d: 46, side: -1, kind: 'add', value: 8, step: 1 },
      { d: 46, side: 1, kind: 'add', value: -3, step: 1 },
      { d: 112, side: -1, kind: 'add', value: 6, step: 1 },
      { d: 112, side: 1, kind: 'mul', value: 2, step: 45 },
      { d: 172, side: -1, kind: 'add', value: -25, step: 1 },
      { d: 172, side: 1, kind: 'add', value: -60, step: 1 },
      { d: 230, side: -1, kind: 'mul', value: 2, step: 60 },
      { d: 230, side: 1, kind: 'add', value: 30, step: 1 },
      { d: 286, side: -1, kind: 'add', value: 40, step: 1 },
      { d: 286, side: 1, kind: 'rate', value: 30, step: 3 },
    ],
    barrels: [
      { d: 84, x: 2, hp: 70, reward: 'soldiers', amount: 12, roll: false },
      { d: 200, x: -1.5, hp: 220, reward: 'tank', amount: 1, roll: false },
      { d: 262.5, x: 1.2, hp: 12, reward: 'explosive', amount: 40, roll: false },
    ],
    waves: [
      { d: 154, hp: { walker: 3, runner: 1, elite: 6, brute: 30 }, spawns: block(16, 4, 0, 5) },
      { d: 264, hp: { walker: 4, runner: 3, elite: 8, brute: 90 }, spawns: [...block(24, 6), W('brute', 0, 5), W('runner', -1, 9), W('runner', 0, 9), W('runner', 1, 9)] },
    ],
    boss: { name: 'The Gatecrusher', hp: 8000, speed: 1.9, smash: 8, scale: 1.7, big: true, minionEvery: 0, minionHp: 1 },
    captions: [
      { d: 2, text: 'The city fell overnight. Your squad is the last one moving.', dur: 3.2 },
      { d: 22, text: 'Drag left or right to steer your squad', dur: 3.2 },
      { d: 52, text: 'Shoot crates to crack them open', dur: 3 },
      { d: 92, text: 'Blue gates add soldiers. Avoid the red ones!', dur: 3.2 },
      { d: 140, text: 'Every bullet that hits a gate raises its number. Shoot red gates until they turn blue!', dur: 4.2 },
      { d: 186, text: 'Supply crate! Break it for backup.', dur: 3 },
      { d: 244, text: 'Red drums explode. Blow them up next to zombies!', dur: 3.2 },
      { d: 300, text: 'Something huge is blocking the road...', dur: 3 },
    ],
    threats: ['walker', 'runner', 'brute'],
    expected: 150,
  };
}

// ---------------------------------------------------------------------------------------------
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickW(rng: () => number, opts: [string, number][]): string {
  let total = 0;
  for (const o of opts) total += Math.max(0, o[1]);
  let x = rng() * total;
  for (const o of opts) {
    x -= Math.max(0, o[1]);
    if (x <= 0 && o[1] > 0) return o[0];
  }
  return opts[0][0];
}

/** Rounds to 2 significant figures for readable HP numbers. */
function niceNum(v: number): number {
  if (v < 20) return Math.round(v);
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}
