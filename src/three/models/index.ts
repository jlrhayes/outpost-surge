// OWNER: art agent. Public model API used by every 3D mode. Keep these signatures stable.
//
// Conventions (all models):
//  - Units: 1 unit ~= 1 metre. Soldier ~1.0 tall, zombie ~1.1, vehicles ~2-3 long, buildings ~4x4 footprint.
//  - Origin at ground level, centred. Characters/vehicles FACE +Z (Object3D.lookAt convention).
//  - Low-poly, flat-shaded, vertex-coloured via buildColored() + vcMaterial() (see builder.ts).
//  - *Geometry() functions return a CACHED geometry: never dispose/mutate it; ideal for InstancedMesh.
//  - *Model() functions return a fresh THREE.Group each call (safe to add to scenes).
import * as THREE from 'three';
import type { BuildingType, HeroType, Rarity } from '../../core/types';
import { buildColored, P, vcMesh } from './builder';

export { buildColored, vcMaterial, vcMesh, P } from './builder';

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

/** Player soldier (rifleman), ~1.0 tall, facing +Z. For InstancedMesh crowds in the runner. */
export function soldierGeometry(): THREE.BufferGeometry {
  return cached('soldier', () =>
    buildColored([
      { geom: P.box, color: 0x3b6e3b, pos: [0, 0.55, 0], scale: [0.4, 0.45, 0.25] },
      { geom: P.sphere, color: 0xf0c8a0, pos: [0, 0.92, 0], scale: [0.26, 0.26, 0.26] },
      { geom: P.sphere, color: 0x2f5a2f, pos: [0, 1.0, 0], scale: [0.3, 0.16, 0.3] },
      { geom: P.box, color: 0x2a3a2a, pos: [-0.1, 0.18, 0], scale: [0.14, 0.36, 0.16] },
      { geom: P.box, color: 0x2a3a2a, pos: [0.1, 0.18, 0], scale: [0.14, 0.36, 0.16] },
      { geom: P.box, color: 0x222222, pos: [0.14, 0.6, 0.25], scale: [0.07, 0.07, 0.5] },
    ]),
  );
}

export type ZombieVariant = 'walker' | 'runner' | 'brute';
/** Zombie, facing +Z. walker ~1.1 tall, runner ~1.0 (thin), brute ~1.8 (wide). */
export function zombieGeometry(variant: ZombieVariant = 'walker'): THREE.BufferGeometry {
  return cached('zombie_' + variant, () => {
    const s = variant === 'brute' ? 1.6 : variant === 'runner' ? 0.9 : 1;
    const skin = variant === 'brute' ? 0x6f8f4f : 0x8fb070;
    return buildColored([
      { geom: P.box, color: 0x6a5a8a, pos: [0, 0.6 * s, 0], scale: [0.45 * s, 0.5 * s, 0.28 * s] },
      { geom: P.sphere, color: skin, pos: [0, 1.0 * s, 0.05], scale: [0.3 * s, 0.3 * s, 0.3 * s] },
      { geom: P.box, color: skin, pos: [-0.2 * s, 0.75 * s, 0.25 * s], scale: [0.1 * s, 0.1 * s, 0.45 * s] },
      { geom: P.box, color: skin, pos: [0.2 * s, 0.75 * s, 0.25 * s], scale: [0.1 * s, 0.1 * s, 0.45 * s] },
      { geom: P.box, color: 0x3a3a4a, pos: [-0.11 * s, 0.2 * s, 0], scale: [0.15 * s, 0.4 * s, 0.16 * s] },
      { geom: P.box, color: 0x3a3a4a, pos: [0.11 * s, 0.2 * s, 0], scale: [0.15 * s, 0.4 * s, 0.16 * s] },
    ]);
  });
}

/** Big end-of-level boss zombie (~3.5 tall), facing +Z. */
export function bossModel(): THREE.Group {
  const g = new THREE.Group();
  const m = vcMesh(zombieGeometry('brute'));
  m.scale.setScalar(2.2);
  g.add(m);
  return g;
}

