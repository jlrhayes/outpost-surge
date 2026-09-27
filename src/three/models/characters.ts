// OWNER: art agent. Characters: squad soldiers, zombies, boss, civilians.
// All crowd geometries are single merged, vertex-coloured meshes (<= ~400 tris) for InstancedMesh.
import * as THREE from 'three';
import { P, beam, buildColored, bx, group, rod, sym, taper, type Part, type V3 } from './builder';
import { cached, modelFromSpec } from './cache';
import { C } from './palette';

type Col = THREE.ColorRepresentation;

/** Two-segment limb (upper + lower) from a via elbow/knee b to c. */
function limb(a: V3, b: V3, c: V3, w1: number, w2: number, col1: Col, col2: Col = col1): Part[] {
  return [beam(a, b, w1, col1), beam(b, c, w2, col2)];
}

// =============================================================================================
// Soldiers

const SOLDIER = {
  helmet: 0x3d87ee,
  helmetDark: 0x2a62bf,
  shirt: 0x4b8fe6,
  pants: 0x28508f,
  vest: 0x243f73,
  pouch: C.khaki,
  pack: 0xcaa866,
  roll: 0x6b8b3d,
  boot: 0x2a2b30,
  gun: 0x33373e,
  gunDark: 0x22252a,
  goggles: 0x25272c,
};

/** Player squad rifleman, ~1.0 m tall, facing +Z. For InstancedMesh crowds (~380 tris). */
export function soldierGeometry(): THREE.BufferGeometry {
  return cached('soldier', () => {
    const S = SOLDIER;
    const parts: Part[] = [
      // legs & boots
      ...sym(bx(S.boot, [0.085, 0.05, 0.03], [0.12, 0.1, 0.2]), bx(S.pants, [0.085, 0.22, 0], [0.12, 0.26, 0.14])),
      bx(C.woodDark, [0, 0.37, 0], [0.3, 0.07, 0.19]),
      // torso + tactical vest
      bx(S.shirt, [0, 0.52, 0], [0.32, 0.26, 0.2]),
      bx(S.vest, [0, 0.5, 0.005], [0.34, 0.2, 0.235]),
      bx(S.pouch, [0, 0.45, 0.125], [0.22, 0.07, 0.04]),
      // backpack + bedroll
      bx(S.pack, [0, 0.53, -0.165], [0.25, 0.27, 0.13]),
      { geom: P.cyl6, color: S.roll, pos: [0, 0.695, -0.16], rot: [0, 0, Math.PI / 2], scale: [0.1, 0.29, 0.1] },
      // head + helmet
      { geom: P.head, color: C.skin, pos: [0, 0.77, 0.015], scale: [0.235, 0.23, 0.235] },
      { geom: P.hemi, color: S.helmet, pos: [0, 0.8, 0], scale: [0.3, 0.25, 0.31] },
      { geom: P.cyl, color: S.helmetDark, pos: [0, 0.805, 0.01], scale: [0.33, 0.04, 0.34] },
      bx(S.goggles, [0, 0.855, 0.135], [0.16, 0.045, 0.03]),
      // arms (right hand on grip, left hand on foregrip)
      ...limb([0.2, 0.61, 0], [0.205, 0.48, 0.09], [0.11, 0.47, 0.2], 0.09, 0.08, S.shirt),
      bx(C.skin, [0.1, 0.47, 0.21], [0.07, 0.07, 0.07]),
      ...limb([-0.2, 0.61, 0], [-0.2, 0.5, 0.14], [-0.04, 0.5, 0.3], 0.09, 0.08, S.shirt),
      bx(C.skin, [-0.02, 0.5, 0.31], [0.07, 0.07, 0.07]),
      // rifle
      bx(S.gun, [0.04, 0.505, 0.21], [0.05, 0.08, 0.34]),
      bx(S.gunDark, [0.04, 0.52, 0.46], [0.03, 0.03, 0.18]),
      bx(S.gunDark, [0.04, 0.43, 0.22], [0.04, 0.09, 0.05]),
      bx(C.woodDark, [0.04, 0.48, 0.0], [0.045, 0.07, 0.1]),
    ];
    const g = buildColored(parts);
    g.scale(1.12, 1.12, 1.12);
    return g;
  });
}

