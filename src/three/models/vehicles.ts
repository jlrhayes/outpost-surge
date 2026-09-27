// OWNER: art agent. Hero war machines: tank, aircraft, missile truck. Rarity drives trim + extra kit.
import * as THREE from 'three';
import type { HeroType, Rarity } from '../../core/types';
import { P, beam, blobShadow, buildColored, bx, frustum, group, hull, lathe, plateYZ, rbox, rod, slab, sym, type Part } from './builder';
import { cached, modelFromSpec, type ModelSpec } from './cache';
import { C, rarityColor } from './palette';

const TRACK = new THREE.BoxGeometry(1, 1, 1, 1, 1, 14);
const treads = (_x: number, _y: number, z: number) => (Math.floor((z + 0.5) * 14) % 2 ? 0x2b2e33 : 0x3f434a);

/** Height of the aircraft's centreline above its origin (it hovers so battle scenes read as flying). */
export const AIRCRAFT_HOVER = 1.4;

/**
 * Hero war machine for battles/world marches, facing +Z. Rarity tints the trim (SR blue, SSR purple, UR gold);
 * SSR adds extra kit, UR is the fanciest (armour, antennae, pennants, gold stripes).
 * Children: 'body', optional 'glow' (lights/engine flame), aircraft also has 'blobShadow' on the ground.
 */
export function vehicleModel(type: HeroType, rarity: Rarity = 'SR'): THREE.Group {
  if (type === 'tank') return modelFromSpec('veh_tank_' + rarity, () => tankSpec(rarity));
  if (type === 'aircraft') {
    const g = modelFromSpec('veh_air_' + rarity, () => aircraftSpec(rarity));
    g.add(blobShadow(rarity === 'UR' ? 1.25 : 1.1));
    return g;
  }
  return modelFromSpec('veh_missile_' + rarity, () => missileSpec(rarity));
}

/**
 * Single merged geometry of a vehicle (body + lights, no blob shadow), facing +Z, origin at ground centre.
 * Aircraft geometry includes its hover height. For InstancedMesh marches or merging into other models.
 */
export function vehicleGeometry(type: HeroType, rarity: Rarity = 'SR'): THREE.BufferGeometry {
  return cached(`vehgeo_${type}_${rarity}`, () => {
    const s = type === 'tank' ? tankSpec(rarity) : type === 'aircraft' ? aircraftSpec(rarity) : missileSpec(rarity);
    return buildColored([...s.parts, ...(s.glow ?? [])]);
  });
}

// ---------------------------------------------------------------------------------------------

function chevron(trim: number, y: number, z: number, size = 1, x0 = 0.1): Part[] {
  return sym(bx(trim, [x0 * size, y, z], [0.08 * size, 0.025, 0.34 * size], [0, -0.75, 0]));
}

