// OWNER: world agent. World-map simulation: procedural terrain, map entities (zombie hordes, resource
// tiles, rival outposts, radar pins), marches, battle reports, stamina and the radar mission board.
//
// All timers are absolute timestamps processed by the 'world' ticker (src/init/world.ts), so marches
// resolve correctly after the app was closed. Functions that take `s` and mutate it must be called
// inside mutate() (or from the ticker).
import type { GameState } from '../core/store';
import type { Combatant, CurrencyId, HeroType, Rarity, Reward } from '../core/types';
import { hashSeed, mulberry32, randInt } from '../core/rng';
import { bonusMult, getBonus } from '../core/bonuses';
import { addStat, grantIn } from '../core/economy';
import { emit } from '../core/events';
import { route, toast } from '../core/nav';
import { now } from '../core/tick';
import { isUnlocked } from '../core/unlocks';
import { sfx } from '../core/audio';
import { fmt } from '../core/format';
import { squadCombatants, squadPower, squadReady } from './heroes';
import { simulateBattle, type BattleResult } from './battle';
import { applyTroopLosses, bestTroopTier, totalTroops } from './troops';
import { marchSizePerHero } from './buildings';
import * as D from '../data/world';

export type HordeVariant = D.HordeVariant;
export type ResKind = D.ResKind;

// =====================================================================================
// Types (persisted in game.world)
// =====================================================================================

interface EntityBase {
  id: string;
  /** Tile coordinates (0..MAP_TILES-1). */
  tx: number;
  ty: number;
  /** Radar mission that spawned/marked this entity. */
  radarId?: string;
}
export interface HordeEntity extends EntityBase {
  kind: 'horde';
  level: number;
  variant: HordeVariant;
}
export interface ResourceEntity extends EntityBase {
  kind: 'resource';
  res: ResKind;
  level: number;
  /** Units left on the tile. */
  amount: number;
  capacity: number;
}
export interface RivalEntity extends EntityBase {
  kind: 'rival';
  name: string;
  commander: string;
  tag: string;
  level: number;
  basePower: number;
  bornAt: number;
  /** Raided outposts are shielded until this timestamp. */
  shieldUntil: number;
  color: number;
}
/** Radar pickups resolved instantly from the info panel. */
export interface PickupEntity extends EntityBase {
  kind: 'pickup';
  pickup: 'survivor' | 'cache';
}
/** Radar treasure dig site (needs a squad to dig). */
export interface DigEntity extends EntityBase {
  kind: 'dig';
}
export type WorldEntity = HordeEntity | ResourceEntity | RivalEntity | PickupEntity | DigEntity;
export type EntityKind = WorldEntity['kind'];

export type MarchKind = 'attack' | 'gather' | 'dig';
export type MarchPhase = 'out' | 'work' | 'back';

export interface March {
  id: string;
  squadId: number;
  kind: MarchKind;
  targetId: string;
  targetKind: EntityKind;
  /** Display label of the target, e.g. "Lv 5 Shambler Pack". */
  label: string;
  tx: number;
  ty: number;
  phase: MarchPhase;
  /** Current travel leg in world coordinates. */
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  legStart: number;
  legEnd: number;
  /** Gathering/digging window (phase 'work'). */
  workStart: number;
  workEnd: number;
  startedAt: number;
  /** One-way travel time base -> target. */
  travelMs: number;
  troops: number;
  /** Carry capacity (load units) for gathering. */
  load: number;
  power: number;
  /** Squad snapshot taken at departure (used for the battle and its replay). */
  attackers: Combatant[];
  vehicle: { type: HeroType; rarity: Rarity };
  /** Stamina paid (refunded if the target is gone or the march is recalled before arriving). */
  stamina: number;
  /** Loot carried home; granted when the march returns. */
  loot: Reward | null;
  gather: { res: ResKind; amount: number } | null;
  result: 'win' | 'lose' | 'missing' | 'recalled' | null;
}

export interface WorldReport {
  id: string;
  at: number;
  kind: 'horde' | 'rival' | 'gather' | 'dig';
  title: string;
  level: number;
  win: boolean;
  squadId: number;
  power: number;
  enemyPower: number;
  troops: number;
  wounded: number;
  kills: number;
  loot: Reward;
  seed: number;
  attackers: Combatant[];
  defenders: Combatant[];
  read: boolean;
  note?: string;
}

export interface RadarMission {
  id: string;
  kind: D.RadarKind;
  stars: number;
  level: number;
  reward: Reward;
  entityId: string | null;
  status: 'open' | 'done' | 'claimed';
  /** Reward multiplier (treasure digs roll x1/x2/x5). */
  mult: number;
}

export interface RadarState {
  missions: RadarMission[];
  refreshAt: number;
  level: number;
  completed: number;
}

/**
 * Revision counters (not persisted). The 3D view rebuilds entity/march visuals when these change,
 * so every function below that adds/removes/changes entities or marches bumps them.
 */
export const worldRev = { entities: 0, marches: 0, reports: 0 };

// =====================================================================================
// Coordinates
// =====================================================================================

const MID = D.MAP_TILES / 2;

/** World-space centre of a tile. */
export function tileCenter(tx: number, ty: number, out: { x: number; z: number } = { x: 0, z: 0 }) {
  out.x = -D.HALF + (tx + 0.5) * D.TILE;
  out.z = -D.HALF + (ty + 0.5) * D.TILE;
  return out;
}
/** Distance of a tile from the base centre, in tiles. */
export function tileDistance(tx: number, ty: number): number {
  return Math.hypot(tx + 0.5 - MID, ty + 0.5 - MID);
}
export function worldToTile(x: number, z: number): { tx: number; ty: number } {
  return { tx: Math.floor((x + D.HALF) / D.TILE), ty: Math.floor((z + D.HALF) / D.TILE) };
}
/** Player-facing coordinates (tile x/y). */
export function coordLabel(tx: number, ty: number): string {
  return `X:${tx} Y:${ty}`;
}

// =====================================================================================
// Terrain (deterministic from the seed; not saved)
// =====================================================================================

export const TK = {
  GRASS: 0,
  WATER: 1,
  SHORE: 2,
  FOREST: 3,
  RUIN: 4,
  RUBBLE: 5,
  ROAD: 6,
  BASE: 7,
  ROCK: 8,
  /** Covered by a 3x3-tile ruined city block model. */
  BLOCK: 9,
} as const;

export interface WorldTerrain {
  seed: number;
  /** Grid vertices per side (2 per tile + 1) and spacing in world units. */
  gn: number;
  step: number;
  height: Float32Array;
  water: Float32Array;
  /** Distance to the nearest road centre line (world units). */
  road: Float32Array;
  city: Float32Array;
  moist: Float32Array;
  rock: Float32Array;
  detail: Float32Array;
  /** Tile kinds (TK.*), MAP_TILES^2. */
  kind: Uint8Array;
  /** Road centre polylines [x0, z0, x1, z1, ...]. */
  roads: number[][];
  river: number[];
  cities: { x: number; z: number; r: number }[];
  /** Ruined city blocks (3x3 tiles each) centred on these tiles. */
  blocks: { tx: number; ty: number; seed: number }[];
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number, seed: number, oct = 4): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(x * f, y * f, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px;
  const ez = az + dz * t - pz;
  return Math.sqrt(ex * ex + ez * ez);
}
function polyDist(px: number, pz: number, lines: number[][]): number {
  let best = 1e9;
  for (const l of lines) {
    for (let i = 0; i + 3 < l.length; i += 2) {
      // cheap reject using a bounding box around the segment
      const ax = l[i];
      const az = l[i + 1];
      const bx = l[i + 2];
      const bz = l[i + 3];
      if (px < Math.min(ax, bx) - best || px > Math.max(ax, bx) + best) continue;
      if (pz < Math.min(az, bz) - best || pz > Math.max(az, bz) + best) continue;
      const d = segDist(px, pz, ax, az, bx, bz);
      if (d < best) best = d;
    }
  }
  return best;
}
function nearestOnPolys(px: number, pz: number, lines: number[][]): { x: number; z: number; d: number } {
  let best = { x: 0, z: 0, d: 1e9 };
  for (const l of lines) {
    for (let i = 0; i + 3 < l.length; i += 2) {
      const ax = l[i];
      const az = l[i + 1];
      const dx = l[i + 2] - ax;
      const dz = l[i + 3] - az;
      const l2 = dx * dx + dz * dz;
      let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const x = ax + dx * t;
      const z = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { x, z, d };
    }
  }
  return best;
}