/** Upgraded heavy gunner (~1.3 m, armoured, rotary gun, orange trim), facing +Z. For InstancedMesh. */
export function soldierHeavyGeometry(): THREE.BufferGeometry {
  return cached('soldierHeavy', () => {
    const S = SOLDIER;
    const trim = C.orange;
    const parts: Part[] = [
      // chunky legs + knee pads
      ...sym(
        bx(S.boot, [0.11, 0.06, 0.03], [0.16, 0.12, 0.24]),
        bx(S.pants, [0.11, 0.24, 0], [0.16, 0.28, 0.17]),
        bx(S.vest, [0.11, 0.27, 0.09], [0.13, 0.1, 0.04]),
      ),
      bx(C.woodDark, [0, 0.41, 0], [0.38, 0.08, 0.22]),
      // armoured torso
      { geom: taper(0.4, 0.24, 0.48, 0.28, 0.34), color: S.shirt, pos: [0, 0.42, 0] },
      { geom: taper(0.44, 0.3, 0.5, 0.32, 0.26), color: S.vest, pos: [0, 0.44, 0.005] },
      bx(trim, [0, 0.62, 0.155], [0.3, 0.05, 0.03]),
      // shoulder pads
      ...sym({ geom: P.chamfer, color: S.helmet, pos: [0.29, 0.72, 0], scale: [0.16, 0.12, 0.22], rot: [0, 0, -0.3] }),
      ...sym(bx(trim, [0.3, 0.745, 0], [0.12, 0.03, 0.225], [0, 0, -0.3])),
      // ammo drum backpack
      { geom: P.cyl12, color: S.gun, pos: [0, 0.58, -0.22], rot: [0, 0, Math.PI / 2], scale: [0.3, 0.34, 0.3] },
      { geom: P.cyl12, color: trim, pos: [0, 0.58, -0.22], rot: [0, 0, Math.PI / 2], scale: [0.31, 0.06, 0.31] },
      // head + big helmet with visor
      { geom: P.head, color: C.skin, pos: [0, 0.84, 0.02], scale: [0.23, 0.22, 0.23] },
      { geom: P.hemi, color: S.helmet, pos: [0, 0.85, 0], scale: [0.32, 0.27, 0.33] },
      { geom: P.cyl, color: S.helmetDark, pos: [0, 0.855, 0.0], scale: [0.35, 0.05, 0.36] },
      bx(0x1b2b40, [0, 0.83, 0.14], [0.2, 0.07, 0.04]),
      bx(trim, [0, 0.99, 0.0], [0.05, 0.03, 0.3]),
      // arms
      ...limb([0.27, 0.66, 0.02], [0.27, 0.52, 0.12], [0.14, 0.48, 0.24], 0.11, 0.1, S.shirt),
      bx(C.skin, [0.12, 0.48, 0.26], [0.09, 0.09, 0.09]),
      ...limb([-0.27, 0.66, 0.02], [-0.25, 0.54, 0.16], [-0.06, 0.55, 0.3], 0.11, 0.1, S.shirt),
      bx(C.skin, [-0.04, 0.55, 0.31], [0.09, 0.09, 0.09]),
      // rotary cannon
      bx(S.gun, [0.05, 0.53, 0.26], [0.16, 0.14, 0.34]),
      bx(trim, [0.05, 0.605, 0.26], [0.1, 0.02, 0.2]),
      { geom: P.cyl6, color: S.gunDark, pos: [0.05, 0.53, 0.55], rot: [Math.PI / 2, 0, 0], scale: [0.15, 0.1, 0.15] },
      ...[0, 1, 2].map(
        (i): Part => ({
          geom: P.cyl6,
          color: S.gunDark,
          pos: [0.05 + Math.cos((i * Math.PI * 2) / 3) * 0.04, 0.53 + Math.sin((i * Math.PI * 2) / 3) * 0.04, 0.66],
          rot: [Math.PI / 2, 0, 0],
          scale: [0.04, 0.26, 0.04],
        }),
      ),
      // ammo belt
      beam([0.12, 0.58, -0.12], [0.11, 0.5, 0.18], 0.05, C.goldDark, 0.03),
    ];
    const g = buildColored(parts);
    g.scale(1.12, 1.12, 1.12);
    return g;
  });
}

