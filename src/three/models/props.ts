// OWNER: art agent. Environment props, pickups, FX meshes, flags, plots and resource nodes.
import * as THREE from 'three';
import type { ResourceId } from '../../core/types';
import {
  P,
  beam,
  buildColored,
  bx,
  extrudeXY,
  frustum,
  group,
  hull,
  lathe,
  rbox,
  rod,
  stripesAround,
  sym,
  vcMesh,
  type Part,
  type V2,
  type V3,
} from './builder';
import { cached } from './cache';
import { C } from './palette';

export type PropKind =
  | 'barrel'
  | 'crate'
  | 'tree'
  | 'pine'
  | 'rock'
  | 'car_wreck'
  | 'fence'
  | 'sandbag'
  | 'lamp'
  | 'cone'
  // extras
  | 'tire'
  | 'roadblock'
  | 'bush'
  | 'ruin'
  | 'tent'
  | 'hedgehog'
  | 'container'
  | 'grass'
  | 'ammo_crate'
  | 'barrier';

/** Every prop kind (handy for random scatter and the gallery). */
export const PROP_KINDS: PropKind[] = [
  'barrel',
  'crate',
  'tree',
  'pine',
  'rock',
  'car_wreck',
  'fence',
  'sandbag',
  'lamp',
  'cone',
  'tire',
  'roadblock',
  'bush',
  'ruin',
  'tent',
  'hedgehog',
  'container',
  'grass',
  'ammo_crate',
  'barrier',
];

const PILLOW = rbox(1, 1, 1, 0.3);
const STRIPE_BOARD = new THREE.BoxGeometry(1, 1, 1, 8, 1, 1);
const RIBBED = new THREE.BoxGeometry(1, 1, 1, 1, 1, 12);

/** Deterministic pseudo-random generator. */
export function rng(seed: number): () => number {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Irregular rock hull, base flat at y=0. */
export function rockGeom(seed: number, n = 11): THREE.BufferGeometry {
  const r = rng(seed * 7919 + 13);
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + r() * 0.5;
    const ph = 0.25 + r() * 1.1;
    const rad = 0.42 + r() * 0.16;
    pts.push([Math.cos(th) * Math.sin(ph) * rad, Math.max(0, Math.cos(ph) * rad * 0.9), Math.sin(th) * Math.sin(ph) * rad]);
  }
  pts.push([0, 0.46 + r() * 0.1, 0]);
  for (let i = 0; i < 6; i++) {
    const th = (i / 6) * Math.PI * 2 + r();
    pts.push([Math.cos(th) * 0.45, 0, Math.sin(th) * 0.45]);
  }
  return hull(pts);
}

/** Environment prop geometry (cached, vertex-coloured, origin at ground centre). */
export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  return cached('prop_' + kind, () => buildColored(propParts(kind)));
}

function crateParts(body: number, frame: number, s = 0.9): Part[] {
  const h = s / 2;
  const e = 0.09;
  const parts: Part[] = [bx(body, [0, h, 0], [s - 0.02, s - 0.02, s - 0.02])];
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      parts.push(bx(frame, [a * (h - e / 2), h, b * (h - e / 2)], [e, s, e]));
      parts.push(bx(frame, [0, h + a * (h - e / 2), b * (h - e / 2)], [s, e, e]));
      parts.push(bx(frame, [a * (h - e / 2), h + b * (h - e / 2), 0], [e, e, s]));
    }
  return parts;
}