function tankSpec(r: Rarity): ModelSpec {
  const trim = rarityColor(r);
  const ur = r === 'UR';
  const ssr = r !== 'SR';
  const body = C.olive;
  const bodyL = C.oliveLight;
  const bodyD = C.oliveDark;
  const tz = -0.15; // turret centre z
  const parts: Part[] = [
    // running gear
    ...sym(
      { geom: TRACK, color: C.rubber, pos: [0.72, 0.3, 0], scale: [0.36, 0.5, 2.5], faceColor: treads },
      { geom: P.cyl6, color: C.rubber, pos: [0.72, 0.3, 1.25], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.36, 0.5] },
      { geom: P.cyl6, color: C.rubber, pos: [0.72, 0.3, -1.25], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.36, 0.5] },
      ...[-0.9, -0.45, 0, 0.45, 0.9].map((z): Part => ({ geom: P.cyl6, color: 0x6a7079, pos: [0.915, 0.27, z], rot: [0, 0, Math.PI / 2], scale: [0.36, 0.05, 0.36] })),
      { geom: P.cyl, color: C.steelDark, pos: [0.915, 0.34, 1.25], rot: [0, 0, Math.PI / 2], scale: [0.3, 0.06, 0.3] },
      bx(bodyD, [0.72, 0.585, 0.02], [0.46, 0.06, 2.62]),
      bx(trim, [0.72, 0.6, 1.3], [0.46, 0.07, 0.1]),
      bx(bodyD, [0.74, 0.68, -0.65], [0.3, 0.14, 0.55]),
    ),
    // hull
    bx(bodyD, [0, 0.4, 0], [1.08, 0.4, 2.3]),
    {
      geom: hull([
        [-0.8, 0.55, -1.25],
        [0.8, 0.55, -1.25],
        [-0.8, 0.55, 1.32],
        [0.8, 0.55, 1.32],
        [-0.74, 0.82, -1.12],
        [0.74, 0.82, -1.12],
        [-0.74, 0.82, 0.62],
        [0.74, 0.82, 0.62],
      ]),
      color: body,
    },
    ...sym(bx(trim, [0.772, 0.7, 0.0], [0.03, 0.06, 1.5])),
    ...sym(bx(C.gunmetal, [0.42, 0.78, -1.14], [0.2, 0.12, 0.12])),
    ...[-0.95, -0.8, -0.65].map((z) => bx(bodyD, [0, 0.83, z], [1.0, 0.03, 0.08])),
    { geom: P.cyl, color: bodyD, pos: [-0.35, 0.8, 0.85], rot: [-0.3, 0, 0], scale: [0.26, 0.06, 0.26] },
    bx(bodyD, [0, 0.62, 1.34], [0.5, 0.08, 0.04]),
    // turret
    {
      geom: hull([
        [-0.58, 0.82, -0.75 + tz],
        [0.58, 0.82, -0.75 + tz],
        [-0.66, 0.82, 0.05 + tz],
        [0.66, 0.82, 0.05 + tz],
        [-0.36, 0.82, 0.6 + tz],
        [0.36, 0.82, 0.6 + tz],
        [-0.5, 1.2, -0.68 + tz],
        [0.5, 1.2, -0.68 + tz],
        [-0.56, 1.2, 0.0 + tz],
        [0.56, 1.2, 0.0 + tz],
        [-0.3, 1.2, 0.46 + tz],
        [0.3, 1.2, 0.46 + tz],
      ]),
      color: bodyL,
    },
    ...chevron(trim, 1.215, -0.45),
    bx(bodyD, [0, 0.99, 0.48], [0.38, 0.28, 0.2]),
    rod([0, 1.0, 0.5], [0, 1.0, 1.95], 0.09, bodyD, P.cyl),
    { geom: P.chamfer, color: C.gunmetal, pos: [0, 1.0, 2.0], scale: [ur ? 0.26 : 0.2, ur ? 0.18 : 0.14, 0.24] },
    { geom: P.cyl, color: bodyD, pos: [0.24, 1.25, -0.45], scale: [0.3, 0.1, 0.3] },
    { geom: P.hemi, color: bodyL, pos: [0.24, 1.3, -0.45], scale: [0.26, 0.1, 0.26] },
    bx(C.gunmetal, [-0.28, 1.26, 0.0], [0.14, 0.1, 0.16]),
    bx(bodyD, [0, 0.99, -0.98], [0.86, 0.26, 0.24]),
    bx(trim, [0, 0.99, -1.105], [0.6, 0.08, 0.02]),
  ];
  const glow: Part[] = [...sym(bx(C.glowYellow, [0.56, 0.64, 1.335], [0.18, 0.1, 0.04]))];
  if (ssr) {
    parts.push(
      ...sym(bx(body, [0.955, 0.43, 0.05], [0.05, 0.28, 2.1]), bx(trim, [0.96, 0.575, 0.05], [0.06, 0.05, 2.12])),
      rod([-0.4, 1.2, -0.62], [-0.46, 2.0, -0.74], 0.015, C.gunmetal),
    );
  }
  if (ur) {
    // reactive armour blocks, gold barrel bands, second antenna with pennant, roof MG
    for (let i = 0; i < 3; i++) {
      const t = 0.15 + i * 0.3;
      const x = 0.66 + (0.36 - 0.66) * t;
      const z = 0.05 + (0.6 - 0.05) * t + tz;
      parts.push(...sym(bx(bodyD, [x + 0.03, 1.02, z], [0.1, 0.24, 0.17], [0, -0.5, 0])));
      parts.push(...sym(bx(trim, [x + 0.08, 1.02, z], [0.02, 0.24, 0.12], [0, -0.5, 0])));
    }
    parts.push(
      { geom: P.cyl, color: trim, pos: [0, 1.0, 1.25], rot: [Math.PI / 2, 0, 0], scale: [0.2, 0.08, 0.2] },
      { geom: P.cyl, color: trim, pos: [0, 1.0, 0.8], rot: [Math.PI / 2, 0, 0], scale: [0.2, 0.08, 0.2] },
      rod([0.42, 1.2, -0.62], [0.48, 2.1, -0.74], 0.015, C.gunmetal),
      { geom: plateYZ([[0, 0], [-0.36, -0.07], [0, -0.15]], 0.02), color: trim, pos: [0.48, 2.08, -0.74] },
      rod([0.24, 1.42, -0.5], [0.24, 1.42, -0.02], 0.03, C.gunmetal),
      bx(C.gunmetal, [0.24, 1.38, -0.45], [0.1, 0.1, 0.18]),
      ...chevron(trim, 1.215, -0.2),
    );
  }
  return { parts, glow };
}