// =============================================================================================
// Zombies

export type ZombieVariant = 'walker' | 'runner' | 'brute';

function zombieHead(skin: Col, eye: Col, scale: number, mouthOpen = 0.04): Part[] {
  const s = scale;
  return [
    { geom: P.sphereLow, color: skin, pos: [0, 0, 0], scale: [s, s * 1.05, s], vary: 0.14 },
    ...sym(bx(eye, [s * 0.2, s * 0.08, s * 0.42], [s * 0.2, s * 0.14, s * 0.1])),
    bx(C.zMouth, [0, -s * 0.2, s * 0.4], [s * 0.36, mouthOpen + s * 0.06, s * 0.1]),
  ];
}

/** Zombie, facing +Z. walker ~1.1 m (hunched, arms forward), runner ~1.0 m (lean, sprinting), brute ~1.8 m (hulking). */
export function zombieGeometry(variant: ZombieVariant = 'walker'): THREE.BufferGeometry {
  return cached('zombie_' + variant, () => {
    if (variant === 'runner') return buildColored(runnerParts());
    if (variant === 'brute') return buildColored(bruteParts());
    return buildColored(walkerParts());
  });
}

function walkerParts(): Part[] {
  const skin = C.zSkin;
  const shirt = C.zPurple;
  const pants = C.zBrown;
  const tilt = 0.42;
  const hip: V3 = [0, 0.46, 0];
  // torso-local parts (origin at hip pivot, +y along spine)
  const torso: Part[] = [
    { geom: taper(0.3, 0.19, 0.37, 0.22, 0.36), color: shirt, vary: 0.08 },
    bx(skin, [0.07, 0.11, 0.1], [0.12, 0.1, 0.03]),
    // torn hem rags
    bx(C.zPurpleDark, [0.09, -0.03, 0.09], [0.07, 0.1, 0.02]),
    bx(C.zPurpleDark, [-0.1, -0.02, 0.09], [0.06, 0.08, 0.02]),
    bx(C.zPurpleDark, [0.05, -0.03, -0.1], [0.08, 0.1, 0.02]),
    bx(skin, [0, 0.38, 0.02], [0.1, 0.07, 0.1]),
    ...group(zombieHead(skin, C.zEye, 0.3), [0, 0.51, 0.07], [-0.1, 0.15, 0.12]),
  ];
  const tc = Math.cos(tilt),
    ts = Math.sin(tilt);
  const sh = (x: number, y: number): V3 => [x, hip[1] + y * tc, y * ts];
  const shR = sh(0.2, 0.31);
  const shL = sh(-0.2, 0.31);
  return [
    // legs: left forward, right back
    beam([-0.09, 0.45, 0.02], [-0.09, 0.14, 0.1], 0.13, pants),
    beam([-0.09, 0.2, 0.09], [-0.09, 0.03, 0.1], 0.1, skin),
    bx(skin, [-0.09, 0.03, 0.14], [0.1, 0.06, 0.16]),
    beam([0.09, 0.45, 0], [0.09, 0.06, -0.1], 0.13, pants),
    bx(C.black, [0.09, 0.04, -0.07], [0.11, 0.08, 0.19]),
    bx(pants, [0, 0.45, 0], [0.3, 0.1, 0.18]),
    ...group(torso, hip, [tilt, 0, 0]),
    // arms reaching forward (short torn sleeves)
    beam(shR, [0.21, 0.72, 0.28], 0.1, shirt),
    beam([0.21, 0.72, 0.28], [0.18, 0.72, 0.55], 0.08, skin),
    bx(skin, [0.17, 0.71, 0.6], [0.09, 0.06, 0.1]),
    beam(shL, [-0.22, 0.75, 0.27], 0.1, shirt),
    beam([-0.22, 0.75, 0.27], [-0.2, 0.79, 0.53], 0.08, skin),
    bx(skin, [-0.2, 0.8, 0.58], [0.09, 0.06, 0.1]),
  ];
}