function propParts(kind: PropKind): Part[] {
  switch (kind) {
    case 'barrel':
      return [
        { geom: P.cyl12, color: C.red, pos: [0, 0.475, 0], scale: [0.66, 0.95, 0.66] },
        { geom: P.cyl12, color: C.redDark, pos: [0, 0.2, 0], scale: [0.69, 0.05, 0.69] },
        { geom: P.cyl12, color: C.redDark, pos: [0, 0.76, 0], scale: [0.69, 0.05, 0.69] },
        { geom: P.cyl12, color: C.hazard, pos: [0, 0.48, 0], scale: [0.675, 0.22, 0.675], faceColor: stripesAround(12, C.black, C.hazard) },
        { geom: P.cyl12, color: C.redDark, pos: [0, 0.955, 0], scale: [0.54, 0.02, 0.54] },
        { geom: P.cyl6, color: C.steel, pos: [0.14, 0.975, 0.06], scale: [0.1, 0.04, 0.1] },
      ];
    case 'crate':
      return [
        ...crateParts(C.woodLight, C.woodDark),
        beam([-0.36, 0.1, 0.455], [0.36, 0.8, 0.455], 0.09, C.wood, 0.03),
        beam([0.455, 0.1, -0.36], [0.455, 0.8, 0.36], 0.03, C.wood, 0.09),
        beam([-0.36, 0.1, -0.455], [0.36, 0.8, -0.455], 0.09, C.wood, 0.03),
        beam([-0.455, 0.1, -0.36], [-0.455, 0.8, 0.36], 0.03, C.wood, 0.09),
      ];
    case 'ammo_crate':
      return [
        { geom: rbox(1.0, 0.55, 0.62, 0.05), color: C.armyGreen, pos: [0, 0.3, 0] },
        bx(C.oliveDark, [0, 0.58, 0], [1.02, 0.06, 0.64]),
        bx(C.hazard, [0, 0.33, 0.315], [0.5, 0.12, 0.02]),
        bx(C.hazard, [0, 0.33, -0.315], [0.5, 0.12, 0.02]),
        ...sym(bx(C.gunmetal, [0.45, 0.35, 0], [0.12, 0.08, 0.3]), bx(C.steelDark, [0.3, 0.62, 0], [0.06, 0.04, 0.4])),
      ];
    case 'tree':
      return [
        { geom: frustum(0.09, 0.15, 6), color: C.bark, pos: [0, 0.55, 0], scale: [1, 1.1, 1] },
        beam([0, 0.8, 0], [0.3, 1.15, 0.1], 0.08, C.bark),
        { geom: P.sphere, color: C.leaf, pos: [0, 1.6, 0], scale: [1.35, 1.2, 1.35], vary: 0.1 },
        { geom: P.sphere, color: C.leafLight, pos: [0.42, 1.35, 0.22], scale: [0.85, 0.8, 0.85], vary: 0.1 },
        { geom: P.sphere, color: C.leafDark, pos: [-0.38, 1.3, -0.25], scale: [0.95, 0.85, 0.95], vary: 0.1 },
      ];
    case 'pine':
      return [
        { geom: frustum(0.08, 0.13, 6), color: C.bark, pos: [0, 0.3, 0], scale: [1, 0.6, 1] },
        { geom: P.cone, color: C.pineDark, pos: [0, 0.85, 0], scale: [1.35, 1.0, 1.35], vary: 0.07 },
        { geom: P.cone, color: C.pine, pos: [0, 1.4, 0], scale: [1.05, 0.9, 1.05], vary: 0.07, rot: [0, 0.4, 0] },
        { geom: P.cone, color: 0x3a9259, pos: [0, 1.9, 0], scale: [0.72, 0.8, 0.72], vary: 0.07 },
      ];
    case 'rock':
      return [
        { geom: rockGeom(1), color: C.stone, pos: [0, 0, 0], scale: [1.3, 0.9, 1.1], vary: 0.09 },
        { geom: rockGeom(2), color: C.stoneDark, pos: [0.55, 0, 0.35], scale: [0.55, 0.45, 0.5], rot: [0, 1, 0], vary: 0.09 },
      ];
    case 'car_wreck': {
      const body = 0x5f9ea3;
      const rust = 0xa55a2c;
      const glass = 0x2b4552;
      const car: Part[] = [
        { geom: rbox(1.6, 0.5, 3.1, 0.12), color: body, pos: [0, 0.45, 0], vary: 0.05 },
        {
          geom: hull([
            [-0.75, 0.7, -0.9],
            [0.75, 0.7, -0.9],
            [-0.75, 0.7, 0.55],
            [0.75, 0.7, 0.55],
            [-0.62, 1.12, -0.6],
            [0.62, 1.12, -0.6],
            [-0.62, 1.12, 0.25],
            [0.62, 1.12, 0.25],
          ]),
          color: body,
        },
        {
          geom: hull([
            [-0.72, 0.82, -0.82],
            [0.72, 0.82, -0.82],
            [-0.72, 0.82, 0.47],
            [0.72, 0.82, 0.47],
            [-0.655, 1.04, -0.67],
            [0.655, 1.04, -0.67],
            [-0.655, 1.04, 0.32],
            [0.655, 1.04, 0.32],
          ]),
          color: glass,
        },
        bx(body, [0, 0.82, 1.1], [1.45, 0.05, 0.85], [-0.3, 0, 0]),
        bx(rust, [0.3, 0.845, 1.12], [0.5, 0.02, 0.4], [-0.3, 0, 0]),
        bx(rust, [0.805, 0.45, -0.7], [0.02, 0.26, 0.8]),
        bx(rust, [-0.3, 1.125, -0.2], [0.5, 0.02, 0.45]),
        bx(C.gunmetal, [0, 0.35, 1.58], [1.5, 0.14, 0.08]),
        bx(C.gunmetal, [0, 0.35, -1.58], [1.5, 0.14, 0.08]),
        ...sym(bx(C.black, [0.55, 0.52, 1.555], [0.22, 0.1, 0.02])),
        ...[
          [0.72, 1.0],
          [-0.72, 1.0],
          [0.72, -1.0],
        ].map(([x, z]): Part => ({ geom: P.cyl, color: C.rubber, pos: [x, 0.2, z], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.2, 0.42] })),
      ];
      return group(car, [0, 0, 0], [0, 0, -0.07]);
    }
    case 'fence':
      return [
        ...[-0.95, 0, 0.95].map((x) => bx(C.woodDark, [x, 0.45, 0], [0.12, 0.9, 0.12])),
        { ...bx(C.wood, [0, 0.66, 0.07], [2.0, 0.12, 0.04]), vary: 0.08 },
        { ...bx(C.wood, [0, 0.3, 0.07], [2.0, 0.12, 0.04]), vary: 0.08 },
        rod([-1.0, 0.95, 0], [1.0, 0.95, 0], 0.012, C.gunmetal, P.cyl4),
        ...[-0.95, 0, 0.95].map((x) => ({ ...bx(C.woodDark, [x, 0.92, 0], [0.16, 0.05, 0.16]) })),
      ];
    case 'sandbag': {
      const cols = [0xcdb67e, 0xc2a96f, 0xd8c28a];
      const parts: Part[] = [];
      [-0.72, -0.24, 0.24, 0.72].forEach((x, i) =>
        parts.push({ geom: PILLOW, color: cols[i % 3], pos: [x, 0.13, 0], scale: [0.5, 0.26, 0.44], rot: [0, (i % 2 ? 1 : -1) * 0.06, 0] }),
      );
      [-0.48, 0, 0.48].forEach((x, i) =>
        parts.push({ geom: PILLOW, color: cols[(i + 1) % 3], pos: [x, 0.37, 0.02], scale: [0.5, 0.25, 0.42], rot: [0, (i % 2 ? -1 : 1) * 0.08, 0] }),
      );
      [-0.24, 0.24].forEach((x, i) => parts.push({ geom: PILLOW, color: cols[(i + 2) % 3], pos: [x, 0.6, 0.03], scale: [0.48, 0.24, 0.4] }));
      return parts;
    }
    case 'lamp':
      return [
        { geom: P.cyl6, color: C.gunmetal, pos: [0, 0.12, 0], scale: [0.32, 0.24, 0.32] },
        { geom: frustum(0.045, 0.07, 6), color: C.steelDark, pos: [0, 1.5, 0], scale: [1, 2.8, 1] },
        beam([0, 2.75, 0], [0, 2.9, 0.45], 0.06, C.steelDark),
        bx(C.gunmetal, [0, 2.82, 0.5], [0.3, 0.06, 0.3]),
        { geom: P.chamfer, color: 0xffe98a, pos: [0, 2.68, 0.5], scale: [0.22, 0.22, 0.22] },
        { geom: P.cone4, color: C.gunmetal, pos: [0, 2.94, 0.5], rot: [0, Math.PI / 4, 0], scale: [0.36, 0.18, 0.36] },
        bx(C.gunmetal, [0, 2.55, 0.5], [0.24, 0.04, 0.24]),
      ];
    case 'cone':
      return [
        bx(C.black, [0, 0.025, 0], [0.42, 0.05, 0.42]),
        { geom: frustum(0.114, 0.18, 8), color: C.orange, pos: [0, 0.2, 0], scale: [1, 0.3, 1] },
        { geom: frustum(0.083, 0.114, 8), color: C.white, pos: [0, 0.42, 0], scale: [1, 0.14, 1] },
        { geom: frustum(0.035, 0.083, 8), color: C.orange, pos: [0, 0.6, 0], scale: [1, 0.22, 1] },
      ];
    case 'tire':
      return [
        { geom: P.torus, color: C.rubber, pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0], scale: [0.8, 0.8, 0.8] },
        { geom: P.torus, color: 0x33363b, pos: [0.06, 0.36, -0.04], rot: [Math.PI / 2 + 0.05, 0, 0.1], scale: [0.8, 0.8, 0.8] },
      ];
    case 'roadblock':
      return [
        {
          geom: STRIPE_BOARD,
          color: C.white,
          pos: [0, 0.78, 0],
          scale: [2.0, 0.26, 0.06],
          faceColor: (x) => (Math.floor((x + 0.5) * 8) % 2 ? C.white : C.red),
        },
        ...sym(
          beam([0.85, 0, 0.3], [0.85, 0.9, 0], 0.07, C.gunmetal),
          beam([0.85, 0, -0.3], [0.85, 0.9, 0], 0.07, C.gunmetal),
          bx(C.gunmetal, [0.85, 0.38, 0], [0.06, 0.05, 0.4]),
        ),
        bx(C.gunmetal, [0.85, 0.95, 0], [0.12, 0.08, 0.12]),
        { geom: P.hemi, color: C.orange, pos: [0.85, 0.99, 0], scale: [0.18, 0.2, 0.18] },
      ];
    case 'bush':
      return [
        { geom: P.sphere, color: C.leaf, pos: [0, 0.3, 0], scale: [0.9, 0.62, 0.9], vary: 0.1 },
        { geom: P.sphere, color: C.leafLight, pos: [0.4, 0.22, 0.15], scale: [0.62, 0.45, 0.62], vary: 0.1 },
        { geom: P.sphere, color: C.leafDark, pos: [-0.38, 0.2, -0.1], scale: [0.65, 0.42, 0.62], vary: 0.1 },
      ];
    case 'ruin': {
      const r = rng(77);
      const parts: Part[] = [];
      for (let i = 0; i < 6; i++) {
        const h = 0.5 + r() * 1.3 * (1 - Math.abs(i - 1.5) / 4);
        parts.push({ geom: P.box, color: i % 2 ? C.concrete : C.concreteLight, pos: [-1.1 + i * 0.36, h / 2, 0], scale: [0.37, h, 0.28], vary: 0.06 });
      }
      for (let i = 0; i < 3; i++) {
        const h = 0.4 + r() * 0.8;
        parts.push({ geom: P.box, color: C.concrete, pos: [-1.1, h / 2, 0.35 + i * 0.34], scale: [0.28, h, 0.35], vary: 0.06 });
      }
      parts.push(
        bx(C.brick, [-0.4, 0.7, 0.145], [0.6, 0.3, 0.02]),
        { geom: P.chamfer, color: C.concreteDark, pos: [0.4, 0.14, 0.7], rot: [0.1, 0.5, 0.25], scale: [1.1, 0.16, 0.6], vary: 0.08 },
        rod([0.6, 0.9, 0], [0.7, 1.4, 0.05], 0.02, C.zRust, P.cyl4),
        rod([0.25, 1.2, 0], [0.2, 1.65, -0.1], 0.02, C.zRust, P.cyl4),
        { geom: rockGeom(5), color: C.concreteDark, pos: [0.9, 0, 0.5], scale: [0.5, 0.35, 0.5], vary: 0.1 },
        { geom: rockGeom(6), color: C.concrete, pos: [-0.2, 0, 0.6], scale: [0.4, 0.3, 0.4], vary: 0.1 },
      );
      return parts;
    }
    case 'tent':
      return [
        { geom: P.roof, color: C.armyGreen, pos: [0, 0.6, 0], scale: [1.8, 1.2, 2.2], vary: 0.04 },
        { geom: P.roof, color: 0x2f4a22, pos: [0, 0.4, 1.1], scale: [0.7, 0.8, 0.04] },
        { geom: P.roof, color: C.oliveDark, pos: [0.22, 0.4, 1.12], rot: [0, -0.5, 0], scale: [0.4, 0.8, 0.03] },
        rod([0, 1.2, -1.2], [0, 1.2, 1.2], 0.03, C.woodDark, P.cyl4),
        ...sym(beam([0.9, 0.02, 1.4], [0, 1.2, 1.12], 0.015, C.offWhite), beam([0.9, 0.02, -1.4], [0, 1.2, -1.12], 0.015, C.offWhite)),
      ];
    case 'hedgehog': {
      const c = 0x6d6259;
      return [
        beam([-0.6, 0.02, -0.35], [0.6, 0.95, 0.35], 0.12, c, 0.12),
        beam([0.6, 0.02, -0.35], [-0.6, 0.95, 0.35], 0.12, c, 0.12),
        beam([0, 0.02, 0.7], [0, 0.95, -0.7], 0.12, c, 0.12),
        { ...bx(C.zRust, [0, 0.49, 0], [0.2, 0.2, 0.2]), vary: 0.1 },
      ];
    }
    case 'container': {
      const c = 0xd9572b;
      return [
        {
          geom: RIBBED,
          color: c,
          pos: [0, 0.62, 0],
          scale: [1.2, 1.2, 2.6],
          faceColor: (x, _y, z) => (Math.abs(x) > 0.49 && Math.floor((z + 0.5) * 12) % 2 ? 0xc24a22 : c),
        },
        bx(0xbf4520, [0, 1.235, 0], [1.24, 0.03, 2.64]),
        bx(0xbf4520, [0, 0.03, 0], [1.24, 0.06, 2.64]),
        ...sym(bx(C.gunmetal, [0.25, 0.62, 1.305], [0.03, 1.0, 0.02]), bx(C.gunmetal, [0.4, 0.62, 1.305], [0.03, 1.0, 0.02])),
        bx(C.white, [0, 0.95, -1.305], [0.8, 0.14, 0.02]),
      ];
    }
    case 'grass':
      return [
        { geom: P.cone4, color: C.grass, pos: [0, 0.16, 0], scale: [0.1, 0.32, 0.1] },
        { geom: P.cone4, color: C.leafLight, pos: [0.08, 0.12, 0.05], rot: [0.2, 0, -0.3], scale: [0.08, 0.26, 0.08] },
        { geom: P.cone4, color: C.leaf, pos: [-0.08, 0.13, 0.03], rot: [0, 0, 0.35], scale: [0.08, 0.28, 0.08] },
        { geom: P.cone4, color: C.leafDark, pos: [0.02, 0.11, -0.08], rot: [-0.35, 0, 0], scale: [0.08, 0.24, 0.08] },
        { geom: P.cone4, color: C.grass, pos: [-0.05, 0.1, -0.06], rot: [-0.2, 0, 0.3], scale: [0.07, 0.2, 0.07] },
      ];
    case 'barrier':
      return [
        {
          geom: hull([
            [-1, 0, -0.32],
            [1, 0, -0.32],
            [-1, 0, 0.32],
            [1, 0, 0.32],
            [-1, 0.2, -0.3],
            [1, 0.2, -0.3],
            [-1, 0.2, 0.3],
            [1, 0.2, 0.3],
            [-1, 0.75, -0.1],
            [1, 0.75, -0.1],
            [-1, 0.75, 0.1],
            [1, 0.75, 0.1],
          ]),
          color: C.concreteLight,
          vary: 0.04,
        },
        ...[-0.6, 0, 0.6].map((x) => bx(x === 0 ? C.hazard : C.red, [x, 0.5, 0.19], [0.3, 0.1, 0.02], [-0.37, 0, 0])),
        ...[-0.6, 0, 0.6].map((x) => bx(x === 0 ? C.hazard : C.red, [x, 0.5, -0.19], [0.3, 0.1, 0.02], [0.37, 0, 0])),
      ];
  }
}

