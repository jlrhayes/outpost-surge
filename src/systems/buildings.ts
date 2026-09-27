// OWNER: base agent. Building rules: upgrades, construction queue, production, gating.
// The exported query functions at the top are a CONTRACT used by other modules — keep their signatures.
import { game, mutate, version, type GameState } from '../core/store';
import type { BonusKey, BuildingType, Cost, CurrencyId } from '../core/types';
import type { BuildingState } from '../state/base';
import { getBonus } from '../core/bonuses';
import { emit } from '../core/events';
import { addStat, canAfford, grantIn, shortfall, spendIn } from '../core/economy';
import { now } from '../core/tick';
import { districtsCleared } from '../core/unlocks';
import {
  BASE_FREE_FINISH_MS,
  BASE_HOSPITAL_BEDS,
  BASE_TROOP_CAPACITY,
  BUILDINGS,
  MAX_BUILDERS,
  MAX_BUILDING_LEVEL,
  PLOTS,
  PLOT_TYPES,
  PRODUCER_CAP_HOURS,
  SECOND_BUILDER_DIAMONDS,
  baseUpgradeMs,
  batchAt,
  bonusesAt,
  buildingName,
  buildingPower,
  centerMarchAt,
  diamondsForMs,
  drillCapacityAt,
  hospitalBedsAt,
  hqMarchAt,
  hqPrereqs,
  plotDef,
  productionAt,
  tierAt,
  upgradeCost,
  type UnlockRule,
} from '../data/buildings';

// =============================================================================================
// CONTRACT queries
// =============================================================================================

/** Headquarters level (gates most content). */
export function hqLevel(s: GameState): number {
  return buildingLevel(s, 'hq');
}

/** Highest level among buildings of this type (0 if none built). */
export function buildingLevel(s: GameState, type: BuildingType): number {
  let lv = 0;
  for (const b of s.base.buildings) if (b.type === type && b.level > lv) lv = b.level;
  return lv;
}

/** All building instances of a type. */
export function buildingsOf(s: GameState, type: BuildingType): BuildingState[] {
  return s.base.buildings.filter((b) => b.type === type);
}

export function getBuilding(s: GameState, uid: string): BuildingState | undefined {
  return s.base.buildings.find((b) => b.uid === uid);
}

/** Per-hour production of a resource across all producers (after bonuses). */
export function productionPerHour(s: GameState, resource: 'food' | 'iron' | 'gold'): number {
  let total = 0;
  for (const b of s.base.buildings) if (BUILDINGS[b.type]?.produces === resource) total += producerRate(s, b);
  return Math.round(total);
}

// ---- Building-derived capacities (CONTRACT: used by troops/heroes modules) ----

/** Max ready soldiers the base can house (Parade Yards). */
export function troopCapacity(s: GameState): number {
  let n = BASE_TROOP_CAPACITY;
  for (const b of s.base.buildings) if (b.type === 'drill') n += drillCapacityAt(b.level);
  return n;
}

/** Max wounded soldiers hospitals can hold; overflow dies. */
export function hospitalCapacity(s: GameState): number {
  let n = BASE_HOSPITAL_BEDS;
  for (const b of s.base.buildings) if (b.type === 'hospital') n += hospitalBedsAt(b.level);
  return n;
}

/** Highest soldier tier trainable (from Barracks level), 1..10. */
export function maxTrainTier(s: GameState): number {
  return tierAt(buildingLevel(s, 'barracks'));
}

/** Soldiers per training batch at one barracks. */
export function trainBatchSize(s: GameState, barracksUid?: string): number {
  const b = barracksUid ? getBuilding(s, barracksUid) : undefined;
  const lv = b ? b.level : buildingLevel(s, 'barracks');
  return batchAt(Math.max(1, lv));
}

