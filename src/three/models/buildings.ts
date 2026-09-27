// OWNER: art agent. Base buildings (3 visual tiers each), construction overlay.
// Every building: origin at ground centre, front door faces +Z, footprint ~3.6 x 3.6 (HQ ~6 x 6, wall ~8 x 1.4).
import * as THREE from 'three';
import type { BuildingType } from '../../core/types';
import {
  P,
  beam,
  bx,
  extrudeXY,
  group,
  hull,
  rbox,
  rod,
  slab,
  stripesAround,
  sym,
  type Part,
  type V2,
  type V3,
} from './builder';
import { modelFromSpec, type ModelSpec, type SpinSpec } from './cache';
import { C } from './palette';
import { propGeometry, rockGeom, smallFlagParts, type PropKind } from './props';
import { vehicleGeometry } from './vehicles';

/** Building types this module can draw (includes 'trainingbase' ahead of the shared type update). */
export type BuildingModelType = BuildingType | 'trainingbase';

/** Visual tier from building level: 1 (L1-4), 2 (L5-9), 3 (L10+). */
export function buildingTier(level: number): 1 | 2 | 3 {
  return level >= 10 ? 3 : level >= 5 ? 2 : 1;
}

/**
 * Base building for a plot, facing +Z. Footprint ~3.6x3.6 (HQ ~6x6, wall ~8 long). Visual tier grows at
 * levels 5 and 10. Children: 'body', optional 'glow' (lit windows/beacons) and 'spin' parts (radar dishes,
 * windmills, crane jibs) - call animateModel(group, dt, t) each frame to animate them.
 */
export function buildingModel(type: BuildingModelType, level: number): THREE.Group {
  const t = buildingTier(level);
  const make = BUILDERS[type] ?? BUILDERS.warehouse;
  const g = modelFromSpec(`bld_${type}_${t}`, () => make(t));
  g.userData.buildingType = type;
  g.userData.tier = t;
  return g;
}

/** Scaffolding + tower crane overlay for a ~3.6 plot under construction/upgrade (crane jib is a 'spin' child). */
export function constructionModel(): THREE.Group {
  return modelFromSpec('construction', constructionSpec);
}

// =============================================================================================
// Kit

type Tier = 1 | 2 | 3;
const Y = 0.15; // top of foundation pad
const BLUE_ROOF = 0x2f6fdf;
const STAR = slab(starPts(5, 0.16, 0.068), 0.04);
const ROOF_RIB = new THREE.BoxGeometry(1, 1, 1, 1, 1, 10);
const SHINGLE = new THREE.BoxGeometry(1, 1, 1, 6, 1, 1);
const LOG_WALL = new THREE.BoxGeometry(1, 1, 1, 1, 7, 1);
const LATTICE = new THREE.BoxGeometry(1, 1, 1, 1, 12, 1);

function starPts(n: number, ro: number, ri: number): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -(i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? ri : ro;
    pts.push([Math.cos(a) * r, -Math.sin(a) * r]);
  }
  return pts;
}

class Kit {
  p: Part[] = [];
  g: Part[] = [];
  s: SpinSpec[] = [];
  constructor(public t: Tier) {}
  add(...parts: Part[]) {
    this.p.push(...parts);
    return this;
  }
  glow(...parts: Part[]) {
    this.g.push(...parts);
    return this;
  }
  box(color: number, pos: V3, scale: V3, rot?: V3) {
    this.p.push(bx(color, pos, scale, rot));
    return this;
  }
  pad(w: number, d: number, col: number = C.concrete, rim: number = C.concreteDark) {
    this.p.push({ geom: rbox(w, 0.12, d, 0.04), color: rim, pos: [0, 0.06, 0] }, bx(col, [0, 0.13, 0], [w - 0.16, 0.04, d - 0.16]));
    return this;
  }
  prop(kind: PropKind, pos: V3, rotY = 0, s = 1) {
    this.p.push({ geom: propGeometry(kind), pos, rot: [0, rotY, 0], scale: [s, s, s] });
    return this;
  }
  flag(pos: V3, color: number = C.blue, h = 1.6, w = 0.6) {
    this.p.push(...smallFlagParts(pos, color, h, w));
    return this;
  }
  /** Windows on a wall whose outward normal is +/-Z (face at z). */
  winZ(z: number, xs: number[], y: number, w = 0.34, h = 0.4, lit = this.t === 3, sign = Math.sign(z) || 1) {
    for (const x of xs) {
      const glass = bx(lit ? C.windowLit : C.glass, [x, y, z + sign * 0.015], [w, h, 0.04]);
      (lit ? this.g : this.p).push(glass);
      this.p.push(bx(C.white, [x, y - h / 2 - 0.03, z + sign * 0.03], [w + 0.08, 0.05, 0.07]));
    }
    return this;
  }
  /** Windows on a wall whose outward normal is +/-X (face at x). */
  winX(x: number, zs: number[], y: number, w = 0.34, h = 0.4, lit = this.t === 3, sign = Math.sign(x) || 1) {
    for (const z of zs) {
      const glass = bx(lit ? C.windowLit : C.glass, [x + sign * 0.015, y, z], [0.04, h, w]);
      (lit ? this.g : this.p).push(glass);
      this.p.push(bx(C.white, [x + sign * 0.03, y - h / 2 - 0.03, z], [0.07, 0.05, w + 0.08]));
    }
    return this;
  }
  /** Flat roof slab with parapet rim; top of slab at y + 0.1. */
  flatRoof(x: number, z: number, w: number, d: number, y: number, col: number, rim: number = C.offWhite, rimH = 0.14) {
    this.p.push(bx(col, [x, y + 0.05, z], [w, 0.1, d]));
    this.p.push(bx(rim, [x, y + 0.1 + rimH / 2, z + d / 2 - 0.05], [w, rimH, 0.1]));
    this.p.push(bx(rim, [x, y + 0.1 + rimH / 2, z - d / 2 + 0.05], [w, rimH, 0.1]));
    this.p.push(bx(rim, [x + w / 2 - 0.05, y + 0.1 + rimH / 2, z], [0.1, rimH, d - 0.2]));
    this.p.push(bx(rim, [x - w / 2 + 0.05, y + 0.1 + rimH / 2, z], [0.1, rimH, d - 0.2]));
    return this;
  }
  /** Gable roof over a sx (world X) by sz (world Z) block; ridge along Z unless alongX. Wall-coloured gable ends. */
  gable(
    x: number,
    z: number,
    sx: number,
    sz: number,
    y: number,
    h: number,
    roof: number,
    wall: number,
    alongX = false,
    over = 0.14,
    style: 'flat' | 'ribbed' | 'shingle' = 'flat',
  ) {
    const w = alongX ? sz : sx;
    const d = alongX ? sx : sz;
    const parts: Part[] = [{ geom: P.roof, color: wall, pos: [0, h / 2, 0], scale: [w, h, d] }];
    const half = w / 2;
    const ang = Math.atan2(h, half);
    const len = Math.hypot(half, h) + over;
    const dark = shade(roof, 0.86);
    for (const s of [-1, 1]) {
      const cx = (s * Math.cos(ang) * len) / 2 + s * Math.sin(ang) * 0.04;
      const cy = h - (Math.sin(ang) * len) / 2 + Math.cos(ang) * 0.04;
      parts.push({
        geom: style === 'ribbed' ? ROOF_RIB : style === 'shingle' ? SHINGLE : P.box,
        color: roof,
        pos: [cx, cy, 0],
        rot: [0, 0, -s * ang],
        scale: [len, 0.08, d + over * 2],
        faceColor:
          style === 'ribbed'
            ? (_x: number, _y: number, zz: number) => (Math.floor((zz + 0.5) * 10) % 2 ? dark : roof)
            : style === 'shingle'
              ? (xx: number, yy: number) => (yy > 0.49 && Math.floor((xx + 0.5) * 6) % 2 ? dark : roof)
              : undefined,
      });
    }
    parts.push(bx(shade(roof, 0.8), [0, h + 0.04, 0], [0.12, 0.08, d + over * 2]));
    this.p.push(...group(parts, [x, y, z], [0, alongX ? Math.PI / 2 : 0, 0]));
    return this;
  }
  star(pos: V3, size: number, color: number = C.gold) {
    this.p.push({ geom: STAR, color, pos, scale: [size, 1, size] });
    return this;
  }
  hazard(x0: number, x1: number, y: number, z: number, h = 0.12, n = 8, depth = 0.04) {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) this.p.push(bx(i % 2 ? C.black : C.hazard, [x0 + w * (i + 0.5), y, z], [w, h, depth]));
    return this;
  }
  antenna(pos: V3, h: number, beacon = true) {
    const [x, y, z] = pos;
    this.p.push(rod([x, y, z], [x, y + h, z], 0.03, C.steelDark, P.cyl4), bx(C.steelDark, [x, y + 0.05, z], [0.14, 0.1, 0.14]));
    if (beacon) this.g.push({ geom: P.sphereLow, color: 0xff3b2f, pos: [x, y + h + 0.03, z], scale: [0.1, 0.1, 0.1] });
    return this;
  }
  floodlight(pos: V3, rotY = 0) {
    const [x, y, z] = pos;
    this.p.push(rod([x, y, z], [x, y + 1.3, z], 0.035, C.steelDark, P.cyl4));
    this.p.push(...group([bx(C.gunmetal, [0, 0, 0], [0.28, 0.2, 0.12])], [x, y + 1.35, z], [0.4, rotY, 0]));
    this.g.push(...group([bx(C.glowYellow, [0, 0, 0.065], [0.22, 0.14, 0.02])], [x, y + 1.35, z], [0.4, rotY, 0]));
    return this;
  }
  spin(parts: Part[], pos: V3, axis: 'x' | 'y' | 'z' = 'y', speed = 0.8) {
    this.s.push({ parts, pos, axis, speed });
    return this;
  }
  done(): ModelSpec {
    return { parts: this.p, glow: this.g, spin: this.s };
  }
}

function shade(hex: number, k: number): number {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}

/** Radar/satellite dish facing +Z tilted up (origin at the base of its post). */
function dishParts(r: number, tilt = 0.6, col: number = C.white, post = 0.3): Part[] {
  const dish: Part[] = [
    { geom: P.hemi12, color: shade(col, 0.9), pos: [0, 0, 0], rot: [-Math.PI / 2, 0, 0], scale: [r * 2, r * 0.7, r * 2] },
    { geom: P.cyl12, color: col, pos: [0, 0, 0.01], rot: [Math.PI / 2, 0, 0], scale: [r * 2, 0.03, r * 2] },
    rod([0, 0, 0], [0, 0, r * 0.9], 0.02, C.steelDark, P.cyl4),
    bx(C.steelDark, [0, 0, r * 0.9], [0.08, 0.08, 0.08]),
  ];
  return [
    { geom: P.cyl6, color: C.steelDark, pos: [0, post / 2, 0], scale: [0.12, post, 0.12] },
    bx(C.steelDark, [0, post, 0], [0.2, 0.08, 0.2]),
    ...group(dish, [0, post + r * 0.6, -0.05], [-tilt, 0, 0]),
  ];
}