// =============================================================================================
// Runner / FX / pickups

/** Runner gate frame post (~3 m tall, neutral steel/white, lamp on top). Place one each side of a gate panel. */
export function gatePostGeometry(): THREE.BufferGeometry {
  return cached('gatePost', () =>
    buildColored([
      { geom: rbox(0.62, 0.26, 0.62, 0.05), color: C.steelDark, pos: [0, 0.13, 0] },
      { geom: rbox(0.36, 2.44, 0.36, 0.07), color: 0xe9eef3, pos: [0, 1.48, 0] },
      bx(C.steelDark, [0, 0.52, 0], [0.39, 0.1, 0.39]),
      bx(C.steelDark, [0, 2.42, 0], [0.39, 0.1, 0.39]),
      ...[0.8, 1.2, 1.6, 2.0].map((y) => bx(C.hazard, [0, y, 0], [0.37, 0.12, 0.37], [0, 0, 0])),
      { geom: rbox(0.48, 0.2, 0.48, 0.05), color: C.steelDark, pos: [0, 2.78, 0] },
      { geom: P.ball, color: C.glowWhite, pos: [0, 2.98, 0], scale: [0.26, 0.26, 0.26] },
    ]),
  );
}

/** Small bright tracer round, ~0.5 m long along +Z, centred at the origin. Best with vcGlowMaterial(). */
export function bulletGeometry(): THREE.BufferGeometry {
  return cached('bullet', () =>
    buildColored([
      { geom: P.octa, color: C.glowWhite, pos: [0, 0, 0.1], scale: [0.1, 0.1, 0.28] },
      { geom: P.cone4, color: 0xffc040, pos: [0, 0, -0.12], rot: [-Math.PI / 2, 0, 0], scale: [0.08, 0.36, 0.08] },
    ]),
  );
}