function genNetwork(seed: number) {
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const H = D.HALF;
  const roads: number[][] = [];
  // Four main roads leaving the outpost gates, meandering to the map edge.
  const a0 = rng() * Math.PI * 2;
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * Math.PI) / 2 + (rng() - 0.5) * 0.4;
    let x = Math.cos(a) * 9;
    let z = Math.sin(a) * 9;
    let heading = a;
    const line = [x, z];
    while (Math.abs(x) < H + 8 && Math.abs(z) < H + 8) {
      heading += (rng() - 0.5) * 0.5 + (a - heading) * 0.18;
      x += Math.cos(heading) * 7;
      z += Math.sin(heading) * 7;
      line.push(x, z);
    }
    roads.push(line);
  }
  // Ring road around the inner wasteland.
  const ring: number[] = [];
  const RN = 30;
  for (let i = 0; i <= RN; i++) {
    const ang = ((i % RN) / RN) * Math.PI * 2;
    const r = 64 + (vnoise((i % RN) * 0.4, 3.3, seed) - 0.5) * 22;
    ring.push(Math.cos(ang) * r, Math.sin(ang) * r);
  }
  roads.push(ring);
  // Ruined towns, joined to the network.
  const cities: { x: number; z: number; r: number }[] = [];
  for (let tries = 0; tries < 80 && cities.length < 6; tries++) {
    const ang = rng() * Math.PI * 2;
    const d = 44 + rng() * 66;
    const c = { x: Math.cos(ang) * d, z: Math.sin(ang) * d, r: 15 + rng() * 8 };
    if (Math.abs(c.x) > H - c.r - 4 || Math.abs(c.z) > H - c.r - 4) continue;
    if (cities.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < o.r + c.r + 14)) continue;
    cities.push(c);
  }
  for (const c of cities) {
    const p = nearestOnPolys(c.x, c.z, roads);
    if (p.d > c.r * 0.6) {
      const mx = (c.x + p.x) / 2 + (rng() - 0.5) * 10;
      const mz = (c.z + p.z) / 2 + (rng() - 0.5) * 10;
      roads.push([c.x, c.z, mx, mz, p.x, p.z]);
    }
    // a main street through the town
    const sa = rng() * Math.PI;
    const L = c.r * 1.25;
    roads.push([c.x - Math.cos(sa) * L, c.z - Math.sin(sa) * L, c.x + Math.cos(sa) * L, c.z + Math.sin(sa) * L]);
  }
  // One river crossing the map, steering clear of the outpost.
  const river: number[] = [];
  const side = Math.floor(rng() * 4);
  let u = -H - 10;
  let v = (rng() - 0.5) * H * 1.3;
  let heading = (rng() - 0.5) * 0.5;
  const pts: number[] = [u, v];
  while (u < H + 10) {
    const d = Math.hypot(u, v);
    if (d < 60) heading += (v >= 0 ? 1 : -1) * 0.3 * ((60 - d) / 60);
    heading += (rng() - 0.5) * 0.45;
    heading *= 0.9;
    heading = Math.max(-0.9, Math.min(0.9, heading));
    u += Math.cos(heading) * 7;
    v += Math.sin(heading) * 7;
    pts.push(u, v);
  }
  const ca = Math.cos((side * Math.PI) / 2);
  const sa = Math.sin((side * Math.PI) / 2);
  for (let i = 0; i < pts.length; i += 2) river.push(pts[i] * ca - pts[i + 1] * sa, pts[i] * sa + pts[i + 1] * ca);
  return { roads, cities, river };
}

let terrainCache: WorldTerrain | null = null;

/** Deterministic terrain for a map seed (cached). Used for spawning and by the 3D view. */
export function getTerrain(seed: number): WorldTerrain {
  if (terrainCache && terrainCache.seed === seed) return terrainCache;
  const n = D.MAP_TILES;
  const gn = n * 2 + 1;
  const step = D.TILE / 2;
  const N = gn * gn;
  const height = new Float32Array(N);
  const water = new Float32Array(N);
  const road = new Float32Array(N);
  const city = new Float32Array(N);
  const moist = new Float32Array(N);
  const rock = new Float32Array(N);
  const detail = new Float32Array(N);
  const { roads, cities, river } = genNetwork(seed);
  const riverLines = [river];
  for (let j = 0; j < gn; j++) {
    for (let i = 0; i < gn; i++) {
      const k = j * gn + i;
      const x = -D.HALF + i * step;
      const z = -D.HALF + j * step;
      const dB = Math.hypot(x, z);
      const dR = polyDist(x, z, roads);
      const dRv = polyDist(x, z, riverLines);
      let cAmt = 0;
      for (const c of cities) cAmt = Math.max(cAmt, smoothstep(c.r, c.r * 0.55, Math.hypot(x - c.x, z - c.z)));
      const lakeN = fbm(x * 0.02 + 17.3, z * 0.02 - 4.1, seed + 11);
      const m = fbm(x * 0.03 - 7.7, z * 0.03 + 2.2, seed + 23);
      const rockN = fbm(x * 0.045 + 3.1, z * 0.045 + 9.4, seed + 37, 3);
      // rocky ridges ring the playable map
      const edge = smoothstep(D.HALF - 14, D.HALF - 1, Math.max(Math.abs(x), Math.abs(z)));
      let w = Math.max(smoothstep(0.62, 0.68, lakeN), 1 - smoothstep(2.8, 5.2, dRv));
      w *= smoothstep(30, 42, dB) * smoothstep(3.4, 5.6, dR) * (1 - cAmt) * (1 - edge);
      const rAmt = Math.max(
        edge,
        smoothstep(0.63, 0.75, rockN) * (1 - cAmt) * smoothstep(3.5, 7, dR) * smoothstep(34, 46, dB) * (1 - smoothstep(0.05, 0.3, w)),
      );
      // dry land sits a little above the water sheet; lakes/rivers dig below it
      let h = (fbm(x * 0.035, z * 0.035, seed + 51, 3) - 0.5) * 0.6 + 0.1;
      const flat = smoothstep(2.2, 5, dR) * smoothstep(18, 28, dB);
      h = h * flat * (1 - edge) * (1 - cAmt) + rAmt * 2.6 - w * 1.5;
      height[k] = h;
      water[k] = w;
      road[k] = dR;
      city[k] = cAmt;
      moist[k] = m;
      rock[k] = rAmt;
      detail[k] = vnoise(x * 0.3, z * 0.3, seed + 5);
    }
  }
  const kind = new Uint8Array(n * n);
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const ci = tx * 2 + 1;
      const cj = ty * 2 + 1;
      const k = cj * gn + ci;
      let maxW = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) maxW = Math.max(maxW, water[(cj + dj) * gn + ci + di]);
      const dT = tileDistance(tx, ty);
      const hsh = hash2(tx, ty, seed + 77);
      let t: number = TK.GRASS;
      if (dT <= D.BASE_TILE_RADIUS + 1.3) t = TK.BASE;
      else if (water[k] > 0.5) t = TK.WATER;
      else if (maxW > 0.12) t = TK.SHORE;
      else if (road[k] < 2.8) t = TK.ROAD;
      else if (city[k] > 0.08) t = hsh < 0.5 ? TK.RUIN : TK.RUBBLE;
      else if (rock[k] > 0.3) t = TK.ROCK;
      else if (moist[k] + (hsh - 0.5) * 0.03 > 0.585 + (dT < 8 ? 0.06 : 0)) t = TK.FOREST;
      kind[ty * n + tx] = t;
    }
  }
  // ruined city blocks: 3x3 tiles of town ground away from roads/water
  const blocks: { tx: number; ty: number; seed: number }[] = [];
  const isTown = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return false;
    const k = kind[y * n + x];
    return k === TK.RUIN || k === TK.RUBBLE;
  };
  for (const c of cities) {
    const ctx = Math.floor((c.x + D.HALF) / D.TILE);
    const cty = Math.floor((c.z + D.HALF) / D.TILE);
    let placed = 0;
    for (const [ox, oy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3], [3, -3], [-3, 3]]) {
      if (placed >= 3) break;
      const bx = ctx + ox;
      const by = cty + oy;
      let ok = true;
      for (let y = by - 1; y <= by + 1 && ok; y++) for (let x = bx - 1; x <= bx + 1 && ok; x++) ok = isTown(x, y);
      if (!ok) continue;
      for (let y = by - 1; y <= by + 1; y++) for (let x = bx - 1; x <= bx + 1; x++) kind[y * n + x] = TK.BLOCK;
      blocks.push({ tx: bx, ty: by, seed: Math.floor(hash2(bx, by, seed + 5) * 1e6) });
      placed++;
    }
  }
  terrainCache = { seed, gn, step, height, water, road, city, moist, rock, detail, kind, roads, river, cities, blocks };
  return terrainCache;
}