// =============================================================================================
// Buildings

function hqSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const W = C.offWhite;
  k.pad(5.8, 5.8, C.concreteLight);
  // ground floor
  k.box(C.concreteDark, [0, Y + 0.12, -0.2], [4.0, 0.24, 3.4]);
  k.box(W, [0, Y + 0.85, -0.2], [3.8, 1.5, 3.2]);
  k.box(BLUE_ROOF, [0, Y + 1.5, -0.2], [3.84, 0.14, 3.24]);
  k.winZ(1.4, [-1.35, -0.75, 0.75, 1.35], Y + 0.95, 0.4, 0.46);
  k.winX(1.9, [-1.2, -0.2, 0.8], Y + 0.95, 0.46, 0.46);
  k.winX(-1.9, [-1.2, -0.2, 0.8], Y + 0.95, 0.46, 0.46);
  // entrance + canopy + steps
  k.box(C.navy, [0, Y + 0.55, 1.42], [0.8, 0.9, 0.06]);
  k.box(C.glass, [0, Y + 0.62, 1.455], [0.6, 0.66, 0.02]);
  k.box(BLUE_ROOF, [0, Y + 1.25, 1.95], [1.7, 0.12, 1.1]);
  k.add(...sym(bx(W, [0.72, Y + 0.62, 2.35], [0.14, 1.25, 0.14])));
  k.box(C.concreteLight, [0, Y + 0.05, 2.0], [1.5, 0.1, 1.0]);
  k.flatRoof(0, -0.2, 3.9, 3.3, Y + 1.6, BLUE_ROOF, W);
  const topY = t === 1 ? Y + 1.7 : t === 2 ? Y + 2.95 : Y + 3.79;
  if (t === 1) {
    k.star([0.4, topY + 0.02, 0.1], 3.6);
    k.box(C.steelLight, [-1.2, topY + 0.14, 0.7], [0.5, 0.28, 0.4]).box(C.steelDark, [-1.2, topY + 0.29, 0.7], [0.3, 0.03, 0.3]);
    k.prop('crate', [2.2, Y, 2.1], 0.3, 0.5).prop('barrel', [2.25, Y, 1.55], 0, 0.5);
    k.antenna([-1.45, Y + 1.7, -1.45], 1.6);
    k.spin(dishParts(0.42, 0.55), [1.2, Y + 1.7, -1.1], 'y', 0.7);
  } else {
    // second storey
    k.box(W, [0.3, Y + 2.3, -0.5], [2.6, 1.1, 2.2]);
    k.winZ(0.6, [-0.5, 0.3, 1.1], Y + 2.35, 0.44, 0.44);
    k.winX(1.6, [-1.0, 0.0], Y + 2.35, 0.44, 0.44);
    k.winX(-1.0, [-1.0, 0.0], Y + 2.35, 0.44, 0.44);
    k.flatRoof(0.3, -0.5, 2.7, 2.3, Y + 2.85, BLUE_ROOF, W);
    // wing(s)
    const wings = t === 3 ? [-1, 1] : [-1];
    for (const s of wings) {
      k.box(W, [s * 2.35, Y + 0.6, -0.4], [0.9, 1.0, 2.4]);
      k.box(BLUE_ROOF, [s * 2.35, Y + 1.15, -0.4], [1.0, 0.1, 2.5]);
      k.winZ(0.8, [s * 2.35], Y + 0.65, 0.4, 0.4);
    }
    // armour plates on the ground floor + sandbags
    for (const x of [-1.35, -0.75, 0.75, 1.35]) k.box(C.steel, [x, Y + 0.42, 1.44], [0.52, 0.48, 0.05]);
    k.prop('sandbag', [-2.0, Y, 2.35], 0.25, 0.7).prop('sandbag', [2.0, Y, 2.35], -0.25, 0.7);
    k.antenna([-0.8, Y + 2.95, -1.4], 1.8);
    if (t === 2) {
      k.star([0.3, topY + 0.02, -0.5], 3.4);
      k.spin(dishParts(0.5, 0.55), [1.3, Y + 1.7, 0.9], 'y', 0.7);
    }
  }
  if (t === 3) {
    // control tower with lit glazing, gold trim, flags, floodlights
    k.box(W, [0.3, Y + 3.07, -0.5], [1.7, 0.2, 1.7]);
    k.glow(bx(C.windowLit, [0.3, Y + 3.42, -0.5], [1.5, 0.5, 1.5]));
    k.add(...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => bx(W, [0.3 + sx * 0.72, Y + 3.42, -0.5 + sz * 0.72], [0.1, 0.5, 0.1]))));
    k.box(BLUE_ROOF, [0.3, Y + 3.72, -0.5], [1.9, 0.14, 1.9]);
    k.star([0.3, topY + 0.02, -0.5], 2.6);
    k.antenna([0.9, Y + 3.79, -1.1], 1.4);
    k.box(C.gold, [0, Y + 1.595, -0.2], [3.9, 0.07, 3.3]);
    k.box(C.gold, [0.3, Y + 2.84, -0.5], [2.64, 0.06, 2.24]);
    k.flag([-2.6, Y, 2.6], C.blue, 2.4, 0.9).flag([2.6, Y, 2.6], C.gold, 2.4, 0.9);
    k.floodlight([-2.6, Y, -2.6], Math.PI * 0.75).floodlight([2.6, Y, -2.6], -Math.PI * 0.75);
    k.spin(dishParts(0.5, 0.55), [-2.35, Y + 1.2, 0.2], 'y', 0.7);
  } else {
    k.flag([-2.3, Y, 2.3], C.blue, 2.2, 0.85);
  }
  return k.done();
}

function wallSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  if (t === 1) {
    k.box(C.dirtDark, [0, 0.05, 0], [8.2, 0.1, 1.2]);
    // palisade logs
    for (let x = -3.9; x <= 3.95; x += 0.26) {
      if (Math.abs(x) < 1.5) continue;
      const h = 1.55 + ((Math.round(x * 100) % 3) - 1) * 0.07;
      const c = Math.round(x / 0.26) % 2 ? C.log : C.woodLight;
      k.add({ geom: P.cyl6, color: c, pos: [x, 0.1 + h / 2, 0], scale: [0.26, h, 0.26] });
      k.add({ geom: P.cone6, color: c, pos: [x, 0.1 + h + 0.13, 0], scale: [0.26, 0.26, 0.26] });
    }
    k.add(...sym(bx(C.woodDark, [2.7, 1.25, -0.16], [2.5, 0.12, 0.08]), bx(C.woodDark, [2.7, 0.5, -0.16], [2.5, 0.12, 0.08])));
    // log gate towers
    for (const s of [-1, 1]) {
      const cx = s * 1.25;
      for (const a of [-1, 1]) for (const b of [-1, 1]) k.add({ geom: P.cyl6, color: C.log, pos: [cx + a * 0.26, 1.15, b * 0.26], scale: [0.14, 2.1, 0.14] });
      k.box(C.wood, [cx, 1.95, 0], [0.78, 0.1, 0.78]);
      k.box(C.woodLight, [cx, 2.1, 0.36], [0.72, 0.22, 0.05]);
      k.box(C.woodLight, [cx, 2.1, -0.36], [0.72, 0.22, 0.05]);
      k.add({ geom: P.cone4, color: C.woodDark, pos: [cx, 2.55, 0], rot: [0, Math.PI / 4, 0], scale: [1.15, 0.55, 1.15] });
    }
    // wooden gate doors
    for (const s of [-1, 1]) {
      k.add({ ...bx(C.wood, [s * 0.47, 0.85, 0], [0.9, 1.5, 0.12]), vary: 0.05 });
      k.add(beam([s * 0.1, 0.3, 0.07], [s * 0.85, 1.4, 0.07], 0.08, C.woodDark, 0.04));
      k.box(C.gunmetal, [s * 0.47, 0.45, 0.07], [0.88, 0.07, 0.03]).box(C.gunmetal, [s * 0.47, 1.25, 0.07], [0.88, 0.07, 0.03]);
    }
    k.prop('sandbag', [-2.6, 0.1, 0.85], 0, 0.8).prop('sandbag', [2.6, 0.1, 0.85], 0, 0.8);
    k.flag([-1.25, 2.83, 0], C.blue, 0.7, 0.45);
    return k.done();
  }
  const H = t === 2 ? 1.8 : 2.2;
  k.box(C.concreteDark, [0, 0.06, 0], [8.2, 0.12, 1.3]);
  for (const s of [-1, 1]) {
    const cx = s * 2.75;
    k.add({ ...bx(C.concrete, [cx, 0.1 + H / 2, 0], [2.6, H, 0.7]), vary: 0.03 });
    k.box(C.concreteLight, [cx, 0.1 + H + 0.05, 0], [2.64, 0.1, 0.8]);
    k.box(BLUE_ROOF, [cx, 0.1 + H * 0.72, 0.355], [2.6, 0.12, 0.02]);
    for (const px of [-0.9, 0, 0.9]) k.box(C.concreteLight, [cx + px, 0.1 + H / 2, 0.36], [0.2, H, 0.08]);
    if (t === 3) {
      for (const px of [-0.45, 0.45]) {
        k.box(C.steel, [cx + px, 0.1 + H * 0.4, 0.39], [0.62, H * 0.6, 0.05]);
        k.box(C.steelDark, [cx + px, 0.1 + H * 0.68, 0.42], [0.62, 0.05, 0.02]);
      }
      for (let i = 0; i < 6; i++) k.box(C.concrete, [cx - 1.1 + i * 0.44, 0.1 + H + 0.22, 0], [0.26, 0.28, 0.72]);
      k.prop('hedgehog', [s * 3.2, 0.1, 1.3], 0.4 * s, 0.55);
    }
  }
  // gate towers
  const TH = t === 2 ? 2.5 : 3.1;
  const TW = t === 2 ? 1.0 : 1.2;
  for (const s of [-1, 1]) {
    const cx = s * (1.05 + TW / 2 - 0.05);
    k.add({ ...bx(C.concreteLight, [cx, 0.1 + TH / 2, 0], [TW, TH, TW]), vary: 0.03 });
    k.box(C.gunmetal, [cx, 0.1 + TH * 0.72, TW / 2 + 0.01], [TW * 0.6, 0.12, 0.02]);
    k.box(BLUE_ROOF, [cx, 0.1 + TH + 0.08, 0], [TW + 0.16, 0.16, TW + 0.16]);
    if (t === 3) {
      k.add({ geom: P.cone4, color: BLUE_ROOF, pos: [cx, 0.1 + TH + 0.4, 0], rot: [0, Math.PI / 4, 0], scale: [TW * 1.35, 0.5, TW * 1.35] });
      k.flag([cx, 0.1 + TH + 0.6, 0], s < 0 ? C.blue : C.gold, 0.9, 0.55);
      k.glow(bx(C.glowYellow, [cx, 0.1 + TH - 0.3, TW / 2 + 0.02], [0.3, 0.16, 0.03]));
    } else {
      k.glow(bx(C.glowYellow, [cx, 0.1 + TH - 0.25, TW / 2 + 0.02], [0.24, 0.12, 0.03]));
    }
  }
  // steel gate
  const GH = t === 2 ? 1.6 : 2.0;
  k.box(C.steel, [0, 0.1 + GH / 2, 0], [2.1, GH, 0.16]);
  for (let i = 1; i < 4; i++) k.box(C.steelDark, [0, 0.1 + (GH * i) / 4, 0.09], [2.1, 0.06, 0.03]);
  k.box(C.steelDark, [0, 0.1 + GH / 2, 0.09], [0.06, GH, 0.03]);
  k.hazard(-1.05, 1.05, 0.22, 0.1, 0.18, 10);
  if (t === 3) {
    k.add({ geom: P.cyl12, color: C.gold, pos: [0, 0.1 + GH * 0.62, 0.1], rot: [Math.PI / 2, 0, 0], scale: [0.7, 0.04, 0.7] });
    k.add({ geom: STAR, color: BLUE_ROOF, pos: [0, 0.1 + GH * 0.62, 0.125], rot: [Math.PI / 2, 0, 0], scale: [1.8, 1, 1.8] });
  }
  return k.done();
}

function barracksSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const green = C.armyGreen;
  k.pad(3.6, 3.6);
  const sx = t === 3 ? 2.6 : 2.3;
  const sy = t === 3 ? 2.9 : 2.6;
  const sz = t === 3 ? 3.0 : 2.7;
  const zc = -0.15;
  k.add({ geom: P.halfCyl12, color: green, pos: [0, Y, zc], scale: [sx, sy, sz] });
  if (t >= 2) for (const z of [-0.8, 0, 0.8]) k.add({ geom: P.halfCyl12, color: C.oliveDark, pos: [0, Y, zc + z * (sz / 2.7)], scale: [sx + 0.06, sy + 0.08, 0.08] });
  const fz = zc + sz / 2;
  k.box(C.oliveDark, [0, Y + 0.48, fz + 0.02], [0.7, 0.96, 0.05]);
  k.box(0x3d5a26, [0, Y + 0.45, fz + 0.045], [0.52, 0.86, 0.02]);
  k.box(C.oliveDark, [0, Y + 1.0, fz + 0.2], [0.9, 0.06, 0.45]);
  k.winZ(fz, [-0.72, 0.72], Y + 0.62, 0.32, 0.3);
  k.star([0, Y + sy / 2 + 0.02, zc], t === 3 ? 3.4 : 3.0, t === 3 ? C.gold : C.white);
  k.prop('sandbag', [-1.05, Y, fz + 0.45], 0, 0.45).prop('sandbag', [1.05, Y, fz + 0.45], 0, 0.45);
  if (t === 1) {
    k.flag([1.45, Y, 1.45], C.blue, 1.8, 0.6);
    k.prop('crate', [-1.45, Y, -1.3], 0.3, 0.45);
  } else {
    // lean-to annex + watch post
    k.box(C.khaki, [1.52, Y + 0.45, -0.7], [0.5, 0.9, 1.5]);
    k.add({ geom: P.wedge, color: C.oliveDark, pos: [1.52, Y + 1.0, -0.7], rot: [0, Math.PI / 2, 0], scale: [1.6, 0.2, 0.6] });
    k.prop('crate', [-1.45, Y, -1.35], 0.3, 0.45).prop('crate', [-1.45, Y + 0.41, -1.35], 0.8, 0.38);
    k.prop('barrel', [-1.5, Y, -0.85], 0, 0.5);
    k.prop('lamp', [1.5, Y, 1.5], -Math.PI * 0.75, 0.55);
  }
  if (t === 3) {
    for (const x of [-0.72, 0.72]) k.box(C.steel, [x, Y + 0.25, fz + 0.04], [0.5, 0.36, 0.05]);
    k.flag([-1.55, Y, 1.55], C.blue, 2.0, 0.65).flag([1.55, Y, 1.55], C.gold, 2.0, 0.65);
    k.glow(bx(C.glowYellow, [0, Y + 1.12, fz + 0.03], [0.3, 0.1, 0.04]));
  }
  return k.done();
}

function dummy(x: number, z: number, rotY = 0): Part[] {
  const d: Part[] = [
    bx(C.woodDark, [0, 0.55, 0], [0.08, 1.1, 0.08]),
    { geom: P.cyl6, color: C.straw, pos: [0, 0.78, 0], scale: [0.36, 0.52, 0.3], vary: 0.06 },
    { geom: P.sphereLow, color: C.straw, pos: [0, 1.15, 0], scale: [0.26, 0.26, 0.26], vary: 0.08 },
    bx(C.woodDark, [0, 0.9, 0], [0.7, 0.06, 0.06]),
    { geom: P.cyl12, color: C.red, pos: [0, 0.8, 0.14], rot: [Math.PI / 2, 0, 0], scale: [0.3, 0.03, 0.3] },
    { geom: P.cyl12, color: C.white, pos: [0, 0.8, 0.155], rot: [Math.PI / 2, 0, 0], scale: [0.18, 0.03, 0.18] },
    { geom: P.cyl12, color: C.red, pos: [0, 0.8, 0.17], rot: [Math.PI / 2, 0, 0], scale: [0.08, 0.03, 0.08] },
  ];
  return group(d, [x, Y, z], [0, rotY, 0]);
}

function drillSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  k.pad(3.6, 3.6, C.sand, C.sandDark);
  // low post-and-rope border
  for (const s of [-1, 1]) {
    for (const u of [-1.6, -0.55, 0.55, 1.6]) {
      k.box(C.woodDark, [s * 1.68, Y + 0.2, u], [0.08, 0.4, 0.08]);
      if (Math.abs(u) > 1) k.box(C.woodDark, [u, Y + 0.2, s * 1.68], [0.08, 0.4, 0.08]);
    }
    k.box(C.woodLight, [s * 1.68, Y + 0.32, 0], [0.04, 0.04, 3.3]);
    k.box(C.woodLight, [0, Y + 0.32, -1.68], [3.3, 0.04, 0.04]);
  }
  k.box(C.woodLight, [-1.12, Y + 0.32, 1.68], [1.1, 0.04, 0.04]).box(C.woodLight, [1.12, Y + 0.32, 1.68], [1.1, 0.04, 0.04]);
  // painted parade markings
  k.box(C.white, [0, Y + 0.005, 0.2], [2.4, 0.01, 0.06]).box(C.white, [0, Y + 0.005, -0.6], [2.4, 0.01, 0.06]);
  k.add(...dummy(-0.9, -0.2, 0.2), ...dummy(0.9, -0.2, -0.2));
  // flagpole + reviewing stand at the back
  k.flag([1.3, Y, -1.3], C.blue, t === 3 ? 2.6 : 2.2, 0.8);
  k.box(C.wood, [-0.6, Y + 0.2, -1.3], [1.4, 0.4, 0.6]);
  k.box(C.woodLight, [-0.6, Y + 0.42, -1.3], [1.5, 0.05, 0.7]);
  k.box(C.woodDark, [-0.6, Y + 0.12, -0.99], [0.5, 0.24, 0.08]);
  if (t >= 2) {
    k.add(...dummy(-0.3, 0.8, 0.1), ...dummy(0.5, 0.95, -0.15));
    // climbing wall + tyres
    k.box(C.wood, [1.25, Y + 0.55, 0.9], [0.15, 1.1, 0.9]);
    for (let i = 0; i < 4; i++) k.box(C.woodDark, [1.34, Y + 0.25 + i * 0.25, 0.9], [0.05, 0.05, 0.8]);
    k.prop('tire', [-1.2, Y, 1.1], 0, 0.55).prop('tire', [-1.2, Y, 0.6], 0.5, 0.55);
    k.prop('sandbag', [0, Y, 1.45], 0, 0.6);
  }
  if (t === 3) {
    k.box(BLUE_ROOF, [-0.6, Y + 1.25, -1.35], [1.7, 0.1, 0.9]);
    k.box(C.steelDark, [0.15, Y + 0.83, -0.95], [0.07, 0.8, 0.07]).box(C.steelDark, [-1.35, Y + 0.83, -0.95], [0.07, 0.8, 0.07]);
    k.box(C.gold, [-0.6, Y + 1.19, -0.9], [1.7, 0.06, 0.04]);
    k.floodlight([-1.6, Y, 1.6], Math.PI * 0.75).floodlight([1.6, Y, 1.6], -Math.PI * 0.75);
    k.flag([-1.55, Y, -1.55], C.gold, 1.8, 0.6);
  }
  return k.done();
}

function hospitalSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const W = C.white;
  const RED = 0xe53935;
  k.pad(3.6, 3.6, C.concreteLight);
  const h1 = 1.3;
  k.box(W, [0, Y + h1 / 2, -0.3], [2.9, h1, 2.3]);
  k.box(0x9fd6d0, [0, Y + 0.1, -0.3], [2.94, 0.2, 2.34]);
  k.winZ(0.85, [-1.0, -0.55, 0.55, 1.0], Y + 0.75, 0.3, 0.36);
  k.winX(1.45, [-1.0, -0.3, 0.4], Y + 0.75, 0.34, 0.36);
  k.winX(-1.45, [-1.0, -0.3, 0.4], Y + 0.75, 0.34, 0.36);
  k.box(0x6fb8c8, [0, Y + 0.48, 0.87], [0.66, 0.9, 0.05]);
  k.box(RED, [0, Y + 0.97, 1.15], [1.1, 0.08, 0.6]);
  // red cross sign on the facade
  const cross = (pos: V3, s: number, rot: V3 = [0, 0, 0], col = RED): Part[] =>
    group([bx(col, [0, 0, 0], [0.6, 0.2, 0.04]), bx(col, [0, 0, 0], [0.2, 0.6, 0.04])], pos, rot, s);
  let roofY: number;
  if (t === 1) {
    k.flatRoof(0, -0.3, 3.0, 2.4, Y + h1, W, 0xdddddd);
    roofY = Y + h1 + 0.1;
  } else {
    const h2 = t === 3 ? 1.0 : 0.95;
    k.flatRoof(0, -0.3, 3.0, 2.4, Y + h1, 0xdedede, 0xdddddd);
    k.box(W, [-0.25, Y + h1 + 0.1 + h2 / 2, -0.55], [2.2, h2, 1.7]);
    k.winZ(0.3, [-1.0, -0.25, 0.5], Y + h1 + 0.6, 0.34, 0.36);
    k.winX(0.85, [-0.9, -0.2], Y + h1 + 0.6, 0.34, 0.36);
    k.flatRoof(-0.25, -0.55, 2.3, 1.8, Y + h1 + 0.1 + h2, W, 0xdddddd);
    roofY = Y + h1 + 0.2 + h2;
    // medical tent
    k.add({ geom: P.roof, color: C.offWhite, pos: [1.2, Y + 0.45, 1.32], scale: [1.0, 0.9, 0.9] });
    k.add(...cross([1.2, Y + 0.35, 1.78], 0.5));
  }
  const crossParts = [bx(RED, [0, 0, 0], [1.5, 0.05, 0.5]), bx(RED, [0, 0, 0], [0.5, 0.05, 1.5])];
  const cx = t === 1 ? 0 : -0.25;
  const cz = t === 1 ? -0.3 : -0.55;
  k.add(bx(W, [cx, roofY + 0.005, cz], [1.75, 0.02, 1.75]));
  if (t === 3) k.glow(...group(crossParts, [cx, roofY + 0.03, cz], [0, 0, 0], 0.95));
  else k.add(...group(crossParts, [cx, roofY + 0.03, cz], [0, 0, 0], 0.95));
  if (t === 3) k.glow(...cross([0, Y + 1.16, 0.88], 0.55, [0, 0, 0], 0xff5a50));
  else k.add(...cross([0, Y + 1.16, 0.88], 0.55));
  if (t >= 2) k.prop('lamp', [-1.55, Y, 1.5], Math.PI * 0.8, 0.5);
  if (t === 3) {
    k.flag([1.6, Y, -1.6], RED, 1.8, 0.6).flag([-1.6, Y, 1.6], C.blue, 1.8, 0.6);
    k.antenna([0.55, roofY, -1.1], 0.9);
  }
  return k.done();
}

function techSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const TEAL = C.teal;
  const WALL = 0xdfe6ea;
  k.pad(3.6, 3.6, C.concreteLight);
  k.box(WALL, [0, Y + 0.55, -0.1], [2.8, 1.1, 2.6]);
  k.box(TEAL, [0, Y + 0.1, -0.1], [2.84, 0.2, 2.64]);
  k.box(TEAL, [0, Y + 0.95, -0.1], [2.84, 0.1, 2.64]);
  k.winZ(1.2, [-0.9, 0.9], Y + 0.6, 0.5, 0.36);
  k.winX(1.4, [-0.8, 0.4], Y + 0.6, 0.5, 0.36);
  k.winX(-1.4, [-0.8, 0.4], Y + 0.6, 0.5, 0.36);
  k.box(C.steelDark, [0, Y + 0.45, 1.21], [0.6, 0.8, 0.04]);
  k.glow(bx(0x7ff0ff, [0, Y + 0.45, 1.235], [0.08, 0.7, 0.02]));
  k.flatRoof(0, -0.1, 2.9, 2.7, Y + 1.1, TEAL, 0xcfd8dd);
  const ry = Y + 1.2;
  // glass dome
  const domeR = t === 1 ? 1.5 : 1.7;
  k.add({ geom: P.cyl16, color: C.steelLight, pos: [-0.35, ry + 0.08, -0.45], scale: [domeR + 0.12, 0.16, domeR + 0.12] });
  const dome: Part = { geom: P.hemi12, color: t === 3 ? 0x8ff4ff : 0x7fdcf5, pos: [-0.35, ry + 0.16, -0.45], scale: [domeR, domeR * 0.85, domeR] };
  k.add(dome);
  if (t === 3) k.glow({ geom: P.cyl16, color: 0x7ff0ff, pos: [-0.35, ry + 0.18, -0.45], scale: [domeR + 0.04, 0.05, domeR + 0.04] });
  k.add({ geom: P.hemi12, color: C.steelLight, pos: [-0.35, ry + 0.16, -0.45], scale: [domeR * 1.02, domeR * 0.87, 0.06] });
  k.add({ geom: P.hemi12, color: C.steelLight, pos: [-0.35, ry + 0.16, -0.45], rot: [0, Math.PI / 2, 0], scale: [domeR * 1.02, domeR * 0.87, 0.06] });
  k.spin(dishParts(t === 1 ? 0.3 : 0.4, 0.7), [0.95, ry, 0.8], 'y', 1.0);
  if (t >= 2) {
    // solar panels + antenna tower
    for (const z of [0.62, 0.98])
      k.add(
        ...group(
          [
            bx(0x243a6b, [0, 0, 0], [0.9, 0.04, 0.38]),
            bx(0x6f8fc8, [0, 0.025, 0], [0.86, 0.01, 0.02]),
            bx(0x6f8fc8, [0, 0.025, 0], [0.02, 0.01, 0.34]),
          ],
          [-0.85, ry + 0.2, z],
          [-0.35, 0, 0],
        ),
      );
    k.add({ geom: P.cyl12, color: WALL, pos: [1.2, ry + 0.45, -0.95], scale: [0.5, 0.9, 0.5] });
    k.add({ geom: P.cyl12, color: TEAL, pos: [1.2, ry + 0.75, -0.95], scale: [0.54, 0.1, 0.54] });
    k.antenna([1.2, ry + 0.9, -0.95], t === 3 ? 1.6 : 1.0);
  }
  if (t === 3) {
    k.add({ geom: P.cone4, color: C.steelLight, pos: [1.2, ry + 1.4, -0.95], scale: [0.3, 0.9, 0.3] });
    k.box(C.gold, [0, Y + 1.05, -0.1], [2.86, 0.05, 2.66]);
    k.flag([-1.6, Y, 1.6], C.blue, 1.8, 0.6);
    k.floodlight([1.6, Y, 1.6], -Math.PI * 0.75);
  }
  return k.done();
}

function farmSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  k.pad(3.6, 3.6, C.soil, C.dirtDark);
  // crop rows (front)
  const rows = [0.05, 0.45, 0.85, 1.25];
  rows.forEach((z, ri) => {
    const ripe = t >= 2 && ri % 2 === 1;
    k.box(0x6a4a2e, [-0.15, Y + 0.04, z], [3.0, 0.08, 0.24]);
    for (let i = 0; i < 6; i++) {
      const x = -1.4 + i * 0.5 + (ri % 2) * 0.12;
      if (ripe) k.add({ geom: P.cone4, color: i % 2 ? C.wheat : 0xe0b43a, pos: [x, Y + 0.24, z], rot: [0, i, 0], scale: [0.26, 0.4, 0.26] });
      else k.add({ geom: P.sphereLow, color: i % 2 ? C.crop : 0x74b834, pos: [x, Y + 0.17, z], scale: [0.3, 0.26, 0.3], vary: 0.08 });
    }
  });
  // barn (back-left)
  const BARN = 0xcc3b2c;
  const bx0 = -0.7;
  const bz0 = -1.05;
  k.box(BARN, [bx0, Y + 0.5, bz0], [1.6, 1.0, 1.2]);
  k.gable(bx0, bz0, 1.6, 1.2, Y + 1.0, 0.6, 0x7a2e24, BARN, false, 0.14, 'shingle');
  k.box(C.white, [bx0, Y + 1.22, bz0 + 0.61], [0.32, 0.26, 0.03]).box(0x5a2a20, [bx0, Y + 1.22, bz0 + 0.625], [0.22, 0.18, 0.02]);
  k.box(C.white, [bx0, Y + 0.4, bz0 + 0.61], [0.64, 0.8, 0.03]);
  k.add(beam([bx0 - 0.3, Y + 0.02, bz0 + 0.63], [bx0 + 0.3, Y + 0.78, bz0 + 0.63], 0.06, C.white, 0.02));
  k.add(beam([bx0 + 0.3, Y + 0.02, bz0 + 0.63], [bx0 - 0.3, Y + 0.78, bz0 + 0.63], 0.06, C.white, 0.02));
  k.box(BARN, [bx0, Y + 0.4, bz0 + 0.645], [0.5, 0.64, 0.02]);
  // silo (back-right)
  const sh = t === 1 ? 1.3 : 1.9;
  k.add({ geom: P.cyl12, color: 0xe3e3dc, pos: [1.15, Y + sh / 2, -1.1], scale: [0.8, sh, 0.8] });
  k.add({ geom: P.hemi12, color: C.steelLight, pos: [1.15, Y + sh, -1.1], scale: [0.84, 0.5, 0.84] });
  k.add({ geom: P.cyl12, color: BARN, pos: [1.15, Y + sh * 0.7, -1.1], scale: [0.82, 0.12, 0.82] });
  if (t >= 2) {
    k.add({ geom: P.cyl, color: C.straw, pos: [1.35, Y + 0.25, -0.2], rot: [0, 0.4, Math.PI / 2], scale: [0.5, 0.55, 0.5], vary: 0.05 });
    for (const x of [-1.65, 1.65]) for (let i = 0; i < 4; i++) k.box(C.woodLight, [x, Y + 0.2, -0.3 + i * 0.55], [0.06, 0.4, 0.06]);
    k.box(C.woodLight, [-1.65, Y + 0.3, 0.52], [0.04, 0.06, 1.7]).box(C.woodLight, [1.65, Y + 0.3, 0.52], [0.04, 0.06, 1.7]);
  }
  if (t === 3) {
    // windmill on the barn roof ridge (spinning)
    k.box(C.woodDark, [1.15, Y + sh + 0.42, -1.1], [0.2, 0.2, 0.34]);
    const blades: Part[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      blades.push(...group([bx(C.woodLight, [0, 0.36, 0], [0.05, 0.72, 0.03]), bx(C.white, [0.08, 0.44, 0], [0.14, 0.5, 0.02])], [0, 0, 0], [0, 0, a]));
    }
    blades.push({ geom: P.cyl6, color: C.red, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], scale: [0.14, 0.1, 0.14] });
    k.spin(blades, [1.15, Y + sh + 0.42, -0.86], 'z', 1.2);
    k.flag([1.6, Y, 1.6], C.blue, 1.6, 0.55);
    k.add({ geom: P.cyl12, color: C.gold, pos: [1.15, Y + sh * 0.4, -1.1], scale: [0.82, 0.1, 0.82] });
  }
  return k.done();
}