function runnerParts(): Part[] {
  const skin = C.zSkinGrey;
  const shirt = C.zRust;
  const pants = C.zPurpleDark;
  const tilt = 0.72;
  const hip: V3 = [0, 0.44, 0];
  const torso: Part[] = [
    { geom: taper(0.24, 0.15, 0.3, 0.17, 0.34), color: shirt, vary: 0.08 },
    bx(skin, [-0.05, 0.16, 0.08], [0.1, 0.12, 0.03]),
    bx(0x6b3f28, [0.07, -0.03, 0.07], [0.06, 0.1, 0.02]),
    bx(0x6b3f28, [-0.06, -0.02, -0.08], [0.07, 0.09, 0.02]),
    bx(skin, [0, 0.36, 0.02], [0.08, 0.07, 0.08]),
    ...group(zombieHead(skin, 0xffd21f, 0.28, 0.07), [0, 0.48, 0.06], [-0.35, 0, 0]),
  ];
  const tc = Math.cos(tilt),
    ts = Math.sin(tilt);
  const sh = (x: number, y: number): V3 => [x, hip[1] + y * tc, y * ts];
  return [
    // stride: right leg forward (bent knee), left leg kicked back
    ...limb([0.07, 0.44, 0.02], [0.07, 0.27, 0.2], [0.07, 0.06, 0.13], 0.1, 0.08, pants, skin),
    bx(C.black, [0.07, 0.035, 0.17], [0.09, 0.07, 0.16]),
    ...limb([-0.07, 0.44, -0.02], [-0.07, 0.24, -0.12], [-0.07, 0.17, -0.34], 0.1, 0.08, pants, skin),
    bx(skin, [-0.07, 0.16, -0.39], [0.08, 0.12, 0.07]),
    bx(pants, [0, 0.44, 0], [0.24, 0.09, 0.15]),
    ...group(torso, hip, [tilt, 0, 0]),
    // right arm reaching far forward, left arm swinging back
    ...limb(sh(0.17, 0.3), [0.19, 0.6, 0.42], [0.15, 0.62, 0.64], 0.08, 0.07, skin),
    bx(skin, [0.15, 0.62, 0.69], [0.08, 0.05, 0.09]),
    ...limb(sh(-0.17, 0.3), [-0.2, 0.52, 0.04], [-0.18, 0.44, -0.16], 0.08, 0.07, skin),
    beam(sh(-0.17, 0.3), [-0.19, 0.58, 0.14], 0.09, shirt),
  ];
}