/** Muzzle flash burst pointing +Z (origin = muzzle, ~0.6 m long). Best with vcGlowMaterial(); scale/flicker per shot. */
export function muzzleFlashGeometry(): THREE.BufferGeometry {
  return cached('muzzleFlash', () => {
    const parts: Part[] = [
      { geom: P.octa, color: C.glowWhite, pos: [0, 0, 0.1], scale: [0.2, 0.2, 0.26] },
      { geom: P.cone4, color: C.glowYellow, pos: [0, 0, 0.36], rot: [Math.PI / 2, 0, 0], scale: [0.16, 0.44, 0.16] },
    ];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const d = new THREE.Vector3(Math.cos(a), Math.sin(a), 0.9).normalize().multiplyScalar(0.34);
      parts.push(beam([0, 0, 0.06], [d.x, d.y, d.z + 0.06], 0.1, C.glowOrange, 0.1, P.cone4));
    }
    return buildColored(parts);
  });
}

function starPts(n: number, ro: number, ri: number): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? ri : ro;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}
const STAR = extrudeXY(starPts(5, 0.16, 0.07), 0.14);

/** Gold coin pickup (radius 0.3), standing upright facing +Z, CENTRED at the origin (spin it around Y). */
export function coinGeometry(): THREE.BufferGeometry {
  return cached('coin', () =>
    buildColored([
      { geom: P.cyl16, color: C.goldDark, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], scale: [0.6, 0.1, 0.6] },
      { geom: P.cyl16, color: C.gold, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], scale: [0.5, 0.12, 0.5] },
      { geom: STAR, color: C.goldLight, pos: [0, 0, 0], scale: [1, 1, 1] },
    ]),
  );
}