/** World-space vertices on the front (+Z) face of a scaled rock hull, spread along X (for embedding ore veins). */
function rockFacePoints(geom: THREE.BufferGeometry, pos: V3, scale: V3, minY: number, n: number, keep: (x: number) => boolean): V3[] {
  const a = geom.getAttribute('position');
  const seen = new Set<string>();
  const pts: V3[] = [];
  for (let i = 0; i < a.count; i++) {
    const p: V3 = [a.getX(i) * scale[0] + pos[0], a.getY(i) * scale[1] + pos[1], a.getZ(i) * scale[2] + pos[2]];
    const key = p.map((v) => v.toFixed(3)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    if (p[1] > minY && a.getZ(i) > 0.08 && keep(p[0])) pts.push(p);
  }
  pts.sort((p, q) => p[0] - q[0]);
  const out: V3[] = [];
  for (let i = 0; i < n && pts.length; i++) out.push(pts[Math.floor(((i + 0.5) * pts.length) / n)]);
  return out;
}

function mineSpec(t: Tier, gold: boolean): ModelSpec {
  const k = new Kit(t);
  const rock = gold ? 0xa7865c : 0x8e8f8c;
  const rockD = gold ? 0x86684a : 0x6f706e;
  const ore = gold ? C.gold : 0xc4602a;
  const oreL = gold ? C.goldLight : 0xe0843e;
  const roof = gold ? 0x8a5a30 : 0x5d7085;
  k.pad(3.6, 3.6, gold ? 0xb89a6a : 0xa39e94, gold ? 0x8f774f : 0x7f7b73);
  // rocky hill with the mine entrance
  const hills: [number, V3, V3, number][] = [
    [21, [-0.2, Y, -0.9], [2.9, 3.4, 1.8], rock],
    [22, [1.1, Y, -1.15], [1.5, 2.3, 1.3], rockD],
    [23, [-1.3, Y, -0.8], [1.2, 1.8, 1.3], rockD],
  ];
  const veins: V3[] = [];
  for (const [seed, pos, scale, col] of hills) {
    const g = rockGeom(seed);
    k.add({ geom: g, color: col, pos, scale, vary: 0.07 });
    veins.push(...rockFacePoints(g, pos, scale, Y + 0.45, 2, (x) => Math.abs(x + 0.2) > 0.6));
  }
  // timber portal
  const ez = 0.0;
  k.box(0x1d1a18, [-0.2, Y + 0.5, ez - 0.05], [0.9, 1.0, 0.3]);
  k.box(C.woodDark, [-0.62, Y + 0.55, ez + 0.08], [0.14, 1.1, 0.14]).box(C.woodDark, [0.22, Y + 0.55, ez + 0.08], [0.14, 1.1, 0.14]);
  k.box(C.wood, [-0.2, Y + 1.1, ez + 0.08], [1.1, 0.16, 0.18]);
  k.box(gold ? C.gold : C.hazard, [-0.2, Y + 1.1, ez + 0.18], [0.5, 0.1, 0.02]);
  // rails
  for (const s of [-1, 1]) k.box(C.steelDark, [-0.2 + s * 0.2, Y + 0.03, 0.85], [0.04, 0.04, 1.9]);
  for (let i = 0; i < 6; i++) k.box(C.woodDark, [-0.2, Y + 0.01, 0.05 + i * 0.32], [0.62, 0.03, 0.1]);
  // ore cart
  const cart: Part[] = [
    { geom: hull([[-0.28, 0.12, -0.36], [0.28, 0.12, -0.36], [-0.28, 0.12, 0.36], [0.28, 0.12, 0.36], [-0.34, 0.5, -0.44], [0.34, 0.5, -0.44], [-0.34, 0.5, 0.44], [0.34, 0.5, 0.44]]), color: C.steel },
    ...sym(...[-0.22, 0.22].map((z): Part => ({ geom: P.cyl, color: C.gunmetal, pos: [0.22, 0.1, z], rot: [0, 0, Math.PI / 2], scale: [0.2, 0.06, 0.2] }))),
    ...[[-0.12, -0.15], [0.12, 0.1], [-0.05, 0.2], [0.12, -0.2], [0, 0]].map(([x, z], i): Part => ({ geom: gold ? P.octa : P.dodeca, color: i % 2 ? ore : oreL, pos: [x, 0.52, z], rot: [i, i * 2, 0], scale: [0.24, 0.2, 0.24], vary: 0.15 })),
  ];
  k.add(...group(cart, [-0.2, Y + 0.02, 1.05]));
  // ore pile
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1;
    const d = i === 0 ? 0 : 0.28;
    k.add({ geom: gold ? P.octa : P.dodeca, color: i % 2 ? ore : oreL, pos: [1.15 + Math.cos(a) * d, Y + (i === 0 ? 0.28 : 0.12), 0.95 + Math.sin(a) * d], rot: [a, a * 1.3, 0], scale: [0.34, 0.3, 0.34], vary: 0.18 });
  }
  // ore veins in the rock face
  for (const [i, v] of veins.entries()) k.add({ geom: gold ? P.octa : P.dodeca, color: i % 2 ? ore : oreL, pos: v, rot: [i, i, i], scale: [0.3, 0.3, 0.3], vary: 0.2 });
  if (gold) k.glow(...[...veins.slice(0, 3), [1.15, Y + 0.5, 0.95] as V3].map((p): Part => ({ geom: P.octa, color: 0xfff6b0, pos: [p[0], p[1] + 0.12, p[2] + 0.08], scale: [0.08, 0.14, 0.08] })));
  if (t >= 2) {
    // conveyor to a hopper shed
    k.add(beam([0.4, Y + 0.25, 0.6], [1.3, Y + 0.95, -0.2], 0.3, C.gunmetal, 0.05));
    k.add(beam([0.4, Y + 0.28, 0.6], [1.3, Y + 0.98, -0.2], 0.24, gold ? 0x3a2f28 : 0x2f3236, 0.02));
    k.add(...[0.3, 0.7].map((f) => beam([0.4 + 0.9 * f, Y, 0.6 - 0.8 * f], [0.4 + 0.9 * f, Y + 0.25 + 0.7 * f, 0.6 - 0.8 * f], 0.05, C.steelDark)));
    k.box(C.concreteLight, [1.35, Y + 0.5, -0.35], [0.8, 1.0, 0.7]);
    k.gable(1.35, -0.35, 0.8, 0.7, Y + 1.0, 0.35, roof, C.concreteLight, false, 0.1, 'ribbed');
    k.prop('lamp', [-1.55, Y, 1.5], Math.PI * 0.75, 0.5);
  }
  if (t === 3) {
    // steel headframe with a spinning wheel
    const hx = -0.2;
    const hz = -0.35;
    const hH = 3.0;
    k.add(beam([hx - 0.6, Y + 1.0, hz + 0.45], [hx - 0.1, Y + hH, hz], 0.09, C.red), beam([hx + 0.6, Y + 1.0, hz + 0.45], [hx + 0.1, Y + hH, hz], 0.09, C.red));
    k.add(beam([hx - 0.1, Y + hH, hz], [hx - 0.4, Y + 1.5, hz - 0.7], 0.07, C.red), beam([hx + 0.1, Y + hH, hz], [hx + 0.4, Y + 1.5, hz - 0.7], 0.07, C.red));
    k.add(beam([hx - 0.45, Y + 1.5, hz + 0.33], [hx + 0.45, Y + 1.5, hz + 0.33], 0.05, C.red), beam([hx - 0.3, Y + 2.2, hz + 0.18], [hx + 0.3, Y + 2.2, hz + 0.18], 0.05, C.red));
    k.box(C.red, [hx, Y + hH, hz], [0.36, 0.1, 0.14]);
    const wheel: Part[] = [
      { geom: P.torus, color: C.steelDark, rot: [0, Math.PI / 2, 0], scale: [0.9, 0.9, 0.5] },
      bx(C.steelDark, [0, 0, 0], [0.04, 0.6, 0.04]),
      bx(C.steelDark, [0, 0, 0], [0.04, 0.04, 0.6]),
    ];
    k.spin(wheel, [hx, Y + hH + 0.25, hz], 'x', 1.5);
    k.flag([1.6, Y, 1.6], gold ? C.gold : C.blue, 1.7, 0.55);
    k.floodlight([-1.6, Y, 1.6], Math.PI * 0.75);
    if (gold) k.box(C.gold, [-0.2, Y + 1.2, ez + 0.08], [1.14, 0.05, 0.2]);
  }
  return k.done();
}

function warehouseSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const WALL = 0xe0d3b4;
  const ROOF = 0xe8822a;
  k.pad(3.6, 3.6);
  const w = t === 3 ? 3.0 : 2.7;
  k.box(WALL, [0, Y + 0.65, -0.35], [w, 1.3, 2.3]);
  k.box(0xb8a988, [0, Y + 0.1, -0.35], [w + 0.04, 0.2, 2.34]);
  k.gable(0, -0.35, w, 2.3, Y + 1.3, 0.55, ROOF, WALL, true, 0.16, 'ribbed');
  // roller door
  k.box(C.steelDark, [0, Y + 0.55, 0.81], [1.3, 1.1, 0.04]);
  k.add({ geom: new THREE.BoxGeometry(1, 1, 1, 1, 8, 1), color: C.steel, pos: [0, Y + 0.5, 0.83], scale: [1.16, 0.98, 0.03], faceColor: (_x, y) => (Math.floor((y + 0.5) * 8) % 2 ? 0x9aa4ae : C.steel) });
  k.hazard(-0.65, 0.65, Y + 1.13, 0.84, 0.1, 8);
  k.winX(w / 2, [-1.0, 0.3], Y + 0.9, 0.4, 0.28);
  k.winX(-w / 2, [-1.0, 0.3], Y + 0.9, 0.4, 0.28);
  // goods outside
  k.prop('crate', [1.2, Y, 1.35], 0.2, 0.5).prop('crate', [1.25, Y + 0.45, 1.35], 0.6, 0.42).prop('barrel', [-1.35, Y, 1.4], 0, 0.5).prop('barrel', [-1.05, Y, 1.5], 0, 0.5);
  if (t >= 2) {
    // pallets + forklift
    k.box(C.woodLight, [0.65, Y + 0.05, 1.45], [0.5, 0.1, 0.5]).prop('crate', [0.65, Y + 0.1, 1.45], 0, 0.42);
    const fork: Part[] = [
      { geom: rbox(0.36, 0.3, 0.5, 0.05), color: C.yellow, pos: [0, 0.22, 0] },
      bx(C.gunmetal, [0, 0.5, -0.05], [0.3, 0.05, 0.3]),
      ...sym(bx(C.gunmetal, [0.13, 0.35, -0.12], [0.03, 0.3, 0.03])),
      bx(C.gunmetal, [0, 0.45, 0.27], [0.3, 0.7, 0.04]),
      ...sym(bx(C.steelDark, [0.1, 0.06, 0.45], [0.05, 0.03, 0.35])),
      ...sym(...[-0.14, 0.14].map((z): Part => ({ geom: P.cyl, color: C.rubber, pos: [0.18, 0.08, z], rot: [0, 0, Math.PI / 2], scale: [0.16, 0.06, 0.16] }))),
    ];
    k.add(...group(fork, [-0.45, Y, 1.35], [0, 0.5, 0]));
  }
  if (t === 3) {
    k.prop('container', [-1.2, Y, -0.1], 0, 0.5);
    k.add(...[-0.8, 0.8].map((x): Part => ({ geom: P.cyl6, color: C.steelLight, pos: [x, Y + 1.95, -0.35], scale: [0.2, 0.2, 0.2] })));
    k.flag([1.6, Y, -1.6], C.blue, 1.8, 0.6);
    k.floodlight([1.6, Y, 1.6], -Math.PI * 0.75);
    k.glow(bx(C.glowYellow, [0, Y + 1.25, 0.86], [0.3, 0.08, 0.03]));
  }
  return k.done();
}

function tavernSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const ROOF = 0x9c2f3b;
  k.pad(3.6, 3.6, 0xb9a88c, 0x8d7c62);
  const w = 2.6;
  const d = 2.1;
  const zc = -0.35;
  const h = t === 1 ? 1.2 : 1.9;
  k.add({ geom: LOG_WALL, color: C.log, pos: [0, Y + h / 2, zc], scale: [w, h, d], faceColor: (_x, y) => (Math.floor((y + 0.5) * 7) % 2 ? C.log : 0x86552c) });
  k.add(...sym(bx(C.woodDark, [w / 2, Y + h / 2, zc + d / 2], [0.14, h + 0.04, 0.14]), bx(C.woodDark, [w / 2, Y + h / 2, zc - d / 2], [0.14, h + 0.04, 0.14])));
  k.gable(0, zc, w, d, Y + h, 1.1, ROOF, 0xc9955a, true, 0.2, 'shingle');
  // stone chimney
  k.add({ ...bx(C.stone, [0.85, Y + h + 0.6, zc - 0.5], [0.34, 1.6, 0.34]), vary: 0.08 });
  // door + lit windows
  const fz = zc + d / 2;
  k.box(C.woodDark, [0, Y + 0.45, fz + 0.02], [0.56, 0.9, 0.05]);
  k.winZ(fz, [-0.8, 0.8], Y + 0.6, 0.36, 0.34, t >= 2);
  if (t >= 2) k.winZ(fz, [-0.8, 0, 0.8], Y + 1.45, 0.3, 0.3, true);
  // porch
  k.box(C.wood, [0, Y + 0.05, fz + 0.45], [2.0, 0.1, 0.8]);
  k.add(...sym(bx(C.woodDark, [0.9, Y + 0.55, fz + 0.78], [0.1, 1.0, 0.1])));
  k.add({ geom: P.wedge, color: ROOF, pos: [0, Y + 1.12, fz + 0.45], rot: [0, 0, 0], scale: [2.2, 0.25, 0.9] });
  // hanging sign with a star emblem (recruitment)
  const signY = Y + (t === 1 ? 1.3 : 1.2);
  k.add(beam([1.25, Y, fz + 0.9], [1.25, signY + 0.55, fz + 0.9], 0.08, C.woodDark));
  k.box(C.woodDark, [1.25, signY + 0.5, fz + 0.9], [0.1, 0.06, 0.1]);
  k.box(C.woodLight, [1.25, signY + 0.2, fz + 0.9], [0.06, 0.5, 0.7]);
  k.box(C.woodDark, [1.25, signY + 0.47, fz + 0.9], [0.08, 0.05, 0.74]);
  k.add({ geom: STAR, color: t === 3 ? C.gold : C.blue, pos: [1.29, signY + 0.2, fz + 0.9], rot: [0, 0, Math.PI / 2], scale: [2.0, 1, 2.0] });
  k.add({ geom: STAR, color: t === 3 ? C.gold : C.blue, pos: [1.21, signY + 0.2, fz + 0.9], rot: [0, 0, Math.PI / 2], scale: [2.0, 1, 2.0] });
  k.prop('barrel', [-1.45, Y, fz + 0.6], 0, 0.45);
  k.glow(bx(C.glowYellow, [-0.45, Y + 0.95, fz + 0.1], [0.1, 0.14, 0.1]), bx(C.glowYellow, [0.45, Y + 0.95, fz + 0.1], [0.1, 0.14, 0.1]));
  if (t >= 2) {
    // banners + beer barrels
    k.add(...sym(bx(C.blue, [0.5, Y + 1.35, fz + 0.03], [0.26, 0.6, 0.02]), bx(C.gold, [0.5, Y + 1.08, fz + 0.035], [0.26, 0.05, 0.02])));
    k.add({ geom: P.cyl, color: C.wood, pos: [-1.45, Y + 0.2, -1.55], rot: [0, 0, Math.PI / 2], scale: [0.4, 0.5, 0.4] });
    k.add({ geom: P.cyl, color: C.wood, pos: [-1.45, Y + 0.55, -1.55], rot: [0, 0, Math.PI / 2], scale: [0.4, 0.5, 0.4] });
  }
  if (t === 3) {
    // string lights + flags
    for (let i = 0; i <= 8; i++) {
      const x = -1.1 + i * 0.275;
      const sag = Math.sin((i / 8) * Math.PI) * 0.18;
      k.glow({ geom: P.sphereLow, color: i % 2 ? 0xfff0a0 : 0xffb870, pos: [x, Y + 1.12 - sag, fz + 0.86], scale: [0.07, 0.07, 0.07] });
    }
    k.flag([-1.6, Y, 1.6], C.blue, 1.7, 0.55);
    k.flag([1.55, Y, -1.6], C.gold, 1.9, 0.6);
  }
  return k.done();
}

function tankCenterSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const WALL = 0xb5ad86;
  const ROOF = C.olive;
  k.pad(3.6, 3.6);
  const w = 3.1;
  const d = 1.9;
  const zc = -0.75;
  k.box(WALL, [0, Y + 0.7, zc], [w, 1.4, d]);
  k.box(0x8d876a, [0, Y + 0.12, zc], [w + 0.04, 0.24, d + 0.04]);
  // sawtooth roof with skylights facing front
  for (let i = 0; i < 3; i++) {
    const z = zc - d / 2 + d / 6 + (i * d) / 3;
    k.add({ geom: P.wedge, color: ROOF, pos: [0, Y + 1.4 + 0.25, z], rot: [0, Math.PI, 0], scale: [w, 0.5, d / 3] });
    k.box(C.glass, [0, Y + 1.4 + 0.24, z + d / 6 + 0.015], [w - 0.2, 0.36, 0.03]);
  }
  // big hazard-framed door
  const fz = zc + d / 2;
  k.box(C.steelDark, [0, Y + 0.62, fz + 0.02], [1.7, 1.2, 0.04]);
  k.add({ geom: new THREE.BoxGeometry(1, 1, 1, 1, 6, 1), color: C.steel, pos: [0, Y + 0.56, fz + 0.04], scale: [1.5, 1.1, 0.03], faceColor: (_x, y) => (Math.floor((y + 0.5) * 6) % 2 ? 0x9aa4ae : C.steel) });
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) k.box(i % 2 ? C.black : C.hazard, [s * 0.9, Y + 0.12 + i * 0.25, fz + 0.05], [0.12, 0.25, 0.04]);
  k.hazard(-0.96, 0.96, Y + 1.3, fz + 0.05, 0.12, 9);
  k.winX(w / 2, [zc - 0.4, zc + 0.4], Y + 0.9, 0.4, 0.3);
  k.winX(-w / 2, [zc - 0.4, zc + 0.4], Y + 0.9, 0.4, 0.3);
  // apron with tread marks + a tank on display
  for (const s of [-1, 1]) k.box(0x8e8a80, [0.35 + s * 0.35, Y + 0.005, 0.95], [0.18, 0.01, 1.6]);
  k.add({ geom: vehicleGeometry('tank', t === 3 ? 'UR' : t === 2 ? 'SSR' : 'SR'), pos: [0.35, Y, 0.85], rot: [0, -0.35, 0], scale: [0.5, 0.5, 0.5] });
  k.star([0, Y + 1.25, fz + 0.06], 2.0, C.white);
  if (t >= 2) {
    // gantry crane + tyres + armour plates
    k.add(...sym(bx(C.yellow, [1.45, Y + 0.9, 1.1], [0.1, 1.8, 0.1])));
    k.box(C.yellow, [0, Y + 1.8, 1.1], [3.0, 0.12, 0.12]);
    k.box(C.gunmetal, [0.5, Y + 1.66, 1.1], [0.22, 0.16, 0.22]);
    k.add(rod([0.5, Y + 1.6, 1.1], [0.5, Y + 1.2, 1.1], 0.01, C.black, P.cyl4));
    k.prop('tire', [-1.3, Y, 1.4], 0, 0.6);
    for (const x of [-1.2, 1.2]) k.box(C.steel, [x, Y + 0.45, fz + 0.03], [0.5, 0.6, 0.04]);
  }
  if (t === 3) {
    k.flag([-1.6, Y, 1.6], C.blue, 1.8, 0.6).flag([1.6, Y, -1.6], C.gold, 2.0, 0.6);
    k.floodlight([-1.6, Y, -1.6], Math.PI * 0.25);
    k.box(C.gold, [0, Y + 1.42, zc], [w + 0.06, 0.06, d + 0.06]);
    k.glow(bx(C.glowYellow, [-0.9, Y + 1.48, fz + 0.06], [0.14, 0.1, 0.04]), bx(C.glowYellow, [0.9, Y + 1.48, fz + 0.06], [0.14, 0.1, 0.04]));
  }
  return k.done();
}

function airCenterSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const ROOF = 0x6fa8dc;
  k.pad(3.6, 3.6, C.concreteLight);
  // hangar (back-left)
  const hs = t === 3 ? 2.1 : 1.9;
  const hl = t === 3 ? 2.2 : 2.1;
  const hx = -0.75;
  const hz = -0.74;
  k.add({ geom: P.halfCyl12, color: ROOF, pos: [hx, Y, hz], scale: [hs, hs * 1.1, hl] });
  for (const z of [-0.35, 0.35]) k.add({ geom: P.halfCyl12, color: 0x5a8fc4, pos: [hx, Y, hz + z * hl], scale: [hs + 0.05, hs * 1.1 + 0.05, 0.06] });
  k.box(C.steelDark, [hx, Y + 0.42, hz + hl / 2 + 0.01], [hs * 0.62, 0.84, 0.03]);
  for (let i = 1; i < 4; i++) k.box(C.steel, [hx, Y + i * 0.2, hz + hl / 2 + 0.03], [hs * 0.6, 0.03, 0.02]);
  k.box(C.hazard, [hx, Y + 0.88, hz + hl / 2 + 0.03], [hs * 0.62, 0.06, 0.02]);
  // helipad (front-right)
  const px = 0.8;
  const pz = 0.85;
  k.box(C.asphalt, [px, Y + 0.03, pz], [1.8, 0.06, 1.8]);
  k.add({ geom: P.cyl16, color: C.white, pos: [px, Y + 0.065, pz], scale: [1.6, 0.01, 1.6] });
  k.add({ geom: P.cyl16, color: C.asphalt, pos: [px, Y + 0.07, pz], scale: [1.4, 0.01, 1.4] });
  k.box(C.yellow, [px - 0.22, Y + 0.08, pz], [0.1, 0.01, 0.6]).box(C.yellow, [px + 0.22, Y + 0.08, pz], [0.1, 0.01, 0.6]).box(C.yellow, [px, Y + 0.08, pz], [0.44, 0.01, 0.1]);
  // windsock
  k.add(rod([1.55, Y, -1.55], [1.55, Y + 1.3, -1.55], 0.025, C.steelDark, P.cyl4));
  k.add({ geom: new THREE.CylinderGeometry(0.06, 0.12, 0.5, 6, 4, true), color: C.orange, pos: [1.55, Y + 1.24, -1.3], rot: [Math.PI / 2 - 0.2, 0, 0], faceColor: (_x, y) => (Math.floor((y + 0.25) * 8) % 2 ? C.white : C.orange) });
  if (t >= 2) {
    // mini control tower
    const tx = 1.3;
    const tz = -0.55;
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box(C.steelDark, [tx + a * 0.2, Y + 0.55, tz + b * 0.2], [0.06, 1.1, 0.06]);
    k.box(C.offWhite, [tx, Y + 1.15, tz], [0.6, 0.12, 0.6]);
    k.box(t === 3 ? C.windowLit : C.glass, [tx, Y + 1.38, tz], [0.54, 0.34, 0.54]);
    k.box(ROOF, [tx, Y + 1.6, tz], [0.7, 0.1, 0.7]);
    k.antenna([tx, Y + 1.65, tz], 0.6);
    // parked aircraft on the pad
    k.add({ geom: vehicleGeometry('aircraft', t === 3 ? 'UR' : 'SSR'), pos: [px, Y + 0.22 - 1.4 * 0.5, pz], rot: [0, -0.5, 0], scale: [0.5, 0.5, 0.5] });
  }
  if (t === 3) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.glow(bx(i % 2 ? 0x7fffa0 : 0xfff0a0, [px + Math.cos(a) * 0.92, Y + 0.09, pz + Math.sin(a) * 0.92], [0.07, 0.04, 0.07]));
    }
    k.flag([-1.6, Y, 1.6], C.blue, 1.8, 0.6);
    k.star([hx, Y + hs * 0.55 + 0.01, hz], 2.2, C.white);
  }
  return k.done();
}

function missileCenterSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const BUNK = 0xcdb68a;
  const BUNK_D = 0xa89366;
  k.pad(3.6, 3.6, 0xc9bb9c, BUNK_D);
  // sloped bunker
  k.add({
    geom: hull([
      [-1.55, 0, -1.55],
      [1.55, 0, -1.55],
      [-1.55, 0, 0.3],
      [1.55, 0, 0.3],
      [-1.2, 0.8, -1.3],
      [1.2, 0.8, -1.3],
      [-1.2, 0.8, -0.05],
      [1.2, 0.8, -0.05],
    ]),
    color: BUNK,
    pos: [0, Y, 0],
  });
  k.box(C.steelDark, [-0.8, Y + 0.3, 0.22], [0.6, 0.55, 0.2]);
  k.hazard(-1.1, -0.5, Y + 0.62, 0.3, 0.08, 6);
  // silo hatch with a missile nose poking out
  const sx = 0.55;
  const sz = 0.95;
  k.add({ geom: P.cyl16, color: C.concrete, pos: [sx, Y + 0.12, sz], scale: [1.5, 0.24, 1.5] });
  k.add({ geom: P.cyl16, color: C.hazard, pos: [sx, Y + 0.245, sz], scale: [1.36, 0.02, 1.36], faceColor: stripesAround(16, C.black, C.hazard) });
  k.add({ geom: P.cyl16, color: 0x1f2226, pos: [sx, Y + 0.25, sz], scale: [1.0, 0.02, 1.0] });
  const noseH = t === 1 ? 0.35 : 0.65;
  k.add({ geom: P.cyl12, color: C.white, pos: [sx, Y + 0.25 + noseH / 2, sz], scale: [0.5, noseH, 0.5] });
  k.add({ geom: P.cone12, color: C.red, pos: [sx, Y + 0.25 + noseH + 0.25, sz], scale: [0.5, 0.5, 0.5] });
  k.add(...group([bx(C.steel, [0.45, 0, 0], [0.9, 0.06, 0.9]), bx(C.hazard, [0.45, 0.035, 0], [0.5, 0.01, 0.12])], [sx + 0.5, Y + 0.26, sz], [0, 0, 1.2]));
  // fuel tank
  k.add({ geom: P.cyl12, color: C.offWhite, pos: [-1.1, Y + 0.45, 0.95], rot: [Math.PI / 2, 0, 0], scale: [0.6, 1.1, 0.6] });
  k.box(C.steelDark, [-1.1, Y + 0.1, 0.6], [0.5, 0.2, 0.08]).box(C.steelDark, [-1.1, Y + 0.1, 1.3], [0.5, 0.2, 0.08]);
  k.box(C.red, [-1.1, Y + 0.45, 0.95], [0.62, 0.1, 0.3]);
  if (t >= 2) {
    // second (closed) silo + blast walls
    k.add({ geom: P.cyl16, color: C.concrete, pos: [0.5, Y + 0.8, -0.75], scale: [0.9, 0.12, 0.9] });
    k.add({ geom: P.cyl16, color: C.steel, pos: [0.5, Y + 0.87, -0.75], scale: [0.72, 0.04, 0.72], faceColor: stripesAround(16, C.steelDark, C.steel) });
    k.prop('barrier', [-0.9, Y, 1.62], 0, 0.6);
    k.antenna([-0.9, Y + 0.8, -1.1], 0.9);
  }
  if (t === 3) {
    // tall missile on a launch pad with service gantry
    const mx = -0.55;
    const mz = -0.55;
    const base = Y + 0.8;
    k.add({ geom: P.cyl12, color: C.steelDark, pos: [mx, base + 0.05, mz], scale: [0.8, 0.1, 0.8] });
    k.add({ geom: P.cyl12, color: C.white, pos: [mx, base + 1.1, mz], scale: [0.4, 2.0, 0.4] });
    k.add({ geom: P.cyl12, color: C.black, pos: [mx, base + 1.7, mz], scale: [0.42, 0.14, 0.42] });
    k.add({ geom: P.cone12, color: C.red, pos: [mx, base + 2.35, mz], scale: [0.4, 0.5, 0.4] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      k.add(...group([bx(C.red, [0.25, 0, 0], [0.3, 0.45, 0.04])], [mx, base + 0.4, mz], [0, a, 0]));
    }
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box(C.red, [mx - 0.6 + a * 0.15, base + 1.3, mz + b * 0.15], [0.05, 2.6, 0.05]);
    for (let i = 0; i < 4; i++) k.box(C.steelLight, [mx - 0.6, base + 0.5 + i * 0.6, mz], [0.36, 0.05, 0.36]);
    k.box(C.steelDark, [mx - 0.35, base + 2.0, mz], [0.3, 0.06, 0.1]);
    k.glow({ geom: P.sphereLow, color: 0xff3b2f, pos: [mx - 0.6, base + 2.68, mz], scale: [0.12, 0.12, 0.12] });
    k.flag([1.6, Y, -1.6], C.gold, 1.9, 0.6).flag([-1.6, Y, 1.6], C.blue, 1.7, 0.55);
    k.glow(bx(0xff5a3a, [-0.8, Y + 0.68, 0.33], [0.2, 0.06, 0.03]));
  }
  return k.done();
}

function radarSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  k.pad(3.6, 3.6);
  // operator hut
  k.box(C.offWhite, [-0.9, Y + 0.45, 0.9], [1.3, 0.9, 1.1]);
  k.flatRoof(-0.9, 0.9, 1.4, 1.2, Y + 0.9, 0x4f6d8a, C.steelLight, 0.08);
  k.box(C.steelDark, [-0.6, Y + 0.38, 1.46], [0.36, 0.76, 0.03]);
  k.winZ(1.45, [-1.2], Y + 0.55, 0.3, 0.26);
  k.winX(-1.55, [0.9], Y + 0.55, 0.3, 0.26, undefined, -1);
  // lattice tower
  const H = t === 1 ? 2.4 : t === 2 ? 3.0 : 3.4;
  const tx = 0.6;
  const tz = -0.5;
  const b = 0.55;
  const tp = 0.2;
  const legCol = t === 3 ? C.red : C.steelLight;
  for (const a of [-1, 1])
    for (const c of [-1, 1]) {
      k.add({ ...beam([tx + a * b, Y, tz + c * b], [tx + a * tp, Y + H, tz + c * tp], 0.08, legCol), geom: LATTICE, faceColor: t === 3 ? (_x: number, y: number) => (Math.floor((y + 0.5) * 6) % 2 ? C.white : C.red) : undefined });
    }
  const levels = t === 1 ? 2 : 3;
  for (let i = 0; i < levels; i++) {
    const y0 = Y + (H * i) / levels;
    const y1 = Y + (H * (i + 1)) / levels;
    const r0 = b + ((tp - b) * i) / levels;
    const r1 = b + ((tp - b) * (i + 1)) / levels;
    k.add(beam([tx - r0, y0, tz + r0], [tx + r1, y1, tz + r1], 0.04, C.steel), beam([tx + r0, y0, tz + r0], [tx - r1, y1, tz + r1], 0.04, C.steel));
    k.add(beam([tx + r0, y0, tz - r0], [tx + r1, y1, tz + r1], 0.04, C.steel), beam([tx - r0, y0, tz - r0], [tx - r1, y1, tz + r1], 0.04, C.steel));
    k.box(C.steelDark, [tx, y1, tz], [r1 * 2 + 0.1, 0.05, r1 * 2 + 0.1]);
  }
  k.box(C.steelDark, [tx, Y + H + 0.05, tz], [0.6, 0.1, 0.6]);
  // rotating antenna array on top
  const arr: Part[] = t === 3
    ? [
        bx(C.steelDark, [0, 0.15, 0], [0.14, 0.3, 0.14]),
        { geom: rbox(1.8, 0.5, 0.16, 0.04), color: C.white, pos: [0, 0.5, 0.05] },
        bx(0x3f6fa8, [0, 0.5, 0.14], [1.6, 0.36, 0.02]),
        ...[-0.6, -0.2, 0.2, 0.6].map((x) => bx(C.white, [x, 0.5, 0.155], [0.02, 0.36, 0.02])),
      ]
    : dishParts(t === 1 ? 0.55 : 0.65, 0.45, C.white, 0.25);
  k.spin(arr, [tx, Y + H + 0.1, tz], 'y', 0.9);
  if (t >= 2) {
    k.add(...group(dishParts(0.3, 0.8, C.white, 0.2), [-1.2, Y + 1.0, 0.6]));
    for (let i = 0; i < 5; i++) k.box(C.steelDark, [-1.65, Y + 0.3, -1.55 + i * 0.5], [0.05, 0.6, 0.05]);
    k.box(C.steel, [-1.65, Y + 0.45, -0.55], [0.02, 0.3, 2.0]);
    k.add({ geom: P.cyl12, color: C.wood, pos: [1.4, Y + 0.25, 1.3], rot: [Math.PI / 2, 0, 0], scale: [0.5, 0.35, 0.5] });
  }
  if (t === 3) {
    // radome
    k.add({ geom: P.cyl12, color: C.concrete, pos: [-0.75, Y + 0.25, -1.0], scale: [1.1, 0.5, 1.1] });
    k.add({ geom: P.ball12, color: C.white, pos: [-0.75, Y + 0.85, -1.0], scale: [1.2, 1.2, 1.2], faceColor: (x, y, z) => ((Math.floor((Math.atan2(z, x) + 4) * 2) + Math.floor(y * 8)) % 2 ? C.white : 0xe2e6ea) });
    k.glow({ geom: P.sphereLow, color: 0xff3b2f, pos: [tx, Y + H + 0.95, tz], scale: [0.1, 0.1, 0.1] });
    k.add(rod([tx, Y + H + 0.1, tz - 0.25], [tx, Y + H + 0.9, tz - 0.25], 0.02, C.steelDark, P.cyl4));
    k.flag([1.6, Y, 1.6], C.blue, 1.8, 0.6);
    k.floodlight([1.6, Y, -1.6], -Math.PI * 0.25);
  }
  return k.done();
}