/** Ground height at a tile centre (entities stand on it). */
export function tileHeight(terrain: WorldTerrain, tx: number, ty: number): number {
  return terrain.height[(ty * 2 + 1) * terrain.gn + tx * 2 + 1];
}

function spawnable(kind: number): boolean {
  return kind === TK.GRASS || kind === TK.RUBBLE || kind === TK.ROAD;
}

// =====================================================================================
// Small helpers
// =====================================================================================

type Rng = () => number;

function nextId(s: GameState, prefix: string): string {
  return prefix + s.world.nextId++;
}
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Deferred side effects (events/toasts/sfx) so they fire after the current mutation completes.
let pending: (() => void)[] = [];
function later(fn: () => void): void {
  pending.push(fn);
  if (pending.length === 1) queueMicrotask(flushLater);
}
function flushLater(): void {
  const list = pending;
  pending = [];
  for (const fn of list) {
    try {
      fn();
    } catch (e) {
      console.error('world deferred effect failed', e);
    }
  }
}
/** Toast only for things happening "now" (not when catching up after being offline). */
function liveToast(at: number, text: string, kind: 'good' | 'bad' | 'info', sound?: () => void): void {
  if (now() - at > 15_000) return;
  later(() => {
    toast(text, kind);
    if (sound && route.value.mode === 'world') sound();
  });
}

export function entityById(s: GameState, id: string): WorldEntity | undefined {
  return s.world.entities.find((e) => e.id === id);
}
function removeEntity(s: GameState, id: string): void {
  const i = s.world.entities.findIndex((e) => e.id === id);
  if (i >= 0) {
    s.world.entities.splice(i, 1);
    worldRev.entities++;
  }
}

export function entityLabel(e: WorldEntity): string {
  switch (e.kind) {
    case 'horde':
      return `Lv ${e.level} ${D.HORDE_NAMES[e.variant]}`;
    case 'resource':
      return `Lv ${e.level} ${D.RES_NAMES[e.res]}`;
    case 'rival':
      return `[${e.tag}] ${e.name}`;
    case 'pickup':
      return e.pickup === 'survivor' ? D.RADAR_INFO.rescue.title : D.RADAR_INFO.cache.title;
    case 'dig':
      return D.RADAR_INFO.dig.title;
  }
}

// =====================================================================================
// Stamina
// =====================================================================================

export function staminaMax(s: GameState): number {
  return D.STAMINA_MAX + getBonus(s, 'stamina_max');
}

/** Folds regenerated stamina into `s.world.stamina`. Returns true if the value changed. */
export function settleStamina(s: GameState, t: number): boolean {
  const w = s.world;
  const max = staminaMax(s);
  if (!(w.staminaAt > 0) || w.staminaAt > t) w.staminaAt = t;
  if (w.stamina >= max) {
    w.staminaAt = t;
    return false;
  }
  const gained = Math.floor((t - w.staminaAt) / D.STAMINA_REGEN_MS);
  if (gained <= 0) return false;
  w.stamina = Math.min(max, w.stamina + gained);
  w.staminaAt = w.stamina >= max ? t : w.staminaAt + gained * D.STAMINA_REGEN_MS;
  return true;
}

/** Current stamina including regen not yet settled (read-only view). */
export function staminaNow(s: GameState, t = now()): number {
  const w = s.world;
  const max = staminaMax(s);
  if (w.stamina >= max) return Math.floor(w.stamina);
  const gained = Math.max(0, Math.floor((t - w.staminaAt) / D.STAMINA_REGEN_MS));
  return Math.floor(Math.min(max, w.stamina + gained));
}

/** Timestamp of the next +1 stamina, or null when full. */
export function nextStaminaAt(s: GameState, t = now()): number | null {
  const w = s.world;
  if (staminaNow(s, t) >= staminaMax(s)) return null;
  const gained = Math.max(0, Math.floor((t - w.staminaAt) / D.STAMINA_REGEN_MS));
  return w.staminaAt + (gained + 1) * D.STAMINA_REGEN_MS;
}

/** Adds stamina (items, refunds). Can exceed the cap (regen stops above it). Call inside mutate(). */
export function addStaminaIn(s: GameState, amount: number, t = now()): void {
  settleStamina(s, t);
  s.world.stamina += amount;
  if (s.world.stamina >= staminaMax(s)) s.world.staminaAt = t;
}

/** Spends stamina; returns false (no change) if not enough. Call inside mutate(). */
export function spendStaminaIn(s: GameState, amount: number, t = now()): boolean {
  settleStamina(s, t);
  if (s.world.stamina < amount) return false;
  const wasFull = s.world.stamina >= staminaMax(s);
  s.world.stamina -= amount;
  if (wasFull) s.world.staminaAt = t;
  return true;
}

export function staminaCostFor(e: WorldEntity): number {
  if (e.kind === 'horde') return D.STAMINA_COST[e.variant];
  if (e.kind === 'rival') return D.STAMINA_COST.rival;
  return 0;
}

// =====================================================================================
// Squads
// =====================================================================================

const SQUAD_FEATURE = { 2: 'squad2', 3: 'squad3', 4: 'squad4' } as const;

/** Squad ids the player can send out on the world map. */
export function worldSquads(s: GameState): number[] {
  const out: number[] = [];
  for (const q of s.heroes.squads) {
    const f = SQUAD_FEATURE[q.id as 2 | 3 | 4];
    if (q.id === 1 || !f || isUnlocked(s, f)) out.push(q.id);
  }
  return out.sort((a, b) => a - b);
}

export function squadMarch(s: GameState, squadId: number): March | undefined {
  return s.world.marches.find((m) => m.squadId === squadId);
}

/** Soldiers this squad would take on a march (march size of its heroes, limited by troops at home). */
export function squadTroops(s: GameState, squadId: number): number {
  let cap = 0;
  const combat = safeSquadCombatants(s, squadId);
  if (combat.length) {
    for (const c of combat) cap += marchSizePerHero(s, c.type === 'zombie' ? 'tank' : c.type);
  } else {
    const sq = s.heroes.squads.find((q) => q.id === squadId);
    const heroes = sq ? sq.heroes.filter(Boolean).length : 0;
    cap = heroes * marchSizePerHero(s, 'tank');
  }
  if (cap > 0) cap += getBonus(s, 'squad_capacity');
  let away = 0;
  for (const m of s.world.marches) if (m.squadId !== squadId) away += m.troops;
  return Math.max(0, Math.min(cap, totalTroops(s) - away));
}

/** Resource load units the squad can carry. */
export function squadLoad(s: GameState, squadId: number): number {
  return Math.floor(squadTroops(s, squadId) * D.loadPerTroop(bestTroopTier(s)) * bonusMult(s, 'load_pct'));
}