/** Hero war machine for battles/world marches, facing +Z. Rarity tints the trim. */
export function vehicleModel(type: HeroType, rarity: Rarity = 'SR'): THREE.Group {
  const trim = rarity === 'UR' ? 0xffb020 : rarity === 'SSR' ? 0xb050ff : 0x4aa0ff;
  const g = new THREE.Group();
  let geom: THREE.BufferGeometry;
  if (type === 'tank') {
    geom = cached('veh_tank_' + rarity, () =>
      buildColored([
        { geom: P.box, color: 0x556b2f, pos: [0, 0.45, 0], scale: [1.4, 0.5, 2.2] },
        { geom: P.box, color: 0x333333, pos: [-0.75, 0.3, 0], scale: [0.3, 0.45, 2.3] },
        { geom: P.box, color: 0x333333, pos: [0.75, 0.3, 0], scale: [0.3, 0.45, 2.3] },
        { geom: P.box, color: 0x6b8e23, pos: [0, 0.9, -0.1], scale: [0.9, 0.4, 1.0] },
        { geom: P.cyl, color: 0x444444, pos: [0, 0.9, 0.9], rot: [Math.PI / 2, 0, 0], scale: [0.16, 1.3, 0.16] },
        { geom: P.box, color: trim, pos: [0, 1.12, -0.1], scale: [0.5, 0.06, 0.5] },
      ]),
    );
  } else if (type === 'aircraft') {
    geom = cached('veh_air_' + rarity, () =>
      buildColored([
        { geom: P.cyl, color: 0x8a9aa8, pos: [0, 1.4, 0], rot: [Math.PI / 2, 0, 0], scale: [0.4, 2.4, 0.4] },
        { geom: P.cone, color: 0x8a9aa8, pos: [0, 1.4, 1.5], rot: [Math.PI / 2, 0, 0], scale: [0.4, 0.6, 0.4] },
        { geom: P.box, color: 0x6a7a88, pos: [0, 1.4, 0], scale: [2.6, 0.08, 0.7] },
        { geom: P.box, color: 0x6a7a88, pos: [0, 1.7, -1.0], scale: [0.08, 0.6, 0.4] },
        { geom: P.box, color: trim, pos: [0, 1.62, 0.5], scale: [0.25, 0.1, 0.5] },
      ]),
    );
  } else {
    geom = cached('veh_missile_' + rarity, () =>
      buildColored([
        { geom: P.box, color: 0x7a6a4a, pos: [0, 0.5, 0], scale: [1.2, 0.5, 2.4] },
        { geom: P.box, color: 0x5a4a3a, pos: [0, 0.95, 0.8], scale: [1.1, 0.5, 0.7] },
        { geom: P.box, color: 0x555555, pos: [0, 1.05, -0.4], rot: [-0.35, 0, 0], scale: [0.9, 0.4, 1.3] },
        { geom: P.cyl, color: 0xdddddd, pos: [-0.25, 1.35, -0.3], rot: [Math.PI / 2 - 0.35, 0, 0], scale: [0.14, 1.2, 0.14] },
        { geom: P.cyl, color: 0xdddddd, pos: [0.25, 1.35, -0.3], rot: [Math.PI / 2 - 0.35, 0, 0], scale: [0.14, 1.2, 0.14] },
        { geom: P.box, color: trim, pos: [0, 1.22, 0.8], scale: [0.4, 0.06, 0.3] },
        { geom: P.cyl, color: 0x222222, pos: [-0.62, 0.3, 0.8], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.2, 0.5] },
        { geom: P.cyl, color: 0x222222, pos: [0.62, 0.3, 0.8], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.2, 0.5] },
        { geom: P.cyl, color: 0x222222, pos: [-0.62, 0.3, -0.8], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.2, 0.5] },
        { geom: P.cyl, color: 0x222222, pos: [0.62, 0.3, -0.8], rot: [0, 0, Math.PI / 2], scale: [0.5, 0.2, 0.5] },
      ]),
    );
  }
  g.add(vcMesh(geom));
  return g;
}

/** Base building for a plot. Footprint ~3.5x3.5 (HQ ~6x6). Visuals may grow with level. */
export function buildingModel(type: BuildingType, level: number): THREE.Group {
  const colors: Partial<Record<BuildingType, number>> = {
    hq: 0x4a78b0,
    barracks: 0x6b8e23,
    farm: 0xc8a040,
    ironmine: 0x7a7a8a,
    goldmine: 0xd4af37,
    hospital: 0xe0e0e0,
    tech: 0x40a0c0,
    drill: 0x9a7a50,
    warehouse: 0x8a6a4a,
    tavern: 0xa05030,
    wall: 0x888888,
    radar: 0x507050,
  };
  const lv = Math.max(0, Math.min(level, 30));
  const size = type === 'hq' ? 5 : 3.2;
  const h = type === 'hq' ? 3 + lv * 0.05 : 1.6 + lv * 0.03;
  const geom = cached(`bld_${type}_${lv}`, () =>
    buildColored([
      { geom: P.box, color: 0x5a5a5a, pos: [0, 0.1, 0], scale: [size + 0.4, 0.2, size + 0.4] },
      { geom: P.box, color: colors[type] ?? 0x999999, pos: [0, 0.2 + h / 2, 0], scale: [size, h, size] },
      { geom: P.cone, color: 0x8b3a3a, pos: [0, 0.2 + h + 0.5, 0], rot: [0, Math.PI / 4, 0], scale: [size * 1.35, 1, size * 1.35] },
    ]),
  );
  const g = new THREE.Group();
  g.add(vcMesh(geom));
  return g;
}