/** Soldiers each hero of this type can lead into battle (march size per hero). Includes type-center bonuses. */
export function marchSizePerHero(s: GameState, heroType: 'tank' | 'aircraft' | 'missile'): number {
  const center = heroType === 'tank' ? 'tankcenter' : heroType === 'aircraft' ? 'aircenter' : 'missilecenter';
  return hqMarchAt(hqLevel(s)) + centerMarchAt(buildingLevel(s, center));
}

/** Remaining time (ms) at or below which a construction can be finished for free. */
export function freeFinishMs(s: GameState): number {
  return BASE_FREE_FINISH_MS + Math.max(0, getBonus(s, 'free_finish_min')) * 60_000;
}

// =============================================================================================
// Derived helpers
// =============================================================================================

export function isUpgrading(b: BuildingState): boolean {
  return b.upgradeEndsAt !== null;
}

export function busyBuilders(s: GameState): number {
  let n = 0;
  for (const b of s.base.buildings) if (b.upgradeEndsAt !== null) n++;
  return n;
}

export function hasFreeBuilder(s: GameState): boolean {
  return busyBuilders(s) < s.base.builders;
}

export function ruleMet(s: GameState, r: UnlockRule): boolean {
  if (r.hq && hqLevel(s) < r.hq) return false;
  if (r.districts && districtsCleared(s) < r.districts) return false;
  return true;
}

export function ruleText(r: UnlockRule): string {
  const parts: string[] = [];
  if (r.hq) parts.push(`${buildingName('hq')} Lv ${r.hq}`);
  if (r.districts) parts.push(`${r.districts} district${r.districts > 1 ? 's' : ''} cleared`);
  return parts.length ? 'Requires ' + parts.join(' & ') : '';
}

/** How many buildings of this type the player may currently own. */
export function maxCount(s: GameState, type: BuildingType): number {
  let n = 0;
  for (const r of BUILDINGS[type].unlocks) if (ruleMet(s, r)) n++;
  return n;
}

/** The rule for the next instance beyond what is owned, or null if all instances exist. */
export function nextInstanceRule(s: GameState, type: BuildingType): UnlockRule | null {
  const owned = buildingsOf(s, type).length;
  return BUILDINGS[type].unlocks[owned] ?? null;
}

export function plotUnlocked(s: GameState, plotId: number): boolean {
  const p = plotDef(plotId);
  return !!p && p.district <= districtsCleared(s);
}

export function buildingOnPlot(s: GameState, plotId: number): BuildingState | undefined {
  return s.base.buildings.find((b) => b.plot === plotId);
}

/** Empty, unlocked plots that accept this building type. */
export function freePlotsFor(s: GameState, type: BuildingType): number[] {
  const kind = BUILDINGS[type].plot;
  const out: number[] = [];
  for (const p of PLOTS) if (p.kind === kind && plotUnlocked(s, p.id) && !buildingOnPlot(s, p.id)) out.push(p.id);
  return out;
}

/** True if at least one building type could be constructed on this plot right now (ignoring cost/builders). */
export function plotHasBuildable(s: GameState, plotId: number): boolean {
  const p = plotDef(plotId);
  if (!p) return false;
  for (const t of PLOT_TYPES[p.kind]) if (buildingsOf(s, t).length < maxCount(s, t)) return true;
  return false;
}

/** Actual build time (ms) to reach `level`, after build-speed bonuses. */
export function upgradeTimeMs(s: GameState, type: BuildingType, level: number): number {
  const speed = Math.max(0, getBonus(s, 'build_speed_pct'));
  return Math.max(1000, Math.round(baseUpgradeMs(type, level) / (1 + speed / 100)));
}

export interface Requirement {
  label: string;
  met: boolean;
  /** Where "Go" should send the player. */
  focus?: { type: BuildingType };
}

/** Building requirements (not resources/builders) to upgrade a building TO `level`. */
export function levelRequirements(s: GameState, type: BuildingType, level: number): Requirement[] {
  const out: Requirement[] = [];
  if (type === 'hq') {
    for (const p of hqPrereqs(level)) {
      out.push({ label: `${buildingName(p.type)} Lv ${p.level}`, met: buildingLevel(s, p.type) >= p.level, focus: { type: p.type } });
    }
  } else if (level >= 2) {
    out.push({ label: `${buildingName('hq')} Lv ${level}`, met: hqLevel(s) >= level, focus: { type: 'hq' } });
  }
  return out;
}