function vehicleFor(combat: Combatant[]): { type: HeroType; rarity: Rarity } {
  const lead = combat.find((c) => c.type !== 'zombie');
  const type = lead && lead.type !== 'zombie' ? lead.type : 'tank';
  return { type, rarity: lead?.rarity ?? 'SR' };
}

// =====================================================================================
// Enemies
// =====================================================================================

export function combatPower(list: Combatant[]): number {
  let p = 0;
  for (const c of list) p += D.estimatePower(c.maxHp, c.atk, c.def);
  return Math.round(p);
}

/** Side-B formation for a zombie horde. Deterministic for (level, variant, seed). */
export function zombieCombatants(level: number, variant: HordeVariant, seed = 1): Combatant[] {
  const rng = mulberry32((seed ^ 0x2545f491) >>> 0);
  const P = D.hordePower(level, variant);
  const shares = D.LINEUP_SHARES[variant];
  const out: Combatant[] = [];
  for (let i = 0; i < 5; i++) {
    const u = P * shares[i] * (0.95 + rng() * 0.1);
    const model =
      variant === 'boss' && i === 0
        ? 'zombieBoss'
        : i < 2 && (variant !== 'normal' || level >= 6)
          ? 'zombieBrute'
          : i === 4 && level >= 3
            ? 'zombieRunner'
            : 'zombie';
    const name = model === 'zombieBoss' ? 'Blight Colossus' : model === 'zombieBrute' ? 'Mauler' : model === 'zombieRunner' ? 'Sprinter' : 'Shambler';
    const hp = Math.round(u * D.STAT_HP);
    out.push({
      uid: `z${i}`,
      name,
      side: 'B',
      slot: i,
      type: 'zombie',
      model,
      level,
      maxHp: hp,
      hp,
      atk: Math.round(u * D.STAT_ATK),
      def: Math.round(u * D.STAT_DEF),
    });
  }
  return out;
}

export function rivalPower(r: RivalEntity, t = now()): number {
  const days = Math.max(0, (t - r.bornAt) / 86_400_000);
  return Math.round(r.basePower * (1 + Math.min(D.RIVAL_GROWTH_CAP, days * D.RIVAL_GROWTH_PER_DAY)));
}

const RIVAL_UNITS: { type: HeroType; label: string }[] = [
  { type: 'tank', label: 'Tank' },
  { type: 'tank', label: 'Tank' },
  { type: 'missile', label: 'Launcher' },
  { type: 'aircraft', label: 'Gunship' },
  { type: 'missile', label: 'Launcher' },
];

/** Side-B garrison of a rival outpost. */
export function rivalCombatants(r: RivalEntity, t: number, seed = 1): Combatant[] {
  const rng = mulberry32((seed ^ 0x51ed27) >>> 0);
  const P = rivalPower(r, t);
  const shares = D.LINEUP_SHARES.normal;
  const rarity: Rarity = r.level >= 18 ? 'UR' : r.level >= 8 ? 'SSR' : 'SR';
  return RIVAL_UNITS.map((u, i) => {
    const pw = P * shares[i] * (0.95 + rng() * 0.1);
    const hp = Math.round(pw * D.STAT_HP);
    return {
      uid: `r${i}`,
      name: `${r.commander}'s ${u.label}`,
      side: 'B' as const,
      slot: i,
      type: u.type,
      rarity,
      model: u.type,
      level: r.level,
      maxHp: hp,
      hp,
      atk: Math.round(pw * D.STAT_ATK),
      def: Math.round(pw * D.STAT_DEF),
    };
  });
}

/** Displayed enemy power of an entity (0 for non-combat targets). */
export function entityPower(e: WorldEntity, t = now()): number {
  if (e.kind === 'horde') return D.hordePower(e.level, e.variant);
  if (e.kind === 'rival') return rivalPower(e, t);
  return 0;
}

// =====================================================================================
// Entity generation & upkeep
// =====================================================================================

function buildOccupancy(s: GameState): Uint8Array {
  const n = D.MAP_TILES;
  const occ = new Uint8Array(n * n);
  for (const e of s.world.entities) markOcc(occ, e.tx, e.ty, e.kind === 'rival' ? 2 : 1);
  return occ;
}
function markOcc(occ: Uint8Array, tx: number, ty: number, r: number): void {
  const n = D.MAP_TILES;
  for (let y = ty - r; y <= ty + r; y++)
    for (let x = tx - r; x <= tx + r; x++) if (x >= 0 && y >= 0 && x < n && y < n) occ[y * n + x] = 1;
}
function tileFree(terrain: WorldTerrain, occ: Uint8Array, tx: number, ty: number, r = 0, kinds = spawnable): boolean {
  const n = D.MAP_TILES;
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      if (x < 1 || y < 1 || x >= n - 1 || y >= n - 1) return false;
      if (occ[y * n + x] || !kinds(terrain.kind[y * n + x])) return false;
    }
  }
  return true;
}
function findSpot(
  terrain: WorldTerrain,
  occ: Uint8Array,
  rng: Rng,
  dMin: number,
  dMax: number,
  r = 0,
  angle?: number,
  spread = Math.PI * 2,
  /** >1 biases spawns toward dMin (closer to the outpost). */
  bias = 1,
): { tx: number; ty: number } | null {
  for (let i = 0; i < 80; i++) {
    const a = angle === undefined ? rng() * Math.PI * 2 : angle + (rng() - 0.5) * spread;
    const d = dMin + Math.pow(rng(), bias) * Math.max(0, dMax - dMin);
    const tx = Math.floor(MID + Math.cos(a) * d);
    const ty = Math.floor(MID + Math.sin(a) * d);
    if (tileFree(terrain, occ, tx, ty, r)) return { tx, ty };
  }
  return null;
}

function spawnHorde(
  s: GameState,
  terrain: WorldTerrain,
  occ: Uint8Array,
  rng: Rng,
  opts: { level?: number; variant?: HordeVariant; dMin?: number; dMax?: number; radarId?: string } = {},
): HordeEntity | null {
  let dMin = opts.dMin ?? 5;
  let dMax = opts.dMax ?? 44;
  if (opts.level !== undefined && opts.dMin === undefined) {
    const d = D.distanceForLevel(opts.level);
    dMin = Math.max(5, d - 3);
    dMax = Math.min(44, d + 3);
  }
  // random hordes cluster a little toward the outpost so early levels are plentiful
  const spot = findSpot(terrain, occ, rng, dMin, dMax, 0, undefined, Math.PI * 2, opts.level === undefined ? 1.5 : 1);
  if (!spot) return null;
  const d = tileDistance(spot.tx, spot.ty);
  const level = opts.level ?? Math.max(1, Math.min(D.MAX_HORDE_LEVEL, D.levelForDistance(d) + randInt(rng, -2, 2)));
  let variant: HordeVariant = opts.variant ?? 'normal';
  if (!opts.variant) {
    const x = rng();
    if (level >= 10 && x < 0.03) variant = 'boss';
    else if (level >= 5 && x < 0.1) variant = 'elite';
  }
  const e: HordeEntity = { id: nextId(s, 'h'), kind: 'horde', tx: spot.tx, ty: spot.ty, level, variant };
  if (opts.radarId) e.radarId = opts.radarId;
  s.world.entities.push(e);
  markOcc(occ, e.tx, e.ty, 1);
  worldRev.entities++;
  return e;
}

function spawnResource(
  s: GameState,
  terrain: WorldTerrain,
  occ: Uint8Array,
  rng: Rng,
  opts: { res?: ResKind; level?: number } = {},
): ResourceEntity | null {
  let dMin = 5;
  let dMax = 44;
  if (opts.level !== undefined) {
    dMin = Math.max(5, opts.level * 6 - 4);
    dMax = Math.min(44, opts.level * 6 + 5);
  }
  const spot = findSpot(terrain, occ, rng, dMin, dMax);
  if (!spot) return null;
  const x = rng();
  const res: ResKind = opts.res ?? (x < 0.4 ? 'food' : x < 0.8 ? 'iron' : 'gold');
  const level = opts.level ?? D.resourceLevelForDistance(tileDistance(spot.tx, spot.ty), rng);
  const capacity = D.resourceCapacity(res, level);
  const e: ResourceEntity = { id: nextId(s, 'r'), kind: 'resource', tx: spot.tx, ty: spot.ty, res, level, amount: capacity, capacity };
  s.world.entities.push(e);
  markOcc(occ, e.tx, e.ty, 1);
  worldRev.entities++;
  return e;
}