function bruteParts(): Part[] {
  const skin = C.zSkinBrute;
  const skinD = C.zSkinDark;
  const pants = C.zPurpleDark;
  const tilt = 0.32;
  const hip: V3 = [0, 0.62, 0];
  const torso: Part[] = [
    { geom: taper(0.62, 0.44, 1.0, 0.56, 0.72, 0.04), color: skin, vary: 0.07 },
    // belly
    { geom: P.sphereLow, color: 0x86b356, pos: [0, 0.22, 0.12], scale: [0.66, 0.52, 0.46], vary: 0.06 },
    // torn overall straps + rag vest
    ...sym(bx(C.zBrown, [0.2, 0.5, 0.27], [0.1, 0.46, 0.04], [0.12, 0, 0.1])),
    bx(C.zBrown, [0, 0.66, -0.26], [0.9, 0.2, 0.08]),
    // shoulder muscle
    ...sym({ geom: P.sphereLow, color: skin, pos: [0.46, 0.66, 0.02], scale: [0.44, 0.42, 0.46], vary: 0.1 }),
    // bone spikes on back + pustules
    { geom: P.cone4, color: C.bone, pos: [0.22, 0.78, -0.2], rot: [-0.6, 0, -0.3], scale: [0.1, 0.3, 0.1] },
    { geom: P.cone4, color: C.bone, pos: [-0.08, 0.8, -0.24], rot: [-0.7, 0, 0.1], scale: [0.12, 0.36, 0.12] },
    { geom: P.cone4, color: C.bone, pos: [0.52, 0.9, -0.05], rot: [-0.3, 0, -0.6], scale: [0.08, 0.24, 0.08] },
    { geom: P.octa, color: C.pus, pos: [-0.42, 0.86, 0.06], scale: [0.16, 0.16, 0.16] },
    { geom: P.octa, color: C.pus, pos: [-0.3, 0.92, -0.12], scale: [0.12, 0.12, 0.12] },
    // small head sunk between shoulders, pushed forward
    ...group(zombieHead(skin, C.zEye, 0.34, 0.08), [0, 0.78, 0.3], [-0.2, 0, 0]),
  ];
  const tc = Math.cos(tilt),
    ts = Math.sin(tilt);
  const sh = (x: number, y: number, z = 0): V3 => [x, hip[1] + y * tc - z * ts, y * ts + z * tc];
  const arm = (side: number): Part[] => {
    const s = side;
    const a = sh(0.5 * s, 0.6, 0.02);
    const elbow: V3 = [0.62 * s, 0.82, 0.5];
    const fist: V3 = [0.54 * s, 0.34, 0.66];
    return [
      beam(a, elbow, 0.26, skin),
      { geom: taper(0.2, 0.2, 0.32, 0.3, 1), ...orient(elbow, fist), color: skinD, vary: 0.08 },
      { geom: P.sphereLow, color: skinD, pos: fist, scale: [0.36, 0.32, 0.36] },
      { geom: P.box, color: C.steelDark, pos: lerp3(elbow, fist, 0.7), ...orientRot(elbow, fist), scale: [0.33, 0.08, 0.33] },
    ];
  };
  return [
    // thick short legs
    ...sym(
      { geom: taper(0.28, 0.3, 0.3, 0.3, 0.52), color: pants, pos: [0.22, 0.1, 0], vary: 0.05 },
      bx(skinD, [0.22, 0.06, 0.05], [0.28, 0.12, 0.36]),
    ),
    bx(pants, [0, 0.64, 0], [0.64, 0.18, 0.42]),
    bx(C.woodDark, [0, 0.7, 0.02], [0.66, 0.07, 0.45]),
    ...group(torso, hip, [tilt, 0, 0]),
    ...arm(1),
    ...arm(-1),
  ];
}

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
/** pos/rot/scale so a unit-height, bottom-origin geometry spans a -> b. */
function orient(a: V3, b: V3): { pos: V3; rot: V3; scale: V3 } {
  const p = beam(a, b, 1, 0);
  const len = p.scale![1];
  return { pos: a, rot: p.rot!, scale: [1, len, 1] };
}
/** rotation aligning local +Y with a -> b */
function orientRot(a: V3, b: V3): { rot: V3 } {
  return { rot: beam(a, b, 1, 0).rot! };
}

// =============================================================================================
// Boss

/**
 * Giant mutated boss zombie (~3.6 m), facing +Z. Children: 'body' (static), 'glow' (unlit pustules/eyes),
 * 'weaponArm' (pivot at right shoulder: rotate .rotation.x negative to raise, positive to smash).
 */
export function bossModel(): THREE.Group {
  const g = modelFromSpec('boss_body', bossBodySpec);
  const armPivot = new THREE.Group();
  armPivot.name = 'weaponArm';
  armPivot.position.set(...BOSS_SHOULDER_R);
  const arm = modelFromSpec('boss_arm', bossArmSpec);
  armPivot.add(arm);
  g.add(armPivot);
  return g;
}

const BOSS_SKIN = 0x5f8f3e;
const BOSS_SKIN_D = 0x4a7331;
const BOSS_SKIN_L = 0x86b35a;
const BOSS_RAG = 0x5a3a86;
const BOSS_RAG_D = 0x3f2862;
const BOSS_IRON = 0x7b6a5c;
const BOSS_GLOW = 0xc8ff3a;
const BOSS_EYE = 0xff3b1f;
const BOSS_TILT = 0.3;
const BOSS_HIP: V3 = [0, 1.25, 0];
const BOSS_SHOULDER_R: V3 = [1.0, 2.42, 0.45];