export type UpgradeBlock = 'max' | 'upgrading' | 'requirements' | 'builders' | 'resources' | 'missing';

/** Why a building can't be upgraded right now (null = it can). */
export function upgradeBlock(s: GameState, b: BuildingState | undefined): UpgradeBlock | null {
  if (!b) return 'missing';
  if (b.level >= MAX_BUILDING_LEVEL) return 'max';
  if (b.upgradeEndsAt !== null) return 'upgrading';
  const to = b.level + 1;
  for (const r of levelRequirements(s, b.type, to)) if (!r.met) return 'requirements';
  if (!hasFreeBuilder(s)) return 'builders';
  if (!canAfford(s, upgradeCost(b.type, to))) return 'resources';
  return null;
}

const CURRENCY_LABEL: Partial<Record<CurrencyId, string>> = { food: 'Food', iron: 'Iron', gold: 'Gold', diamonds: 'Diamonds', heroExp: 'Hero EXP' };

/** "Not enough Food & Iron" for a cost the player can't afford. */
export function shortText(cost: Cost): string {
  const miss = Object.keys(shortfall(game, cost)) as CurrencyId[];
  return miss.length ? `Not enough ${miss.map((k) => CURRENCY_LABEL[k] ?? k).join(' & ')}` : blockText('resources');
}

export function blockText(block: UpgradeBlock): string {
  switch (block) {
    case 'max':
      return 'Already at max level';
    case 'upgrading':
      return 'Already upgrading';
    case 'requirements':
      return 'Requirements not met';
    case 'builders':
      return 'All builders are busy';
    case 'resources':
      return 'Not enough resources';
    default:
      return 'Unavailable';
  }
}

// ---- Production ----

const PROD_BONUS: Partial<Record<CurrencyId, BonusKey>> = {
  food: 'food_prod_pct',
  iron: 'iron_prod_pct',
  gold: 'gold_prod_pct',
  heroExp: 'exp_prod_pct',
};

/** Output per hour of one producer (after bonuses). 0 for non-producers. */
export function producerRate(s: GameState, b: BuildingState): number {
  const res = BUILDINGS[b.type]?.produces;
  if (!res || b.level < 1) return 0;
  const key = PROD_BONUS[res];
  const pct = key ? getBonus(s, key) : 0;
  return productionAt(b.type, b.level) * (1 + pct / 100);
}

/** Max output one producer stores before it stops. */
export function producerCap(s: GameState, b: BuildingState): number {
  return producerRate(s, b) * PRODUCER_CAP_HOURS * (1 + Math.max(0, getBonus(s, 'storage_pct')) / 100);
}

/** Uncollected output sitting in a producer (fractional). */
export function uncollected(s: GameState, b: BuildingState, t = now()): number {
  const rate = producerRate(s, b);
  if (rate <= 0) return 0;
  const cap = producerCap(s, b);
  const acc = (b.stored ?? 0) + (rate * Math.max(0, t - b.collectedAt)) / 3_600_000;
  return Math.min(cap, acc);
}

/** Per-hour Hero EXP from Combat Academies. */
export function heroExpPerHour(s: GameState): number {
  let total = 0;
  for (const b of s.base.buildings) if (b.type === 'trainingbase') total += producerRate(s, b);
  return Math.round(total);
}

// ---- Bonuses & power (registered as providers in src/init/base.ts) ----

let bonusCache: { v: number; data: Partial<Record<BonusKey, number>> } | null = null;