function rivalName(rng: Rng, used: Set<string>): { name: string; commander: string; tag: string } {
  for (let i = 0; i < 20; i++) {
    const pre = D.RIVAL_PREFIX[Math.floor(rng() * D.RIVAL_PREFIX.length)];
    const suf = D.RIVAL_SUFFIX[Math.floor(rng() * D.RIVAL_SUFFIX.length)];
    const kind = D.RIVAL_KIND[Math.floor(rng() * D.RIVAL_KIND.length)];
    const name = `${pre}${suf} ${kind}`;
    if (used.has(name)) continue;
    used.add(name);
    const commander = 'Cmdr. ' + D.RIVAL_COMMANDERS[Math.floor(rng() * D.RIVAL_COMMANDERS.length)];
    const C = 'BCDFGHKLMNPRSTVWZ';
    const V = 'AEIOUY';
    const tag = C[Math.floor(rng() * C.length)] + V[Math.floor(rng() * V.length)] + C[Math.floor(rng() * C.length)];
    return { name, commander, tag };
  }
  return { name: 'Nameless Camp', commander: 'Cmdr. Nobody', tag: 'XXX' };
}

/** Wipes and regenerates all map entities from the seed. */
export function generateWorld(s: GameState, t: number): void {
  const w = s.world;
  const terrain = getTerrain(w.seed);
  const rng = mulberry32((w.seed ^ 0x5bd1e995) >>> 0);
  w.entities = [];
  // keep radar missions consistent: their entities are gone
  for (const m of w.radar.missions) if (m.status === 'open') m.status = 'claimed';
  w.radar.refreshAt = 0;
  const occ = buildOccupancy(s);
  // Rival outposts, spread around the base.
  const used = new Set<string>();
  const a0 = rng() * Math.PI * 2;
  for (let i = 0; i < D.RIVAL_COUNT; i++) {
    const spot = findSpot(terrain, occ, rng, 9, 28, 1, a0 + (i / D.RIVAL_COUNT) * Math.PI * 2, 0.9);
    if (!spot) continue;
    const d = tileDistance(spot.tx, spot.ty);
    const level = Math.max(2, Math.min(30, D.levelForDistance(d) + randInt(rng, -1, 2)));
    const nm = rivalName(rng, used);
    const e: RivalEntity = {
      id: nextId(s, 'o'),
      kind: 'rival',
      tx: spot.tx,
      ty: spot.ty,
      ...nm,
      level,
      basePower: Math.round(D.hordePower(level) * D.RIVAL_POWER_MULT * (0.85 + rng() * 0.3)),
      bornAt: t,
      shieldUntil: 0,
      color: D.RIVAL_COLORS[i % D.RIVAL_COLORS.length],
    };
    w.entities.push(e);
    markOcc(occ, e.tx, e.ty, 2);
  }
  for (let i = 0; i < D.RESOURCE_TARGET; i++) spawnResource(s, terrain, occ, rng);
  for (let i = 0; i < D.HORDE_TARGET; i++) spawnHorde(s, terrain, occ, rng);
  w.genVersion = D.WORLD_GEN_VERSION;
  // guarantee targets at the player's frontier level right away
  maintainWorld(s, t);
  w.lastMaintain = t;
  worldRev.entities++;
}

/** Generates the map if missing/outdated. Returns true if it generated. */
export function ensureWorld(s: GameState, t = now()): boolean {
  if (s.world.genVersion === D.WORLD_GEN_VERSION && s.world.entities.length > 0) return false;
  generateWorld(s, t);
  return true;
}

/** Tops up hordes/resources so the map stays populated and the player always has a next target. */
export function maintainWorld(s: GameState, t: number): boolean {
  const w = s.world;
  const terrain = getTerrain(w.seed);
  const rng = mulberry32(hashSeed(`${w.seed}:${t}`));
  let changed = false;
  // self-heal: drop hordes/resources left on tiles that are no longer walkable (terrain tuning changes)
  const n = D.MAP_TILES;
  const before = w.entities.length;
  w.entities = w.entities.filter(
    (e) => e.kind === 'rival' || !!e.radarId || spawnable(terrain.kind[e.ty * n + e.tx]) || !!marchTargeting(s, e.id),
  );
  if (w.entities.length !== before) {
    worldRev.entities++;
    changed = true;
  }
  const occ = buildOccupancy(s);
  let hordes = 0;
  let res = 0;
  const atLevel = new Map<number, number>();
  for (const e of w.entities) {
    if (e.kind === 'horde' && !e.radarId) {
      hordes++;
      if (e.variant === 'normal') atLevel.set(e.level, (atLevel.get(e.level) ?? 0) + 1);
    } else if (e.kind === 'resource') res++;
  }
  const M = w.maxHordeLevel;
  for (const L of [Math.max(1, M), Math.max(2, M + 1)]) {
    if (L > D.MAX_HORDE_LEVEL) continue;
    for (let i = atLevel.get(L) ?? 0; i < D.HORDES_AT_FRONTIER; i++) {
      if (spawnHorde(s, terrain, occ, rng, { level: L, variant: 'normal' })) {
        changed = true;
        hordes++;
        atLevel.set(L, (atLevel.get(L) ?? 0) + 1);
      }
    }
  }
  for (let i = 0; i < 6 && hordes < D.HORDE_TARGET; i++, hordes++) if (spawnHorde(s, terrain, occ, rng)) changed = true;
  for (let i = 0; i < 4 && res < D.RESOURCE_TARGET; i++, res++) if (spawnResource(s, terrain, occ, rng)) changed = true;
  return changed;
}

// =====================================================================================
// Marches
// =====================================================================================

/** Travel time from the outpost gate to a tile. */
export function travelMsTo(s: GameState, tx: number, ty: number): number {
  const c = tileCenter(tx, ty);
  const dTiles = Math.max(0, Math.hypot(c.x, c.z) - D.BASE_GATE_RADIUS) / D.TILE;
  return Math.max(D.MARCH_MIN_MS, Math.round((dTiles * D.MARCH_MS_PER_TILE) / bonusMult(s, 'march_speed_pct')));
}

export function marchTargeting(s: GameState, entityId: string): March | undefined {
  return s.world.marches.find((m) => m.targetId === entityId && m.phase !== 'back');
}

/** Reason a squad can't act on a target right now (null = OK). */
export function marchBlocker(s: GameState, squadId: number, e: WorldEntity, t = now()): string | null {
  if (!isUnlocked(s, 'world')) return 'The world map is locked';
  if (e.kind === 'pickup') return null;
  if (squadMarch(s, squadId)) return `Squad ${squadId} is already on a march`;
  if (!squadReady(s, squadId)) return 'Assign heroes to this squad first';
  if (e.kind === 'horde' || e.kind === 'rival') {
    if (!safeSquadCombatants(s, squadId).length) return 'Assign heroes to this squad first';
  }
  if (e.kind === 'horde' && e.level > s.world.maxHordeLevel + 1) return `Defeat a Lv ${e.level - 1} horde first`;
  if (e.kind === 'rival' && e.shieldUntil > t) return 'This outpost is shielded';
  const other = marchTargeting(s, e.id);
  if (other) return e.kind === 'resource' ? 'Another squad is gathering here' : 'A squad is already heading there';
  if (e.kind === 'resource') {
    if (squadTroops(s, squadId) <= 0) return 'No soldiers available to carry resources';
    if (e.amount <= 0) return 'This tile is depleted';
  }
  const cost = staminaCostFor(e);
  if (cost > 0 && staminaNow(s, t) < cost) return 'Not enough stamina';
  return null;
}