function bossBodySpec() {
  const skin = BOSS_SKIN;
  const tilt = BOSS_TILT;
  const torso: Part[] = [
    { geom: taper(1.2, 0.85, 1.9, 1.1, 1.4, 0.1), color: skin, vary: 0.08 },
    { geom: P.sphere, color: BOSS_SKIN_L, pos: [0, 0.45, 0.35], scale: [1.2, 0.95, 0.8], vary: 0.06 },
    // chest plates (pecs)
    ...sym({ geom: P.chamfer, color: skin, pos: [0.4, 1.05, 0.52], scale: [0.7, 0.42, 0.3], rot: [0.1, 0.2, 0], vary: 0.06 }),
    // shoulder humps
    ...sym({ geom: P.sphere, color: skin, pos: [0.9, 1.25, 0.1], scale: [0.85, 0.8, 0.85], vary: 0.1 }),
    // hunched back mass
    { geom: P.sphere, color: BOSS_SKIN_D, pos: [0, 1.25, -0.35], scale: [1.4, 0.9, 0.9], vary: 0.1 },
    // spine spikes
    ...[0, 1, 2, 3].map(
      (i): Part => ({
        geom: P.cone4,
        color: C.bone,
        pos: [(i % 2 ? 0.18 : -0.18) * (i < 2 ? 1 : 0.6), 1.55 - i * 0.28, -0.7 + i * 0.06],
        rot: [-1.0 + i * 0.1, 0, i % 2 ? -0.3 : 0.3],
        scale: [0.2, 0.7 - i * 0.1, 0.2],
      }),
    ),
    ...sym(
      { geom: P.cone4, color: C.bone, pos: [1.05, 1.62, 0.0], rot: [-0.2, 0, -0.5], scale: [0.18, 0.6, 0.18] },
      { geom: P.cone4, color: C.bone, pos: [1.2, 1.4, -0.25], rot: [-0.6, 0, -0.9], scale: [0.14, 0.45, 0.14] },
    ),
    // rusty shoulder armour (left)
    { geom: P.hemi12, color: BOSS_IRON, pos: [-0.95, 1.33, 0.1], rot: [0, 0, 0.5], scale: [1.02, 0.62, 1.0], vary: 0.08 },
    ...[0, 1, 2].map((i): Part => ({ geom: P.cone4, color: C.steelLight, pos: [-1.05 - i * 0.08, 1.72 - i * 0.12, -0.2 + i * 0.25], rot: [0, 0, 0.7], scale: [0.1, 0.25, 0.1] })),
    // chains + rag belt
    bx(BOSS_RAG, [0, 0.05, 0.02], [1.35, 0.3, 1.0]),
    // head (low, forward)
    ...group(
      [
        { geom: taper(0.55, 0.5, 0.62, 0.55, 0.55), color: skin, vary: 0.1 },
        // heavy brow
        bx(BOSS_SKIN_D, [0, 0.42, 0.24], [0.66, 0.14, 0.14]),
        // jaw with teeth
        { geom: taper(0.62, 0.5, 0.58, 0.46, 0.22), color: BOSS_SKIN_D, pos: [0, -0.22, 0.08] },
        bx(C.zMouth, [0, 0.04, 0.24], [0.44, 0.16, 0.1]),
        ...[-0.16, -0.05, 0.05, 0.16].map((x): Part => ({ geom: P.cone4, color: C.bone, pos: [x, 0.0, 0.29], rot: [0, 0, 0], scale: [0.07, 0.14, 0.07] })),
        ...sym({ geom: P.cone4, color: C.bone, pos: [0.24, 0.16, 0.29], rot: [Math.PI, 0, 0], scale: [0.08, 0.18, 0.08] }),
        // horn-like growths
        ...sym({ geom: P.cone4, color: C.bone, pos: [0.3, 0.62, -0.05], rot: [-0.4, 0, -0.5], scale: [0.14, 0.42, 0.14] }),
      ],
      [0, 1.6, 0.55],
      [-BOSS_TILT + 0.05, 0, 0],
    ),
  ];
  const tc = Math.cos(tilt),
    ts = Math.sin(tilt);
  const tp = (x: number, y: number, z = 0): V3 => [x, BOSS_HIP[1] + y * tc - z * ts, y * ts + z * tc];
  const glowTorso: Part[] = [
    // pustules on back, shoulder and belly (unlit bright)
    { geom: P.sphereLow, color: BOSS_GLOW, pos: [0.55, 1.45, -0.55], scale: [0.28, 0.28, 0.28] },
    { geom: P.sphereLow, color: BOSS_GLOW, pos: [0.75, 1.2, -0.45], scale: [0.2, 0.2, 0.2] },
    { geom: P.sphereLow, color: BOSS_GLOW, pos: [-0.35, 1.05, -0.72], scale: [0.24, 0.24, 0.24] },
    { geom: P.sphereLow, color: BOSS_GLOW, pos: [0.3, 0.35, 0.78], scale: [0.2, 0.2, 0.2] },
    { geom: P.sphereLow, color: BOSS_GLOW, pos: [-0.4, 0.55, 0.72], scale: [0.16, 0.16, 0.16] },
    { geom: P.sphereLow, color: BOSS_GLOW, pos: [1.05, 1.1, 0.35], scale: [0.18, 0.18, 0.18] },
    // eyes
    ...group(
      sym({ geom: P.sphereLow, color: BOSS_EYE, pos: [0.16, 0.3, 0.3], scale: [0.14, 0.1, 0.06] }),
      [0, 1.6, 0.55],
      [-BOSS_TILT + 0.05, 0, 0],
    ),
  ];
  const leftArmShoulder = tp(-0.95, 1.3, 0.25);
  const lElbow: V3 = [-1.3, 1.7, 0.8];
  const lHand: V3 = [-1.15, 0.9, 1.3];
  const parts: Part[] = [
    // legs: thick, bent
    ...sym(
      { geom: taper(0.55, 0.6, 0.62, 0.66, 0.75), color: BOSS_RAG_D, pos: [0.45, 0.5, -0.05], rot: [0.15, 0, 0.05], vary: 0.06 },
      beam([0.47, 0.6, 0.05], [0.5, 0.1, -0.05], 0.44, BOSS_SKIN_D),
      { geom: P.chamfer, color: BOSS_SKIN_D, pos: [0.5, 0.12, 0.12], scale: [0.55, 0.24, 0.72] },
      ...[-0.15, 0, 0.15].map((x): Part => ({ geom: P.cone4, color: C.bone, pos: [0.5 + x, 0.1, 0.5], rot: [Math.PI / 2, 0, 0], scale: [0.09, 0.16, 0.09] })),
      bx(BOSS_RAG, [0.46, 0.95, 0.05], [0.66, 0.35, 0.72]),
    ),
    bx(BOSS_RAG, [0, 1.15, 0], [1.35, 0.42, 0.9]),
    ...group(torso, BOSS_HIP, [tilt, 0, 0]),
    // left arm: mutated claw
    beam(leftArmShoulder, lElbow, 0.55, BOSS_SKIN),
    { geom: taper(0.5, 0.5, 0.7, 0.66, 1), ...orient(lElbow, lHand), color: BOSS_SKIN_D, vary: 0.08 },
    { geom: P.chamfer, color: BOSS_SKIN_D, pos: lHand, scale: [0.6, 0.45, 0.6] },
    ...[-0.2, 0, 0.2].map(
      (x): Part => ({ geom: P.cone4, color: C.bone, pos: [lHand[0] + x, lHand[1] - 0.35, lHand[2] + 0.2], rot: [0.5, 0, 0], scale: [0.12, 0.45, 0.12] }),
    ),
    { geom: P.cyl6, color: C.steelDark, pos: lerp3(lElbow, lHand, 0.65), ...orientRot(lElbow, lHand), scale: [0.8, 0.14, 0.8] },
  ];
  return { parts, glow: group(glowTorso, BOSS_HIP, [tilt, 0, 0]) };
}