/** Summed stat/economy bonuses from all buildings (cached per state version). */
export function buildingBonuses(s: GameState): Partial<Record<BonusKey, number>> {
  const v = version.peek();
  if (s === game && bonusCache && bonusCache.v === v) return bonusCache.data;
  const out: Partial<Record<BonusKey, number>> = {};
  // Stacking rule: warehouses stack; for every other type the highest-level instance counts.
  const best = new Map<BuildingType, number>();
  for (const b of s.base.buildings) {
    if (b.level < 1) continue;
    if (b.type === 'warehouse') {
      for (const [k, val] of Object.entries(bonusesAt(b.type, b.level))) out[k] = (out[k] ?? 0) + (val ?? 0);
    } else if ((best.get(b.type) ?? 0) < b.level) best.set(b.type, b.level);
  }
  for (const [type, lv] of best) {
    for (const [k, val] of Object.entries(bonusesAt(type, lv))) out[k] = (out[k] ?? 0) + (val ?? 0);
  }
  if (s === game) bonusCache = { v, data: out };
  return out;
}

export function buildingsPower(s: GameState): number {
  let p = 0;
  for (const b of s.base.buildings) p += buildingPower(b.type, b.level);
  return p;
}

// =============================================================================================
// Mutations (call these from UI; they wrap mutate() and emit events afterwards)
// =============================================================================================

export interface ActionResult {
  ok: boolean;
  reason?: string;
  block?: UpgradeBlock;
}

function nextUid(s: GameState, type: BuildingType): string {
  let n = 0;
  for (const b of s.base.buildings) {
    if (b.type !== type) continue;
    const m = /_(\d+)$/.exec(b.uid);
    if (m) n = Math.max(n, Number(m[1]));
  }
  let uid = `${type}_${n + 1}`;
  while (s.base.buildings.some((b) => b.uid === uid)) uid = `${type}_${++n + 1}`;
  return uid;
}

/** Starts the timed upgrade (or first construction, for level 0) of a building. */
export function startUpgrade(uid: string): ActionResult {
  const b0 = getBuilding(game, uid);
  const block = upgradeBlock(game, b0);
  if (block === 'requirements' && b0) {
    const miss = levelRequirements(game, b0.type, b0.level + 1).find((r) => !r.met);
    return { ok: false, block, reason: miss ? `Requires ${miss.label}` : blockText(block) };
  }
  if (block === 'resources' && b0) return { ok: false, block, reason: shortText(upgradeCost(b0.type, b0.level + 1)) };
  if (block) return { ok: false, block, reason: blockText(block) };
  let started: { type: BuildingType; toLevel: number } | null = null;
  mutate((s) => {
    const b = getBuilding(s, uid)!;
    const to = b.level + 1;
    if (!spendIn(s, upgradeCost(b.type, to))) return;
    const t = now();
    b.upgradeStartedAt = t;
    b.upgradeEndsAt = t + upgradeTimeMs(s, b.type, to);
    started = { type: b.type, toLevel: to };
  });
  if (!started) return { ok: false, block: 'resources', reason: blockText('resources') };
  const st = started as { type: BuildingType; toLevel: number };
  emit('building:upgradeStarted', { uid, type: st.type, toLevel: st.toLevel });
  return { ok: true };
}

/** Why a new building can't be constructed on a plot (null = it can). */
export function constructBlock(s: GameState, type: BuildingType, plotId: number): string | null {
  const p = plotDef(plotId);
  if (!p) return 'Unknown plot';
  if (!plotUnlocked(s, plotId)) return `Clear district ${p.district} first`;
  if (buildingOnPlot(s, plotId)) return 'Plot is occupied';
  if (BUILDINGS[type].plot !== p.kind) return 'Wrong plot type';
  if (buildingsOf(s, type).length >= maxCount(s, type)) {
    const r = nextInstanceRule(s, type);
    return r ? ruleText(r) : 'Maximum number built';
  }
  if (!hasFreeBuilder(s)) return blockText('builders');
  if (!canAfford(s, upgradeCost(type, 1))) return shortText(upgradeCost(type, 1));
  return null;
}

