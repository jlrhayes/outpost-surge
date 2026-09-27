// OWNER: art agent. Model caches + tiny scene-graph helpers shared by the model files.
import * as THREE from 'three';
import { buildColored, glowMesh, vcMesh, type Part, type V3 } from './builder';

const cache = new Map<string, THREE.BufferGeometry>();
/** Cache a geometry by key (never disposed: shared by every instance). */
export function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = cache.get(key);
  if (!g) cache.set(key, (g = make()));
  return g;
}

export type Axis = 'x' | 'y' | 'z';

/** A rotating sub-part (radar dishes, crane jibs, windmills, rotors). */
export interface SpinSpec {
  parts: Part[];
  /** pivot position in the model */
  pos: V3;
  axis: Axis;
  /** radians per second */
  speed: number;
  glow?: boolean;
}

export interface ModelSpec {
  parts: Part[];
  /** parts rendered with the unlit glow material (lights, eyes, flames) */
  glow?: Part[];
  spin?: SpinSpec[];
}

interface BuiltModel {
  main: THREE.BufferGeometry;
  glow?: THREE.BufferGeometry;
  spin: { geom: THREE.BufferGeometry; pos: V3; axis: Axis; speed: number; glow?: boolean }[];
}

const modelCache = new Map<string, BuiltModel>();

/** Build (once) and instantiate a multi-mesh model: static body + optional glow + spinning children. */
export function modelFromSpec(key: string, make: () => ModelSpec): THREE.Group {
  let b = modelCache.get(key);
  if (!b) {
    const s = make();
    b = {
      main: buildColored(s.parts),
      glow: s.glow && s.glow.length ? buildColored(s.glow) : undefined,
      spin: (s.spin ?? []).map((sp) => ({
        geom: buildColored(sp.parts),
        pos: sp.pos,
        axis: sp.axis,
        speed: sp.speed,
        glow: sp.glow,
      })),
    };
    modelCache.set(key, b);
  }
  const g = new THREE.Group();
  const body = vcMesh(b.main);
  body.name = 'body';
  g.add(body);
  if (b.glow) {
    const gm = glowMesh(b.glow);
    gm.name = 'glow';
    g.add(gm);
  }
  for (const sp of b.spin) {
    const m = sp.glow ? glowMesh(sp.geom) : vcMesh(sp.geom);
    m.name = 'spin';
    m.position.set(...sp.pos);
    m.userData.spinAxis = sp.axis;
    m.userData.spinSpeed = sp.speed;
    g.add(m);
  }
  return g;
}

/**
 * Advance built-in model animations: children tagged with userData.spinAxis/spinSpeed rotate
 * (radar dishes, crane jibs, windmills), children tagged userData.wave sway (flag cloth).
 * Call once per frame per animated model: `animateModel(group, dt, elapsed)`. Cheap (cached child list).
 */
export function animateModel(root: THREE.Object3D, dt: number, elapsed = 0): void {
  let list = root.userData._anim as THREE.Object3D[] | undefined;
  if (!list) {
    list = [];
    root.traverse((o) => {
      if (o.userData.spinAxis || o.userData.wave) list!.push(o);
    });
    root.userData._anim = list;
  }
  for (const o of list) {
    if (o.userData.spinAxis) {
      const ax = o.userData.spinAxis as Axis;
      o.rotation[ax] += (o.userData.spinSpeed as number) * dt;
    } else if (o.userData.wave) {
      const ph = (o.userData.phase as number) ?? 0;
      o.rotation.y = (o.userData.baseRotY ?? 0) + Math.sin(elapsed * 3 + ph) * 0.18;
    }
  }
}