/** Diamond gem pickup (~0.5 m), CENTRED at the origin; faceted light/dark blue for sparkle. */
export function gemGeometry(): THREE.BufferGeometry {
  return cached('gem', () =>
    buildColored([
      {
        geom: lathe(
          [
            [0, -0.28],
            [0.26, 0.02],
            [0.2, 0.16],
            [0, 0.16],
          ],
          8,
        ),
        color: 0x49c8ff,
        faceColor: (x, y, z) => {
          const band = y < 0 ? 0 : y < 0.09 ? 1 : 2;
          const k = (Math.floor(((Math.atan2(z, x) / (Math.PI * 2) + 1) * 8) % 8) + band) % 2;
          return band === 2 ? 0xc8f4ff : k ? 0x8fe3ff : 0x2a9cef;
        },
      },
    ]),
  );
}

// =============================================================================================
// Flags

const flagClothCache = new Map<number, THREE.BufferGeometry>();
/** Flag cloth geometry (hinged at x=0, top at y=0 going down 0.55, waving in 3 folds toward +X). */
export function flagClothGeometry(color: THREE.ColorRepresentation, w = 1.0, h = 0.55): THREE.BufferGeometry {
  const hex = new THREE.Color(color).getHex() ^ Math.round(w * 1000) ^ Math.round(h * 100000);
  let g = flagClothCache.get(hex);
  if (!g) {
    const parts: Part[] = [];
    const n = 3;
    const L = w / n;
    let x = 0,
      z = 0;
    const base = new THREE.Color(color);
    const dark = base.clone().multiplyScalar(0.82);
    for (let i = 0; i < n; i++) {
      const a = (i % 2 ? -1 : 1) * 0.35;
      const nx = x + Math.cos(a) * L;
      const nz = z - Math.sin(a) * L;
      parts.push({ geom: P.box, color: i % 2 ? dark : base, pos: [(x + nx) / 2, -h / 2, (z + nz) / 2], rot: [0, a, 0], scale: [L + 0.02, h, 0.03] });
      x = nx;
      z = nz;
    }
    g = buildColored(parts);
    flagClothCache.set(hex, g);
  }
  return g;
}