/** Places a new building (level 0) on a plot and starts its construction to level 1. Returns the uid. */
export function constructBuilding(type: BuildingType, plotId: number): ActionResult & { uid?: string } {
  const why = constructBlock(game, type, plotId);
  if (why) return { ok: false, reason: why };
  let uid = '';
  mutate((s) => {
    if (!spendIn(s, upgradeCost(type, 1))) return;
    const t = now();
    uid = nextUid(s, type);
    s.base.buildings.push({
      uid,
      type,
      level: 0,
      plot: plotId,
      upgradeStartedAt: t,
      upgradeEndsAt: t + upgradeTimeMs(s, type, 1),
      collectedAt: t,
      stored: 0,
    });
  });
  if (!uid) return { ok: false, reason: blockText('resources') };
  emit('building:upgradeStarted', { uid, type, toLevel: 1 });
  return { ok: true, uid };
}

interface Completed {
  uid: string;
  type: BuildingType;
  level: number;
}

function applyLevelUp(s: GameState, b: BuildingState, t: number): Completed {
  if (BUILDINGS[b.type].produces) {
    // Bank what was produced at the old level, then continue accruing at the new rate.
    b.stored = b.level >= 1 ? uncollected(s, b, t) : 0;
    b.collectedAt = t;
  }
  b.level = Math.min(MAX_BUILDING_LEVEL, b.level + 1);
  b.upgradeEndsAt = null;
  b.upgradeStartedAt = null;
  addStat(s, b.level === 1 ? 'buildingsBuilt' : 'buildingUpgrades');
  return { uid: b.uid, type: b.type, level: b.level };
}

/** Completes every upgrade whose timer has run out. Use inside a ticker / mutate(). */
export function completeDueIn(s: GameState, t: number): Completed[] {
  const done: Completed[] = [];
  for (const b of s.base.buildings) {
    // Clock moved backwards (device time change / debug skip undone): don't freeze producers for hours.
    if (b.collectedAt > t + 60_000) b.collectedAt = t;
    if (b.upgradeEndsAt !== null && b.upgradeEndsAt <= t) done.push(applyLevelUp(s, b, t));
  }
  return done;
}

function emitCompleted(done: Completed[]): void {
  for (const d of done) emit('building:upgraded', d);
}

/** Runs completion immediately (after speed-ups / free finish) instead of waiting for the next tick. */
export function checkCompletions(): void {
  let done: Completed[] = [];
  mutate((s) => {
    done = completeDueIn(s, now());
  });
  emitCompleted(done);
}

/** Remaining ms of a running upgrade (0 if idle). */
export function remainingMs(b: BuildingState, t = now()): number {
  return b.upgradeEndsAt === null ? 0 : Math.max(0, b.upgradeEndsAt - t);
}

export function canFinishFree(s: GameState, b: BuildingState, t = now()): boolean {
  return b.upgradeEndsAt !== null && remainingMs(b, t) <= freeFinishMs(s);
}

/** Finishes an upgrade for free when it is inside the free-finish window. */
export function finishFree(uid: string): ActionResult {
  const b = getBuilding(game, uid);
  if (!b || !canFinishFree(game, b)) return { ok: false, reason: 'Not ready for a free finish' };
  let done: Completed[] = [];
  mutate((s) => {
    const bb = getBuilding(s, uid)!;
    done = [applyLevelUp(s, bb, now())];
  });
  emitCompleted(done);
  return { ok: true };
}

/** Diamonds needed to finish a running upgrade now. */
export function finishNowDiamonds(s: GameState, b: BuildingState): number {
  if (b.upgradeEndsAt === null || canFinishFree(s, b)) return 0;
  return diamondsForMs(remainingMs(b));
}

/** Pays diamonds to finish a running upgrade immediately. */
export function finishNow(uid: string): ActionResult {
  const b = getBuilding(game, uid);
  if (!b || b.upgradeEndsAt === null) return { ok: false, reason: 'Nothing to finish' };
  const cost = finishNowDiamonds(game, b);
  if (game.currencies.diamonds < cost) return { ok: false, reason: 'Not enough diamonds' };
  let done: Completed[] = [];
  mutate((s) => {
    const bb = getBuilding(s, uid)!;
    s.currencies.diamonds -= cost;
    done = [applyLevelUp(s, bb, now())];
  });
  emitCompleted(done);
  return { ok: true };
}