/** Scaffolding/crane overlay shown on a building while it is being upgraded/constructed. */
export function constructionModel(): THREE.Group {
  const g = new THREE.Group();
  g.add(
    vcMesh(
      cached('construction', () =>
        buildColored([
          { geom: P.box, color: 0xe0b020, pos: [-1.6, 1.5, -1.6], scale: [0.12, 3, 0.12] },
          { geom: P.box, color: 0xe0b020, pos: [1.6, 1.5, -1.6], scale: [0.12, 3, 0.12] },
          { geom: P.box, color: 0xe0b020, pos: [-1.6, 1.5, 1.6], scale: [0.12, 3, 0.12] },
          { geom: P.box, color: 0xe0b020, pos: [1.6, 1.5, 1.6], scale: [0.12, 3, 0.12] },
          { geom: P.box, color: 0xe0b020, pos: [0, 3, 0], scale: [3.3, 0.1, 3.3] },
        ]),
      ),
    ),
  );
  return g;
}

export type PropKind = 'barrel' | 'crate' | 'tree' | 'pine' | 'rock' | 'car_wreck' | 'fence' | 'sandbag' | 'lamp' | 'cone';
/** Environment prop geometry (cached, vertex-coloured). */
export function propGeometry(kind: PropKind): THREE.BufferGeometry {
  return cached('prop_' + kind, () => {
    switch (kind) {
      case 'barrel':
        return buildColored([{ geom: P.cyl, color: 0xc03020, pos: [0, 0.5, 0], scale: [0.7, 1, 0.7] }]);
      case 'crate':
        return buildColored([{ geom: P.box, color: 0xa07040, pos: [0, 0.5, 0], scale: [1, 1, 1] }]);
      case 'tree':
        return buildColored([
          { geom: P.cyl, color: 0x6b4a2a, pos: [0, 0.5, 0], scale: [0.25, 1, 0.25] },
          { geom: P.sphereLow, color: 0x3f8f3f, pos: [0, 1.5, 0], scale: [1.4, 1.4, 1.4] },
        ]);
      case 'pine':
        return buildColored([
          { geom: P.cyl, color: 0x6b4a2a, pos: [0, 0.4, 0], scale: [0.2, 0.8, 0.2] },
          { geom: P.cone, color: 0x2f6f3f, pos: [0, 1.5, 0], scale: [1.2, 1.8, 1.2] },
        ]);
      case 'rock':
        return buildColored([{ geom: P.sphereLow, color: 0x8a8a8a, pos: [0, 0.3, 0], scale: [1.2, 0.7, 1] }]);
      case 'car_wreck':
        return buildColored([
          { geom: P.box, color: 0x8a4a3a, pos: [0, 0.45, 0], scale: [1.6, 0.5, 3] },
          { geom: P.box, color: 0x6a3a2a, pos: [0, 0.85, -0.2], scale: [1.4, 0.4, 1.5] },
        ]);
      case 'fence':
        return buildColored([{ geom: P.box, color: 0x8a6a4a, pos: [0, 0.4, 0], scale: [2, 0.8, 0.1] }]);
      case 'sandbag':
        return buildColored([{ geom: P.box, color: 0xb0a070, pos: [0, 0.3, 0], scale: [2, 0.6, 0.6] }]);
      case 'lamp':
        return buildColored([
          { geom: P.cyl, color: 0x333333, pos: [0, 1.5, 0], scale: [0.1, 3, 0.1] },
          { geom: P.box, color: 0xffeeaa, pos: [0, 3, 0], scale: [0.4, 0.2, 0.4] },
        ]);
      case 'cone':
        return buildColored([{ geom: P.cone, color: 0xff7020, pos: [0, 0.35, 0], scale: [0.4, 0.7, 0.4] }]);
    }
  });
}

/** Survivor/NPC civilian (for base ambience), facing +Z. */
export function survivorGeometry(): THREE.BufferGeometry {
  return cached('survivor', () =>
    buildColored([
      { geom: P.box, color: 0x3a6ea5, pos: [0, 0.55, 0], scale: [0.38, 0.45, 0.24] },
      { geom: P.sphere, color: 0xe0b890, pos: [0, 0.92, 0], scale: [0.26, 0.26, 0.26] },
      { geom: P.box, color: 0x444444, pos: [0, 0.18, 0], scale: [0.34, 0.36, 0.18] },
    ]),
  );
}