/** Flag on a pole (~2.6 m) with a waving cloth child named 'cloth' (userData.wave; see animateModel). */
export function flagModel(color: THREE.ColorRepresentation = C.blue): THREE.Group {
  const g = new THREE.Group();
  g.add(
    vcMesh(
      cached('flagPole', () =>
        buildColored([
          { geom: P.cyl6, color: C.concreteDark, pos: [0, 0.08, 0], scale: [0.3, 0.16, 0.3] },
          { geom: P.cyl6, color: C.steelLight, pos: [0, 1.35, 0], scale: [0.06, 2.6, 0.06] },
          { geom: P.ball, color: C.gold, pos: [0, 2.68, 0], scale: [0.12, 0.12, 0.12] },
        ]),
      ),
    ),
  );
  const cloth = vcMesh(flagClothGeometry(color));
  cloth.name = 'cloth';
  cloth.position.set(0.03, 2.58, 0);
  cloth.userData.wave = true;
  cloth.userData.phase = Math.random() * 6;
  g.add(cloth);
  return g;
}

/** Small flag parts (pole + cloth) for merging into static models. Cloth faces +X. */
export function smallFlagParts(pos: V3, color: THREE.ColorRepresentation, poleH = 1.4, clothW = 0.55): Part[] {
  const [x, y, z] = pos;
  return [
    { geom: P.cyl6, color: C.steelLight, pos: [x, y + poleH / 2, z], scale: [0.04, poleH, 0.04] },
    { geom: P.ball, color: C.gold, pos: [x, y + poleH + 0.03, z], scale: [0.07, 0.07, 0.07] },
    { geom: flagClothGeometry(color, clothW, clothW * 0.58), pos: [x + 0.02, y + poleH - 0.04, z] },
  ];
}