/** Diamonds for the "Instant" upgrade (skips the whole timer; resources are still paid). */
export function instantUpgradeDiamonds(s: GameState, b: BuildingState): number {
  return diamondsForMs(upgradeTimeMs(s, b.type, b.level + 1));
}

/** Pays resources + diamonds and levels the building up immediately (no builder needed). */
export function instantUpgrade(uid: string): ActionResult {
  const b = getBuilding(game, uid);
  if (!b) return { ok: false, reason: 'Unknown building' };
  const block = upgradeBlock(game, b);
  if (block === 'resources') return { ok: false, block, reason: shortText(upgradeCost(b.type, b.level + 1)) };
  if (block === 'requirements') {
    const miss = levelRequirements(game, b.type, b.level + 1).find((r) => !r.met);
    return { ok: false, block, reason: miss ? `Requires ${miss.label}` : blockText(block) };
  }
  if (block && block !== 'builders') return { ok: false, block, reason: blockText(block) };
  const to = b.level + 1;
  const dia = instantUpgradeDiamonds(game, b);
  if (game.currencies.diamonds < dia) return { ok: false, reason: 'Not enough diamonds' };
  let done: Completed[] = [];
  mutate((s) => {
    const bb = getBuilding(s, uid)!;
    if (!spendIn(s, { ...upgradeCost(bb.type, to), diamonds: dia })) return;
    done = [applyLevelUp(s, bb, now())];
  });
  if (!done.length) return { ok: false, reason: blockText('resources') };
  emit('building:upgradeStarted', { uid, type: b.type, toLevel: to });
  emitCompleted(done);
  return { ok: true };
}

/** Reduces a running upgrade timer by `ms` (speed-up items / helps). Completes it if it reaches 0. */
export function applySpeedup(uid: string, ms: number): void {
  if (!(ms > 0)) return;
  mutate((s) => {
    const b = getBuilding(s, uid);
    if (b && b.upgradeEndsAt !== null) b.upgradeEndsAt -= ms;
  });
  checkCompletions();
}

export function canBuyBuilder(s: GameState): boolean {
  return s.base.builders < MAX_BUILDERS;
}

/** Buys the permanent 2nd builder queue. */
export function buySecondBuilder(): ActionResult {
  if (!canBuyBuilder(game)) return { ok: false, reason: 'All builder queues unlocked' };
  if (game.currencies.diamonds < SECOND_BUILDER_DIAMONDS) return { ok: false, reason: 'Not enough diamonds' };
  mutate((s) => {
    s.currencies.diamonds -= SECOND_BUILDER_DIAMONDS;
    s.base.builders = Math.min(MAX_BUILDERS, s.base.builders + 1);
  });
  return { ok: true };
}

/** Collects a producer's output. Returns the amount collected (0 if nothing). */
export function collectBuilding(uid: string): { resource: CurrencyId; amount: number } | null {
  const b = getBuilding(game, uid);
  const res = b ? BUILDINGS[b.type].produces : undefined;
  if (!b || !res) return null;
  const t = now();
  const avail = uncollected(game, b, t);
  const amount = Math.floor(avail);
  if (amount < 1) return null;
  mutate((s) => {
    const bb = getBuilding(s, uid)!;
    grantIn(s, { currencies: { [res]: amount } });
    bb.stored = avail - amount;
    bb.collectedAt = t;
  });
  emit('resource:collected', { resource: res, amount });
  return { resource: res, amount };
}

/** Minimum uncollected output before a collect bubble shows (a few minutes of output). */
export function bubbleThreshold(s: GameState, b: BuildingState): number {
  return Math.max(10, producerRate(s, b) / 30);
}