/** Sends a squad to a target. Returns the march, or an error message. Call inside mutate(). */
export function startMarch(s: GameState, squadId: number, entityId: string, t = now()): March | string {
  const e = entityById(s, entityId);
  if (!e) return 'Target is gone';
  const err = marchBlocker(s, squadId, e, t);
  if (err) return err;
  if (e.kind === 'pickup') return 'Nothing to march to';
  const kind: MarchKind = e.kind === 'resource' ? 'gather' : e.kind === 'dig' ? 'dig' : 'attack';
  const cost = staminaCostFor(e);
  if (cost > 0 && !spendStaminaIn(s, cost, t)) return 'Not enough stamina';
  const combat = safeSquadCombatants(s, squadId);
  const c = tileCenter(e.tx, e.ty);
  const len = Math.max(0.001, Math.hypot(c.x, c.z));
  const dx = c.x / len;
  const dz = c.z / len;
  const stop = kind === 'attack' ? (e.kind === 'rival' ? 5.6 : 2.4) : 1.2;
  const travel = travelMsTo(s, e.tx, e.ty);
  const troops = squadTroops(s, squadId);
  const m: March = {
    id: nextId(s, 'm'),
    squadId,
    kind,
    targetId: e.id,
    targetKind: e.kind,
    label: entityLabel(e),
    tx: e.tx,
    ty: e.ty,
    phase: 'out',
    fromX: dx * D.BASE_GATE_RADIUS,
    fromZ: dz * D.BASE_GATE_RADIUS,
    toX: c.x - dx * stop,
    toZ: c.z - dz * stop,
    legStart: t,
    legEnd: t + travel,
    workStart: 0,
    workEnd: 0,
    startedAt: t,
    travelMs: travel,
    troops,
    load: kind === 'gather' ? squadLoad(s, squadId) : 0,
    power: combat.length ? combatPower(combat) : 0,
    attackers: kind === 'attack' ? clone(combat) : [],
    vehicle: vehicleFor(combat),
    stamina: cost,
    loot: null,
    gather: null,
    result: null,
  };
  // prefer the heroes module's squad power when available
  const p = safeSquadPower(s, squadId);
  if (p > 0) m.power = p;
  s.world.marches.push(m);
  worldRev.marches++;
  worldRev.entities++; // target shows "under attack / occupied"
  return m;
}

/** squadPower() guarded against a throwing/unfinished heroes module. */
export function safeSquadPower(s: GameState, squadId: number): number {
  try {
    return squadPower(s, squadId) || 0;
  } catch (e) {
    return 0;
  }
}

/** squadCombatants() guarded against a throwing/unfinished heroes module. */
export function safeSquadCombatants(s: GameState, squadId: number): Combatant[] {
  try {
    return squadCombatants(s, squadId) ?? [];
  } catch (e) {
    return [];
  }
}

/** Where a march is right now (world x/z). */
export function marchPosition(m: March, t: number, out: { x: number; z: number } = { x: 0, z: 0 }) {
  if (m.phase === 'work') {
    out.x = m.toX;
    out.z = m.toZ;
    return out;
  }
  const f = clamp01((t - m.legStart) / Math.max(1, m.legEnd - m.legStart));
  out.x = m.fromX + (m.toX - m.fromX) * f;
  out.z = m.fromZ + (m.toZ - m.fromZ) * f;
  return out;
}

/** End of the march's current timer (arrival, work end or return). */
export function marchTimerEnd(m: March): number {
  return m.phase === 'work' ? m.workEnd : m.legEnd;
}

export function marchStatusLabel(m: March): string {
  if (m.phase === 'back') return 'Returning';
  if (m.phase === 'work') return m.kind === 'dig' ? 'Digging' : 'Gathering';
  return m.kind === 'attack' ? 'Attacking' : m.kind === 'dig' ? 'To dig site' : 'To gather';
}

function gatePointFor(m: March): { x: number; z: number } {
  const c = tileCenter(m.tx, m.ty);
  const len = Math.max(0.001, Math.hypot(c.x, c.z));
  return { x: (c.x / len) * D.BASE_GATE_RADIUS, z: (c.z / len) * D.BASE_GATE_RADIUS };
}

function startReturn(m: March, at: number, fromX: number, fromZ: number, duration: number): void {
  const g = gatePointFor(m);
  m.phase = 'back';
  m.fromX = fromX;
  m.fromZ = fromZ;
  m.toX = g.x;
  m.toZ = g.z;
  m.legStart = at;
  m.legEnd = at + Math.max(1000, Math.round(duration));
  worldRev.marches++;
}

function pushReport(s: GameState, r: WorldReport): void {
  s.world.reports.unshift(r);
  if (s.world.reports.length > D.REPORT_CAP) s.world.reports.length = D.REPORT_CAP;
  worldRev.reports++;
}

function missionOf(s: GameState, radarId: string | undefined): RadarMission | undefined {
  if (!radarId) return undefined;
  return s.world.radar.missions.find((m) => m.id === radarId);
}

function resolveAttack(s: GameState, m: March, at: number): void {
  const w = s.world;
  const e = entityById(s, m.targetId);
  const valid = e && (e.kind === 'horde' || (e.kind === 'rival' && e.shieldUntil <= at));
  if (!e || !valid || (e.kind !== 'horde' && e.kind !== 'rival')) {
    m.result = 'missing';
    if (m.stamina) addStaminaIn(s, m.stamina, at);
    liveToast(at, `Squad ${m.squadId}: target was gone. Stamina refunded.`, 'info');
    startReturn(m, at, m.toX, m.toZ, m.travelMs);
    return;
  }
  const seed = hashSeed(`${m.id}:${w.seed}`);
  const rng = mulberry32(seed);
  const defenders = e.kind === 'horde' ? zombieCombatants(e.level, e.variant, seed) : rivalCombatants(e, at, seed);
  const enemyPower = entityPower(e, at);
  let result: BattleResult | null = null;
  try {
    result = simulateBattle(clone(m.attackers), clone(defenders), seed);
  } catch (err) {
    console.error('world battle simulation failed', err);
  }
  const win = !!result && result.winner === 'A' && m.attackers.length > 0;
  const lossRatio = result ? clamp01(result.lossRatioA || 0) : 1;
  const wounded = Math.min(m.troops, Math.round(m.troops * lossRatio * (win ? 0.25 : 0.6)));
  if (wounded > 0) applyTroopLosses(s, wounded);
  let loot: Reward = {};
  let kills = 0;
  let note: string | undefined;
  if (win && e.kind === 'horde') {
    loot = D.rollHordeLoot(e.level, e.variant, rng);
    if (e.level > w.maxHordeLevel) {
      const bonus = D.firstClearBonus(e.level);
      loot.currencies = { ...(loot.currencies ?? {}), diamonds: (loot.currencies?.diamonds ?? 0) + bonus };
      note = `First Lv ${e.level} clear! +${bonus} diamonds. Lv ${Math.min(D.MAX_HORDE_LEVEL, e.level + 1)} unlocked.`;
      w.maxHordeLevel = e.level;
      w.lastMaintain = 0; // top up the new frontier level on the next tick
    }
    kills = D.hordeZombieCount(e.level, e.variant);
    const mission = missionOf(s, e.radarId);
    if (mission && mission.status === 'open') {
      mission.status = 'done';
      mission.entityId = null;
    }
    removeEntity(s, e.id);
    addStat(s, 'worldHordesDefeated');
    const level = e.level;
    later(() => {
      emit('world:hordeDefeated', { level });
      emit('zombies:killed', { count: kills });
    });
  } else if (win && e.kind === 'rival') {
    const p = D.rivalPlunderPreview(e.level);
    const cur: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.currencies ?? {})) cur[k] = Math.round((v ?? 0) * (0.9 + rng() * 0.2));
    loot = { currencies: cur };
    e.shieldUntil = at + D.RIVAL_SHIELD_MS;
    addStat(s, 'worldRivalsRaided');
    worldRev.entities++;
  }
  m.loot = loot;
  m.result = win ? 'win' : 'lose';
  const label = entityLabel(e);
  pushReport(s, {
    id: nextId(s, 'b'),
    at,
    kind: e.kind === 'horde' ? 'horde' : 'rival',
    title: label,
    level: e.level,
    win,
    squadId: m.squadId,
    power: m.power,
    enemyPower,
    troops: m.troops,
    wounded,
    kills,
    loot,
    seed,
    attackers: m.attackers,
    defenders,
    read: false,
    note: note ?? (result ? undefined : 'Battle could not be simulated.'),
  });
  if (win) liveToast(at, `Squad ${m.squadId} defeated ${label}!`, 'good', sfx.win);
  else liveToast(at, `Squad ${m.squadId} was repelled by ${label}`, 'bad', sfx.lose);
  startReturn(m, at, m.toX, m.toZ, m.travelMs);
}