// ---------------------------------------------------------------------------------------------

function aircraftSpec(r: Rarity): ModelSpec {
  const trim = rarityColor(r);
  const ur = r === 'UR';
  const ssr = r !== 'SR';
  const y0 = AIRCRAFT_HOVER;
  const body = 0xaebfd0;
  const bodyD = 0x7f94ab;
  const fus = lathe(
    [
      [0, 1.6],
      [0.13, 1.38],
      [0.24, 1.02],
      [0.31, 0.55],
      [0.33, 0.0],
      [0.32, -0.6],
      [0.28, -1.05],
      [0.23, -1.25],
      [0, -1.25],
    ],
    8,
  );
  const wing: [number, number][] = [
    [0.15, 0.45],
    [1.3, -0.45],
    [1.3, -0.72],
    [0.15, -0.98],
  ];
  const wingTip: [number, number][] = [
    [1.0, -0.215],
    [1.3, -0.45],
    [1.3, -0.72],
    [1.0, -0.79],
  ];
  const missile = (x: number, z: number, tip: number): Part[] => [
    bx(bodyD, [x, y0 - 0.1, z], [0.04, 0.08, 0.3]),
    { geom: P.cyl6, color: C.white, pos: [x, y0 - 0.19, z], rot: [Math.PI / 2, 0, 0], scale: [0.1, 0.7, 0.1] },
    { geom: P.cone6, color: tip, pos: [x, y0 - 0.19, z + 0.43], rot: [Math.PI / 2, 0, 0], scale: [0.1, 0.16, 0.1] },
    bx(tip, [x, y0 - 0.19, z - 0.3], [0.2, 0.02, 0.1]),
  ];
  const parts: Part[] = [
    { geom: fus, color: body, pos: [0, y0, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.82] },
    { geom: frustum(0.228, 0.25, 8), color: trim, pos: [0, y0, 0.98], rot: [Math.PI / 2, 0, 0], scale: [1.04, 0.12, 0.86] },
    { geom: P.head, color: 0x5fd0ff, pos: [0, y0 + 0.22, 0.52], scale: [0.34, 0.3, 0.82] },
    bx(bodyD, [0, y0 + 0.36, 0.42], [0.04, 0.05, 0.36]),
    // intakes
    ...sym({ geom: P.chamfer, color: bodyD, pos: [0.31, y0 - 0.06, 0.1], scale: [0.16, 0.24, 0.66] }, bx(C.black, [0.31, y0 - 0.06, 0.44], [0.12, 0.18, 0.02])),
    // wings, stabilisers, canted twin tails
    ...sym(
      { geom: slab(wing, 0.07), color: body, pos: [0, y0 - 0.05, 0] },
      { geom: slab(wingTip, 0.085), color: trim, pos: [0, y0 - 0.05, 0] },
      { geom: slab([[0.15, -0.9], [0.72, -1.28], [0.72, -1.44], [0.15, -1.4]], 0.05), color: bodyD, pos: [0, y0, 0] },
      {
        geom: plateYZ([[-0.75, 0], [-1.3, 0.62], [-1.52, 0.62], [-1.38, 0]], 0.05),
        color: body,
        pos: [0.2, y0 + 0.12, 0],
        rot: [0, 0, -0.32],
      },
      { geom: plateYZ([[-1.22, 0.5], [-1.3, 0.62], [-1.52, 0.62], [-1.47, 0.5]], 0.06), color: trim, pos: [0.2, y0 + 0.12, 0], rot: [0, 0, -0.32] },
    ),
    // engine nozzle + chevron on the spine (visible from above)
    { geom: P.cyl, color: C.gunmetal, pos: [0, y0, -1.3], rot: [Math.PI / 2, 0, 0], scale: [0.44, 0.2, 0.37] },
    ...chevron(trim, y0 + 0.275, -0.35, 1.1),
    ...sym(...missile(0.62, -0.3, C.red)),
  ];
  const glow: Part[] = [{ geom: P.cyl, color: C.glowOrange, pos: [0, y0, -1.41], scale: [0.34, 0.04, 0.28], rot: [Math.PI / 2, 0, 0] }];
  if (ssr) parts.push(...sym(...missile(0.92, -0.45, ur ? trim : C.red)));
  if (ur) {
    parts.push(
      ...sym({ geom: slab([[0.22, 0.95], [0.6, 0.72], [0.6, 0.62], [0.22, 0.62]], 0.04), color: trim, pos: [0, y0 - 0.02, 0] }),
      { geom: P.cone, color: trim, pos: [0, y0, 1.58], rot: [Math.PI / 2, 0, 0], scale: [0.14, 0.2, 0.12] },
      ...sym({ geom: P.cyl6, color: C.white, pos: [1.33, y0 - 0.05, -0.35], rot: [Math.PI / 2, 0, 0], scale: [0.07, 0.7, 0.07] }),
      ...sym({ geom: P.cone6, color: trim, pos: [1.33, y0 - 0.05, 0.08], rot: [Math.PI / 2, 0, 0], scale: [0.07, 0.16, 0.07] }),
      bx(trim, [0, y0 + 0.265, -0.78], [0.1, 0.03, 0.5]),
      rod([0, y0 + 0.2, -0.2], [0, y0 + 0.5, -0.35], 0.012, C.gunmetal),
    );
    glow.push(...sym(bx(C.glowWhite, [1.31, y0 - 0.05, -0.58], [0.04, 0.04, 0.06])));
  }
  return { parts, glow };
}