function trainingBaseSpec(t: Tier): ModelSpec {
  const k = new Kit(t);
  const HUT_ROOF = 0xe0a326;
  k.pad(3.6, 3.6, 0x8cc063, 0x6f9a4c);
  // shooting range: dirt lane, berm and target boards at the back
  k.box(C.dirt, [-0.35, Y + 0.01, -0.35], [2.6, 0.02, 1.9]);
  k.add({ geom: hull([[-1.65, 0, -1.2], [0.95, 0, -1.2], [-1.65, 0, -1.7], [0.95, 0, -1.7], [-1.6, 0.5, -1.45], [0.9, 0.5, -1.45], [-1.6, 0.5, -1.65], [0.9, 0.5, -1.65]]), color: C.dirtDark, pos: [0, Y, 0], vary: 0.05 });
  const target = (x: number): Part[] =>
    group(
      [
        bx(C.woodDark, [0, 0.35, 0], [0.06, 0.7, 0.06]),
        bx(C.white, [0, 0.72, 0.02], [0.5, 0.5, 0.04]),
        { geom: P.cyl12, color: C.red, pos: [0, 0.72, 0.045], rot: [Math.PI / 2, 0, 0], scale: [0.4, 0.02, 0.4] },
        { geom: P.cyl12, color: C.white, pos: [0, 0.72, 0.055], rot: [Math.PI / 2, 0, 0], scale: [0.26, 0.02, 0.26] },
        { geom: P.cyl12, color: C.red, pos: [0, 0.72, 0.065], rot: [Math.PI / 2, 0, 0], scale: [0.12, 0.02, 0.12] },
      ],
      [x, Y, -1.05],
    );
  const xs = t === 1 ? [-1.1, -0.35, 0.4] : [-1.25, -0.7, -0.15, 0.4];
  for (const x of xs) k.add(...target(x));
  // firing line
  k.prop('sandbag', [-0.2, Y, 0.55], 0, 0.85);
  k.box(C.white, [-0.35, Y + 0.02, 0.2], [2.4, 0.01, 0.05]);
  // command hut (right)
  k.box(0xd9ceb0, [1.2, Y + 0.45, -0.7], [1.0, 0.9, 1.0]);
  k.gable(1.2, -0.7, 1.0, 1.0, Y + 0.9, 0.4, HUT_ROOF, 0xd9ceb0, false, 0.1, 'shingle');
  k.box(C.woodDark, [0.69, Y + 0.38, -0.55], [0.03, 0.72, 0.36]);
  k.winZ(-0.2, [1.2], Y + 0.55, 0.36, 0.26);
  // tyre run (front)
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) k.add({ geom: P.torus, color: C.rubber, pos: [-0.9 + i * 0.5, Y + 0.07, 1.25 + s * 0.24], rot: [Math.PI / 2, 0, 0], scale: [0.55, 0.55, 0.9] });
  if (t >= 2) {
    // monkey bars + climbing A-frame
    for (const s of [-1, 1]) {
      k.add(beam([1.0 + s * 0.2, Y, 1.4], [1.0 + s * 0.2, Y + 1.0, 1.4], 0.06, C.steelDark));
      k.add(beam([1.0 + s * 0.2, Y, 0.3], [1.0 + s * 0.2, Y + 1.0, 0.3], 0.06, C.steelDark));
      k.add(beam([1.0 + s * 0.2, Y + 1.0, 1.4], [1.0 + s * 0.2, Y + 1.0, 0.3], 0.05, C.steelDark));
    }
    for (let i = 0; i < 5; i++) k.box(C.yellow, [1.0, Y + 1.0, 0.4 + i * 0.22], [0.44, 0.04, 0.04]);
    k.add({ ...beam([-1.45, Y, -0.05], [-1.45, Y + 0.95, 0.4], 0.5, C.wood, 0.08), vary: 0.05 }, { ...beam([-1.45, Y, 0.85], [-1.45, Y + 0.95, 0.4], 0.5, C.wood, 0.08), vary: 0.05 });
  }
  if (t === 3) {
    // watch tower + flags + trophy star
    const wx = -1.45;
    const wz = -1.45;
    for (const a of [-1, 1]) for (const c of [-1, 1]) k.box(C.woodDark, [wx + a * 0.18, Y + 0.8, wz + c * 0.18], [0.07, 1.6, 0.07]);
    k.box(C.wood, [wx, Y + 1.6, wz], [0.6, 0.08, 0.6]);
    k.add({ geom: P.cone4, color: HUT_ROOF, pos: [wx, Y + 2.05, wz], rot: [0, Math.PI / 4, 0], scale: [0.9, 0.5, 0.9] });
    k.box(C.woodDark, [wx, Y + 1.72, wz], [0.62, 0.16, 0.62]);
    k.star([1.2, Y + 1.48, -0.7], 1.6, C.gold);
    k.flag([1.65, Y, 1.65], C.blue, 1.9, 0.6);
    k.floodlight([0.15, Y, -1.65], 0);
  }
  return k.done();
}

const BUILDERS: Record<BuildingModelType, (t: Tier) => ModelSpec> = {
  hq: hqSpec,
  wall: wallSpec,
  barracks: barracksSpec,
  drill: drillSpec,
  hospital: hospitalSpec,
  tech: techSpec,
  farm: farmSpec,
  ironmine: (t) => mineSpec(t, false),
  goldmine: (t) => mineSpec(t, true),
  warehouse: warehouseSpec,
  tavern: tavernSpec,
  tankcenter: tankCenterSpec,
  aircenter: airCenterSpec,
  missilecenter: missileCenterSpec,
  radar: radarSpec,
  trainingbase: trainingBaseSpec,
};

/** All building types with a model (for galleries / debug). */
export const BUILDING_MODEL_TYPES = Object.keys(BUILDERS) as BuildingModelType[];

// =============================================================================================
// Construction overlay

function constructionSpec(): ModelSpec {
  const k = new Kit(1);
  const POLE = 0xf2a93b;
  const e = 1.78;
  const H = 2.6;
  for (const x of [-e, 0, e])
    for (const z of [-e, 0, e]) {
      if (x === 0 && z === 0) continue;
      k.box(POLE, [x, H / 2, z], [0.07, H, 0.07]);
    }
  for (const y of [1.1, 2.2]) {
    for (const s of [-1, 1]) {
      k.box(POLE, [0, y, s * e], [2 * e, 0.05, 0.05]);
      k.box(POLE, [s * e, y, 0], [0.05, 0.05, 2 * e]);
    }
  }
  // planks (front and right side walkways)
  k.add({ ...bx(C.woodLight, [0, 1.13, e - 0.18], [2 * e, 0.05, 0.36]), vary: 0.06 });
  k.add({ ...bx(C.woodLight, [e - 0.18, 1.13, 0], [0.36, 0.05, 2 * e - 0.4]), vary: 0.06 });
  k.add({ ...bx(C.woodLight, [0, 2.23, e - 0.18], [2 * e, 0.05, 0.36]), vary: 0.06 });
  k.add(beam([-e, 0.05, e + 0.02], [0, 1.1, e + 0.02], 0.04, POLE), beam([0, 1.1, e + 0.02], [e, 2.2, e + 0.02], 0.04, POLE));
  k.add(beam([-e - 0.02, 0.05, e], [-e - 0.02, 1.1, 0], 0.04, POLE), beam([e + 0.02, 1.1, -e], [e + 0.02, 2.2, 0], 0.04, POLE));
  // safety netting strip + hazard band
  k.hazard(-e, e, 0.5, e + 0.03, 0.14, 12, 0.02);
  // tower crane (back-left) with a spinning jib
  const cx = -1.35;
  const cz = -1.35;
  const MH = 4.4;
  k.box(C.concrete, [cx, 0.12, cz], [0.7, 0.24, 0.7]);
  k.add({ geom: LATTICE, color: C.yellow, pos: [cx, MH / 2, cz], scale: [0.26, MH, 0.26], faceColor: (_x, y) => (Math.floor((y + 0.5) * 12) % 2 ? 0xd9a000 : C.yellow) });
  const jib: Part[] = [
    bx(C.yellow, [1.0, 0.1, 0], [2.8, 0.16, 0.18]),
    bx(C.yellow, [-0.7, 0.1, 0], [1.0, 0.16, 0.18]),
    bx(C.concreteDark, [-1.05, -0.05, 0], [0.34, 0.34, 0.3]),
    bx(C.yellow, [0, 0.45, 0], [0.12, 0.6, 0.12]),
    beam([0, 0.75, 0], [2.3, 0.18, 0], 0.03, C.gunmetal),
    beam([0, 0.75, 0], [-1.0, 0.18, 0], 0.03, C.gunmetal),
    { geom: rbox(0.36, 0.34, 0.36, 0.04), color: C.offWhite, pos: [0.15, -0.12, 0.22] },
    bx(C.glass, [0.15, -0.1, 0.405], [0.28, 0.16, 0.02]),
    rod([1.9, 0.02, 0], [1.9, -1.6, 0], 0.012, C.black, P.cyl4),
    bx(C.gunmetal, [1.9, -1.64, 0], [0.12, 0.1, 0.12]),
    bx(C.woodLight, [1.9, -1.78, 0], [0.6, 0.06, 0.6]),
    { ...bx(C.brick, [1.9, -1.64, 0], [0.5, 0.22, 0.5]), vary: 0.08 },
  ];
  k.spin(jib, [cx, MH, cz], 'y', 0.25);
  k.prop('cone', [-0.6, 0, e + 0.45], 0, 0.8).prop('cone', [0.6, 0, e + 0.45], 0, 0.8);
  // warning sign
  k.box(C.gunmetal, [1.2, 0.35, e + 0.4], [0.05, 0.7, 0.05]);
  k.add(...group([{ geom: extrudeXY([[-0.3, -0.26], [0.3, -0.26], [0, 0.26]], 0.04), color: C.hazard }, bx(C.black, [0, -0.02, 0.025], [0.06, 0.24, 0.01])], [1.2, 0.85, e + 0.43]));
  return k.done();
}