// =============================================================================================
// Base plots & world resource nodes

/** Empty building plot (~3.4 x 3.4 cleared dirt lot with kerbs and corner stakes). */
export function emptyPlotGeometry(): THREE.BufferGeometry {
  return cached('emptyPlot', () => {
    const parts: Part[] = [{ geom: rbox(3.4, 0.08, 3.4, 0.03), color: C.dirt, pos: [0, 0.04, 0] }];
    for (const s of [-1, 1]) {
      parts.push({ ...bx(C.concreteLight, [s * 1.66, 0.07, 0], [0.12, 0.14, 3.44]), vary: 0.03 });
      parts.push({ ...bx(C.concreteLight, [0, 0.07, s * 1.66], [3.2, 0.14, 0.12]), vary: 0.03 });
    }
    const r = rng(3);
    for (let i = 0; i < 7; i++)
      parts.push({ geom: P.dodeca, color: i % 2 ? C.dirtDark : C.sandDark, pos: [(r() - 0.5) * 2.6, 0.08, (r() - 0.5) * 2.6], scale: [0.18, 0.1, 0.18] });
    for (const a of [-1, 1])
      for (const b of [-1, 1]) {
        parts.push(bx(C.woodLight, [a * 1.45, 0.3, b * 1.45], [0.07, 0.5, 0.07]));
        parts.push(bx(C.orange, [a * 1.45 + 0.08, 0.48, b * 1.45], [0.14, 0.09, 0.02]));
      }
    return buildColored(parts);
  });
}

