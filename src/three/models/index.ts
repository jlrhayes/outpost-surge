// OWNER: art agent. Public model API used by every 3D mode. Keep these signatures stable.
//
// Conventions (all models):
//  - Units: 1 unit ~= 1 metre. Soldier ~1.0 tall, zombie ~1.1, vehicles ~2.5 long, buildings ~3.6x3.6 footprint.
//  - Origin at ground level, centred. Characters/vehicles FACE +Z (Object3D.lookAt convention).
//  - Low-poly, flat-shaded, vertex-coloured via buildColored() + vcMaterial() (see builder.ts).
//  - *Geometry() functions return a CACHED geometry: never dispose/mutate it; ideal for InstancedMesh.
//  - *Model() functions return a fresh THREE.Group each call (safe to add to scenes). Groups may contain
//    children named 'body', 'glow' (unlit lights - use vcGlowMaterial), 'spin' (animated via animateModel()).
import * as THREE from 'three';
import type { Rarity } from '../../core/types';
import { vcMesh } from './builder';
import { bossModel, soldierGeometry, soldierHeavyGeometry, survivorGeometry, zombieGeometry } from './characters';
import { vehicleModel } from './vehicles';

export {
  buildColored,
  vcMaterial,
  vcMesh,
  P,
  vcGlowMaterial,
  glowMesh,
  blobShadow,
  triCount,
  bx,
  beam,
  rod,
  group,
  sym,
  mirrored,
  hull,
  rbox,
  taper,
  frustum,
  lathe,
  slab,
  plateYZ,
  extrudeXY,
  stripesAround,
} from './builder';
export type { Part, V2, V3 } from './builder';
export { C as PALETTE, rarityColor } from './palette';
export { animateModel } from './cache';

export { soldierGeometry, soldierHeavyGeometry, zombieGeometry, bossModel, survivorGeometry } from './characters';
export type { ZombieVariant } from './characters';
export { vehicleModel, vehicleGeometry, AIRCRAFT_HOVER } from './vehicles';
export { buildingModel, buildingTier, constructionModel, BUILDING_MODEL_TYPES } from './buildings';
export type { BuildingModelType } from './buildings';
export {
  propGeometry,
  PROP_KINDS,
  gatePostGeometry,
  bulletGeometry,
  muzzleFlashGeometry,
  coinGeometry,
  gemGeometry,
  flagModel,
  flagClothGeometry,
  emptyPlotGeometry,
  resourceNodeGeometry,
  rockGeom,
} from './props';
export type { PropKind } from './props';
export { ruinedBlockModel } from './blocks';

/**
 * Model for a Combatant.model key (battle/world scenes), facing +Z:
 * 'tank' | 'aircraft' | 'missile' (uses rarity), 'zombie' | 'zombieRunner' | 'zombieBrute' | 'zombieBoss',
 * 'soldier' | 'soldierHeavy' | 'survivor'. Unknown keys fall back to a walker zombie.
 */
export function modelForKey(key: string, rarity: Rarity = 'SR'): THREE.Group {
  switch (key) {
    case 'tank':
    case 'aircraft':
    case 'missile':
      return vehicleModel(key, rarity);
    case 'zombieBoss':
    case 'boss':
      return bossModel();
    case 'zombieBrute':
    case 'brute':
      return wrap(zombieGeometry('brute'));
    case 'zombieRunner':
    case 'runner':
      return wrap(zombieGeometry('runner'));
    case 'soldier':
      return wrap(soldierGeometry());
    case 'soldierHeavy':
      return wrap(soldierHeavyGeometry());
    case 'survivor':
      return wrap(survivorGeometry());
    default:
      return wrap(zombieGeometry('walker'));
  }
}

function wrap(geom: THREE.BufferGeometry): THREE.Group {
  const g = new THREE.Group();
  const m = vcMesh(geom);
  m.name = 'body';
  g.add(m);
  return g;
}