// ---------------------------------------------------------------------------------------------

function missileSpec(r: Rarity): ModelSpec {
  const trim = rarityColor(r);
  const ur = r === 'UR';
  const ssr = r !== 'SR';
  const body = 0xd7b56d;
  const bodyD = 0xae8e50;
  const glass = 0x4fa3d6;
  const parts: Part[] = [
    bx(C.gunmetal, [0, 0.42, -0.1], [1.0, 0.2, 2.7]),
    // wheels
    ...sym(
      ...[0.85, -0.3, -0.95].flatMap((z): Part[] => [
        { geom: P.cyl, color: C.rubber, pos: [0.62, 0.3, z], rot: [0, 0, Math.PI / 2], scale: [0.6, 0.24, 0.6] },
        { geom: P.cyl6, color: bodyD, pos: [0.745, 0.3, z], rot: [0, 0, Math.PI / 2], scale: [0.3, 0.04, 0.3] },
      ]),
      bx(bodyD, [0.62, 0.63, 0.85], [0.32, 0.05, 0.72]),
      bx(bodyD, [0.62, 0.63, -0.62], [0.32, 0.05, 1.4]),
    ),
    // cab
    { geom: rbox(1.3, 0.74, 0.78, 0.1), color: body, pos: [0, 0.9, 0.96] },
    bx(glass, [0, 1.04, 1.35], [1.08, 0.3, 0.04]),
    ...sym(bx(glass, [0.655, 1.04, 1.02], [0.02, 0.26, 0.42])),
    ...sym(bx(trim, [0.656, 0.8, 0.96], [0.02, 0.09, 0.7])),
    bx(C.gunmetal, [0, 0.72, 1.355], [0.86, 0.2, 0.03]),
    bx(C.gunmetal, [0, 0.52, 1.42], [1.26, 0.12, 0.1]),
    ...chevron(trim, 1.275, 0.92, 1.1),
    // bed + turntable
    bx(bodyD, [0, 0.58, -0.5], [1.26, 0.12, 1.8]),
    { geom: P.cyl12, color: C.gunmetal, pos: [0, 0.7, -0.55], scale: [0.8, 0.14, 0.8] },
    // stabiliser legs
    ...sym(bx(C.gunmetal, [0.58, 0.36, -1.36], [0.08, 0.44, 0.08]), bx(C.gunmetal, [0.58, 0.14, -1.36], [0.2, 0.04, 0.2])),
  ];
  // launcher (pitched up toward the front)
  const cols = ur ? [-0.3, 0, 0.3] : [-0.2, 0.2];
  const rows = ssr ? [0.2, 0.44] : [0.2];
  const L: Part[] = [
    bx(bodyD, [0, 0, 0.8], [1.0, 0.08, 1.7]),
    ...sym(bx(body, [0.48, 0.24, 0.8], [0.06, 0.48, 1.7]), bx(trim, [0.515, 0.3, 0.8], [0.02, 0.12, 1.5])),
    bx(body, [0, 0.28, 0.0], [1.0, 0.56, 0.08]),
  ];
  for (const x of cols)
    for (const y of rows) {
      L.push(
        { geom: P.cyl6, color: C.white, pos: [x, y, 0.8], rot: [Math.PI / 2, 0, 0], scale: [0.2, 1.4, 0.2] },
        { geom: P.cone6, color: ur ? trim : C.red, pos: [x, y, 1.65], rot: [Math.PI / 2, 0, 0], scale: [0.2, 0.3, 0.2] },
        { geom: P.cyl6, color: C.gunmetal, pos: [x, y, 1.38], rot: [Math.PI / 2, 0, 0], scale: [0.21, 0.08, 0.21] },
        bx(C.red, [x, y, 0.18], [0.3, 0.025, 0.16]),
      );
    }
  parts.push(...group(L, [0, 0.82, -1.22], [-0.42, 0, 0]));
  parts.push(beam([0, 0.74, -0.55], [0, 1.12, -0.35], 0.16, C.gunmetal));
  const glow: Part[] = [...sym(bx(C.glowYellow, [0.48, 0.74, 1.36], [0.16, 0.1, 0.03])), bx(0xff5a3a, [0, 1.3, 0.8], [0.3, 0.06, 0.1])];
  if (ssr) parts.push(...sym(bx(C.gunmetal, [0.66, 0.5, -0.62], [0.08, 0.14, 0.5])), rod([-0.5, 1.25, 0.75], [-0.55, 2.0, 0.7], 0.015, C.gunmetal));
  if (ur) {
    parts.push(
      { geom: P.hemi, color: C.steelLight, pos: [0.35, 1.3, 0.8], rot: [-0.9, 0, 0], scale: [0.3, 0.12, 0.3] },
      rod([0.35, 1.27, 0.8], [0.35, 1.36, 0.88], 0.02, C.gunmetal),
      rod([0.5, 1.25, 0.75], [0.55, 2.1, 0.7], 0.015, C.gunmetal),
      { geom: plateYZ([[0, 0], [-0.36, -0.07], [0, -0.15]], 0.02), color: trim, pos: [0.55, 2.08, 0.7] },
      ...sym(bx(trim, [0.51, 0.46, -0.1], [0.02, 0.06, 2.6])),
      ...[-0.3, -0.1, 0.1, 0.3].map((x) => bx(C.gunmetal, [x, 0.72, 1.4], [0.05, 0.24, 0.03])),
    );
  }
  return { parts, glow };
}