/** World-map resource node (~2.4 m across): food = hay & crops, iron = rusty ore rocks, gold = gold-veined rocks. */
export function resourceNodeGeometry(kind: ResourceId): THREE.BufferGeometry {
  return cached('resnode_' + kind, () => {
    const parts: Part[] = [];
    const r = rng(kind.length * 31);
    if (kind === 'food') {
      parts.push({ geom: P.cyl12, color: C.soil, pos: [0, 0.04, 0], scale: [2.4, 0.08, 2.2] });
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++)
          parts.push({ geom: P.cone4, color: (i + j) % 2 ? C.wheat : 0xe0b43a, pos: [-0.6 + i * 0.4, 0.25, -0.75 + j * 0.3], scale: [0.2, 0.42, 0.2], rot: [0, r(), 0] });
      parts.push(
        { geom: P.cyl, color: C.straw, pos: [-0.35, 0.28, 0.5], rot: [0, 0.3, Math.PI / 2], scale: [0.55, 0.62, 0.55], vary: 0.05 },
        { geom: P.cyl, color: 0xd9b650, pos: [0.3, 0.28, 0.6], rot: [0, -0.2, Math.PI / 2], scale: [0.55, 0.62, 0.55], vary: 0.05 },
        { geom: P.cyl, color: C.straw, pos: [0, 0.74, 0.55], rot: [0, 0.05, Math.PI / 2], scale: [0.55, 0.62, 0.55], vary: 0.05 },
        ...group(crateParts(C.woodLight, C.woodDark, 0.5), [0.75, 0.05, -0.1], [0, 0.4, 0]),
      );
      for (let i = 0; i < 5; i++)
        parts.push({ geom: P.sphereLow, color: i % 2 ? C.red : C.orange, pos: [0.75 + (r() - 0.5) * 0.3, 0.6, -0.1 + (r() - 0.5) * 0.3], scale: [0.14, 0.14, 0.14] });
    } else {
      const gold = kind === 'gold';
      const rock = gold ? 0xa88a62 : C.stone;
      const rockD = gold ? 0x8a6d48 : C.stoneDark;
      const ore = gold ? C.gold : 0xc0602a;
      const oreL = gold ? C.goldLight : 0xd98040;
      parts.push(
        { geom: rockGeom(11), color: rock, pos: [0, 0, 0], scale: [1.6, 1.3, 1.4], vary: 0.08 },
        { geom: rockGeom(12), color: rockD, pos: [0.8, 0, 0.5], scale: [0.9, 0.7, 0.8], vary: 0.08 },
        { geom: rockGeom(13), color: rock, pos: [-0.8, 0, 0.4], scale: [0.8, 0.6, 0.9], vary: 0.08 },
      );
      for (let i = 0; i < (gold ? 13 : 9); i++) {
        const a = r() * Math.PI * 2;
        const d = 0.4 + r() * 0.6;
        parts.push({
          geom: gold ? P.octa : P.dodeca,
          color: i % 2 ? ore : oreL,
          pos: [Math.cos(a) * d, 0.1 + r() * (1.1 - d * 0.8), Math.sin(a) * d * 0.9 + 0.1],
          rot: [r() * 3, r() * 3, r() * 3],
          scale: [0.22 + r() * 0.14, 0.22 + r() * 0.14, 0.22 + r() * 0.14].map((v) => v * (gold ? 1.35 : 1)) as V3,
          vary: 0.15,
        });
      }
    }
    return buildColored(parts);
  });
}