function arriveWork(s: GameState, m: March, at: number): void {
  const e = entityById(s, m.targetId);
  if (m.kind === 'gather') {
    if (!e || e.kind !== 'resource' || e.amount <= 0) {
      m.result = 'missing';
      liveToast(at, `Squad ${m.squadId}: the resource tile was gone.`, 'info');
      startReturn(m, at, m.toX, m.toZ, m.travelMs);
      return;
    }
    const carry = Math.floor(m.load / D.RES_WEIGHT[e.res]);
    const amount = Math.max(0, Math.min(carry, e.amount));
    const rate = D.gatherRatePerSec(e.res, e.level) * bonusMult(s, 'gather_speed_pct');
    m.gather = { res: e.res, amount };
    m.phase = 'work';
    m.workStart = at;
    m.workEnd = at + Math.max(3000, Math.round((amount / Math.max(0.1, rate)) * 1000));
  } else {
    if (!e || e.kind !== 'dig') {
      m.result = 'missing';
      startReturn(m, at, m.toX, m.toZ, m.travelMs);
      return;
    }
    m.phase = 'work';
    m.workStart = at;
    m.workEnd = at + D.DIG_MS;
  }
  worldRev.marches++;
}

function finishWork(s: GameState, m: March, at: number, recalled = false): void {
  const e = entityById(s, m.targetId);
  if (m.kind === 'gather' && m.gather) {
    const frac = recalled ? clamp01((at - m.workStart) / Math.max(1, m.workEnd - m.workStart)) : 1;
    const got = Math.floor(m.gather.amount * frac);
    m.gather.amount = got;
    if (e && e.kind === 'resource') {
      e.amount = Math.max(0, e.amount - got);
      if (e.amount <= 0) removeEntity(s, e.id);
      else worldRev.entities++;
    }
    m.loot = got > 0 ? { currencies: { [m.gather.res]: got } } : null;
    m.result = recalled ? 'recalled' : 'win';
  } else if (m.kind === 'dig' && !recalled) {
    const rng = mulberry32(hashSeed(`${m.id}:dig`));
    const mission = e ? missionOf(s, e.radarId) : undefined;
    let mult = 1;
    if (mission && mission.status === 'open') {
      mult = D.rollDigMultiplier(rng);
      mission.status = 'done';
      mission.mult = mult;
      mission.entityId = null;
    }
    if (e) removeEntity(s, e.id);
    m.result = 'win';
    pushReport(s, {
      id: nextId(s, 'b'),
      at,
      kind: 'dig',
      title: D.RADAR_INFO.dig.title,
      level: mission?.level ?? 1,
      win: true,
      squadId: m.squadId,
      power: m.power,
      enemyPower: 0,
      troops: m.troops,
      wounded: 0,
      kills: 0,
      loot: mission ? scaleReward(mission.reward, mult) : {},
      seed: 0,
      attackers: [],
      defenders: [],
      read: false,
      note: mult > 1 ? `Lucky dig: rewards x${mult}! Claim them on the Radar board.` : 'Claim the reward on the Radar board.',
    });
    liveToast(at, mult > 1 ? `Treasure unearthed - lucky x${mult}!` : 'Treasure unearthed! Claim it on the Radar board.', 'good', sfx.reward);
  }
  startReturn(m, at, m.toX, m.toZ, m.travelMs);
}

function completeReturn(s: GameState, m: March, at: number): void {
  const w = s.world;
  w.marches = w.marches.filter((x) => x !== m);
  worldRev.marches++;
  worldRev.entities++;
  const loot = m.loot;
  if (loot) grantIn(s, loot);
  if (m.kind === 'gather' && m.gather && m.gather.amount > 0) {
    const g = m.gather;
    addStat(s, 'worldGathered', g.amount);
    pushReport(s, {
      id: nextId(s, 'b'),
      at,
      kind: 'gather',
      title: `Gathered at ${m.label}`,
      level: 0,
      win: true,
      squadId: m.squadId,
      power: m.power,
      enemyPower: 0,
      troops: m.troops,
      wounded: 0,
      kills: 0,
      loot: loot ?? {},
      seed: 0,
      attackers: [],
      defenders: [],
      read: false,
      note: m.result === 'recalled' ? 'Recalled early.' : undefined,
    });
    later(() => emit('world:gathered', { resource: g.res as CurrencyId, amount: g.amount }));
    liveToast(at, `Squad ${m.squadId} is back with ${fmt(g.amount)} ${g.res === 'food' ? 'Food' : g.res === 'iron' ? 'Iron' : 'Gold'}`, 'good', sfx.reward);
  } else if (loot && m.kind === 'attack' && m.result === 'win') {
    liveToast(at, `Squad ${m.squadId} is back with the loot`, 'good', sfx.reward);
  }
}

/** Advances all marches to time t (handles several phase changes per call, e.g. after being offline). */
export function processMarches(s: GameState, t: number): boolean {
  let changed = false;
  for (const m of [...s.world.marches]) {
    for (let guard = 0; guard < 6; guard++) {
      if (m.phase === 'out' && t >= m.legEnd) {
        if (m.kind === 'attack') resolveAttack(s, m, m.legEnd);
        else arriveWork(s, m, m.legEnd);
        changed = true;
      } else if (m.phase === 'work' && t >= m.workEnd) {
        finishWork(s, m, m.workEnd);
        changed = true;
      } else if (m.phase === 'back' && t >= m.legEnd) {
        completeReturn(s, m, m.legEnd);
        changed = true;
        break;
      } else break;
    }
  }
  return changed;
}

/** Recalls a march (returns home from where it is). Call inside mutate(). */
export function recallMarch(s: GameState, marchId: string, t = now()): boolean {
  const m = s.world.marches.find((x) => x.id === marchId);
  if (!m || m.phase === 'back') return false;
  if (m.phase === 'out') {
    const p = marchPosition(m, t);
    const g = gatePointFor(m);
    const total = Math.max(0.001, Math.hypot(m.toX - g.x, m.toZ - g.z));
    const frac = Math.hypot(p.x - g.x, p.z - g.z) / total;
    if (m.stamina) addStaminaIn(s, m.stamina, t);
    m.stamina = 0;
    m.result = 'recalled';
    startReturn(m, t, p.x, p.z, m.travelMs * frac);
  } else {
    finishWork(s, m, t, true);
  }
  worldRev.marches++;
  return true;
}

/** Reduces the march's current timer by ms (speed-up items). Call inside mutate(). */
export function speedUpMarch(s: GameState, marchId: string, ms: number, t = now()): void {
  const m = s.world.marches.find((x) => x.id === marchId);
  if (!m || ms <= 0) return;
  if (m.phase === 'work') {
    m.workEnd = Math.max(t, m.workEnd - ms);
  } else {
    const f = clamp01((t - m.legStart) / Math.max(1, m.legEnd - m.legStart));
    const newEnd = Math.max(t, m.legEnd - ms);
    // keep the vehicle where it is: re-anchor the leg at the current position
    const px = m.fromX + (m.toX - m.fromX) * f;
    const pz = m.fromZ + (m.toZ - m.fromZ) * f;
    m.fromX = px;
    m.fromZ = pz;
    m.legStart = t;
    m.legEnd = newEnd;
  }
  worldRev.marches++;
}