function bossArmSpec() {
  // Local to the right shoulder pivot; arm hangs down-forward holding a concrete slab club.
  const elbow: V3 = [0.35, -0.5, 0.45];
  const hand: V3 = [0.3, -1.2, 0.9];
  const parts: Part[] = [
    { geom: P.sphere, color: BOSS_SKIN, pos: [0, 0, 0], scale: [0.7, 0.7, 0.7], vary: 0.1 },
    beam([0, 0, 0], elbow, 0.55, BOSS_SKIN),
    { geom: taper(0.5, 0.5, 0.66, 0.62, 1), ...orient(elbow, hand), color: BOSS_SKIN_D, vary: 0.08 },
    { geom: P.chamfer, color: BOSS_SKIN_D, pos: hand, scale: [0.55, 0.5, 0.55] },
    { geom: P.cyl6, color: C.steelDark, pos: lerp3(elbow, hand, 0.6), ...orientRot(elbow, hand), scale: [0.78, 0.14, 0.78] },
    // rebar handle + concrete slab
    rod([hand[0], hand[1] + 0.2, hand[2] - 0.25], [hand[0], hand[1] - 0.2, hand[2] + 0.9], 0.07, C.zRust),
    { geom: P.chamfer, color: C.concrete, pos: [hand[0], hand[1] - 0.45, hand[2] + 1.45], rot: [0.35, 0, 0.08], scale: [0.95, 0.4, 1.3], vary: 0.07 },
    bx(C.concreteDark, [hand[0] + 0.1, hand[1] - 0.25, hand[2] + 1.5], [0.4, 0.06, 0.5], [0.35, 0.2, 0.08]),
    ...[-0.3, 0, 0.3].map((x): Part => rod([hand[0] + x, hand[1] - 0.2, hand[2] + 1.9], [hand[0] + x * 1.2, hand[1] - 0.05, hand[2] + 2.3], 0.03, C.zRust)),
  ];
  const glow: Part[] = [{ geom: P.sphereLow, color: BOSS_GLOW, pos: [0.3, 0.25, -0.15], scale: [0.24, 0.24, 0.24] }];
  return { parts, glow };
}