// =====================================================================================
// Reports
// =====================================================================================

export function unreadReports(s: GameState): number {
  let n = 0;
  for (const r of s.world.reports) if (!r.read) n++;
  return n;
}

// =====================================================================================
// Radar board
// =====================================================================================

export function radarMissionCount(s: GameState): number {
  const lv = s.world.radar.level;
  return Math.min(D.RADAR_MAX_MISSIONS, D.RADAR_BASE_MISSIONS + Math.floor((lv - 1) / D.RADAR_MISSIONS_PER_LEVEL_STEP));
}

export function scaleReward(r: Reward, mult: number): Reward {
  if (mult === 1) return r;
  const out: Reward = {};
  if (r.currencies) {
    out.currencies = {};
    for (const [k, v] of Object.entries(r.currencies) as [CurrencyId, number][]) out.currencies[k] = Math.round(v * mult);
  }
  if (r.items) {
    const items: Record<string, number> = {};
    for (const [k, v] of Object.entries(r.items)) items[k] = Math.round((v ?? 0) * mult);
    out.items = items;
  }
  return out;
}

function pickRadarKind(rng: Rng): D.RadarKind {
  const entries = Object.entries(D.RADAR_WEIGHTS) as [D.RadarKind, number][];
  let total = 0;
  for (const [, wt] of entries) total += wt;
  let x = rng() * total;
  for (const [k, wt] of entries) {
    x -= wt;
    if (x <= 0) return k;
  }
  return 'rescue';
}

function spawnMission(s: GameState, terrain: WorldTerrain, occ: Uint8Array, rng: Rng, kind: D.RadarKind): RadarMission | null {
  const w = s.world;
  const M = Math.max(1, w.maxHordeLevel);
  const id = nextId(s, 'q');
  const stars = D.rollStars(w.radar.level, rng);
  let level = M;
  let entity: WorldEntity | null = null;
  if (kind === 'horde' || kind === 'elite') {
    level = kind === 'horde' ? Math.max(1, Math.min(w.maxHordeLevel + 1, M + randInt(rng, -1, 1))) : Math.max(1, Math.min(w.maxHordeLevel + 1, M));
    entity = spawnHorde(s, terrain, occ, rng, { level, variant: kind === 'elite' ? 'elite' : 'normal', dMin: 5, dMax: 16, radarId: id });
  } else {
    const spot = findSpot(terrain, occ, rng, 5, 15);
    if (spot) {
      if (kind === 'dig') entity = { id: nextId(s, 'd'), kind: 'dig', tx: spot.tx, ty: spot.ty, radarId: id };
      else entity = { id: nextId(s, 'p'), kind: 'pickup', pickup: kind === 'rescue' ? 'survivor' : 'cache', tx: spot.tx, ty: spot.ty, radarId: id };
      w.entities.push(entity);
      markOcc(occ, spot.tx, spot.ty, 1);
      worldRev.entities++;
    }
  }
  if (!entity) return null;
  const mission: RadarMission = {
    id,
    kind,
    stars,
    level,
    reward: D.radarReward(kind, stars, M, rng),
    entityId: entity.id,
    status: 'open',
    mult: 1,
  };
  w.radar.missions.push(mission);
  return mission;
}

/** Replaces open missions with a fresh board (done-but-unclaimed missions are kept). */
export function refreshRadar(s: GameState, t: number): void {
  const w = s.world;
  const r = w.radar;
  const keep: RadarMission[] = [];
  for (const m of r.missions) {
    if (m.status === 'claimed') continue;
    if (m.status === 'done') {
      keep.push(m);
      continue;
    }
    if (m.entityId && marchTargeting(s, m.entityId)) {
      keep.push(m);
      continue;
    }
    if (m.entityId) removeEntity(s, m.entityId);
  }
  r.missions = keep;
  const terrain = getTerrain(w.seed);
  const occ = buildOccupancy(s);
  const rng = mulberry32(hashSeed(`${w.seed}:radar:${t}`));
  const target = radarMissionCount(s);
  const kinds: D.RadarKind[] = ['rescue', 'horde', 'dig'];
  for (let i = 0; r.missions.length < target && i < target * 2; i++) {
    spawnMission(s, terrain, occ, rng, i < kinds.length ? kinds[i] : pickRadarKind(rng));
  }
  r.refreshAt = t + D.RADAR_REFRESH_MS;
  worldRev.entities++;
}

function completeMission(s: GameState, m: RadarMission): Reward {
  const reward = scaleReward(m.reward, m.mult);
  grantIn(s, reward);
  m.status = 'claimed';
  const r = s.world.radar;
  r.completed++;
  r.level = 1 + Math.floor(r.completed / D.RADAR_MISSIONS_PER_LEVEL);
  addStat(s, 'radarMissions');
  return reward;
}

/** Claims a finished radar mission. Returns the granted reward (null if not claimable). */
export function claimRadarMission(s: GameState, missionId: string): Reward | null {
  const m = s.world.radar.missions.find((x) => x.id === missionId);
  if (!m || m.status !== 'done') return null;
  return completeMission(s, m);
}

/** Instantly resolves a survivor/cache pickup. Returns the reward (null if invalid). */
export function collectPickup(s: GameState, entityId: string): Reward | null {
  const e = entityById(s, entityId);
  if (!e || e.kind !== 'pickup') return null;
  const m = missionOf(s, e.radarId);
  removeEntity(s, e.id);
  if (!m || m.status !== 'open') return null;
  m.entityId = null;
  return completeMission(s, m);
}

export function radarClaimable(s: GameState): number {
  let n = 0;
  for (const m of s.world.radar.missions) if (m.status === 'done') n++;
  return n;
}
export function radarOpen(s: GameState): number {
  let n = 0;
  for (const m of s.world.radar.missions) if (m.status === 'open') n++;
  return n;
}

// =====================================================================================
// Search
// =====================================================================================

export type SearchKind = 'horde' | ResKind;

function matchesSearch(e: WorldEntity, kind: SearchKind, level: number): boolean {
  if (kind === 'horde') return e.kind === 'horde' && e.variant === 'normal' && !e.radarId && e.level === level;
  return e.kind === 'resource' && e.res === kind && e.level === level;
}

/** Nearest (to the outpost) matching entity; spawns one if the map has none. Call inside mutate(). */
export function searchNearest(s: GameState, kind: SearchKind, level: number): WorldEntity | null {
  let best: WorldEntity | null = null;
  let bestD = 1e9;
  for (const e of s.world.entities) {
    if (!matchesSearch(e, kind, level)) continue;
    if (marchTargeting(s, e.id)) continue;
    const d = tileDistance(e.tx, e.ty);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) return best;
  const terrain = getTerrain(s.world.seed);
  const occ = buildOccupancy(s);
  const rng = mulberry32(hashSeed(`${s.world.seed}:search:${now()}`));
  if (kind === 'horde') return spawnHorde(s, terrain, occ, rng, { level, variant: 'normal' });
  return spawnResource(s, terrain, occ, rng, { res: kind, level });
}

// =====================================================================================
// Ticker
// =====================================================================================

/** 1 Hz world ticker (registered in src/init/world.ts). */
export function worldTick(s: GameState, t: number): boolean {
  let changed = false;
  if (ensureWorld(s, t)) changed = true;
  if (settleStamina(s, t)) changed = true;
  if (s.world.marches.length && processMarches(s, t)) changed = true;
  if (isUnlocked(s, 'radar') && t >= s.world.radar.refreshAt) {
    refreshRadar(s, t);
    changed = true;
  }
  if (t - s.world.lastMaintain >= D.MAINTAIN_MS || t < s.world.lastMaintain) {
    s.world.lastMaintain = t;
    if (maintainWorld(s, t)) changed = true;
  }
  return changed;
}