// =============================================================================================
// Civilians

/** Civilian survivor (~0.95 m, hoodie, cap, satchel), facing +Z. For base ambience / rescued NPCs. */
export function survivorGeometry(): THREE.BufferGeometry {
  return cached('survivor', () => {
    const hoodie = 0xf08a2a;
    const jeans = 0x3f63a8;
    const cap = 0xd83a2e;
    const parts: Part[] = [
      ...sym(
        bx(C.white, [0.085, 0.045, 0.03], [0.12, 0.09, 0.2]),
        bx(jeans, [0.085, 0.22, 0], [0.12, 0.3, 0.14]),
      ),
      bx(jeans, [0, 0.38, 0], [0.3, 0.08, 0.18]),
      { geom: taper(0.3, 0.19, 0.34, 0.21, 0.3), color: hoodie, pos: [0, 0.38, 0] },
      bx(0xd9731c, [0, 0.47, 0.105], [0.18, 0.08, 0.02]),
      // hood bunched at the back
      { geom: P.chamfer, color: 0xd9731c, pos: [0, 0.68, -0.09], scale: [0.24, 0.08, 0.1] },
      // satchel strap + bag
      beam([0.15, 0.68, 0.0], [-0.14, 0.42, 0.0], 0.04, C.woodDark, 0.23),
      bx(C.wood, [-0.19, 0.42, 0.02], [0.08, 0.13, 0.16]),
      // arms relaxed
      ...sym(...limb([0.2, 0.65, 0], [0.22, 0.5, -0.01], [0.21, 0.37, 0.04], 0.085, 0.08, hoodie)),
      ...sym(bx(C.skin, [0.21, 0.33, 0.05], [0.07, 0.07, 0.07])),
      // head, hair, cap
      { geom: P.head, color: C.skin, pos: [0, 0.8, 0.01], scale: [0.23, 0.23, 0.23] },
      { geom: P.hemi, color: C.hairBrown, pos: [0, 0.79, -0.01], scale: [0.245, 0.2, 0.24] },
      { geom: P.hemi, color: cap, pos: [0, 0.84, 0], scale: [0.25, 0.16, 0.25] },
      bx(cap, [0, 0.845, 0.14], [0.18, 0.025, 0.12]),
    ];
    const g = buildColored(parts);
    g.scale(1.08, 1.08, 1.08);
    return g;
  });
}

